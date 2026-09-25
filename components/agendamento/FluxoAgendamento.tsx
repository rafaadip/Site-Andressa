'use client';

/**
 * Fluxo de agendamento em 4 etapas — docs/fases/FASE-07-fluxo-agendamento.md
 *
 *   ① Modalidade → ② Data e horário → ③ Seus dados → ✓ Confirmado
 *
 * Uma pergunta e uma ação primária por etapa. Sem cadastro.
 *
 * Acessibilidade: a cada troca de etapa o foco vai para o título dela e um
 * aria-live anuncia "Etapa 2 de 3"; o indicador de etapas é um <ol> com
 * aria-current (e não aria-hidden, como no protótipo).
 *
 * Rascunho em sessionStorage (some ao fechar a aba) — SEM o motivo da
 * consulta: dado de saúde não fica no aparelho.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MessageCircle, TriangleAlert } from 'lucide-react';
import type {
  AgendamentoConfirmado, ErroApi, RespostaDisponibilidade, SlotPublico, TipoConsultaPublico,
} from '@/lib/agendamento/tipos';
import { campos, schemaDadosPaciente, errosPorCampo } from '@/lib/validation/agendamento';
import { dataPorExtenso, fusoDoPaciente, somarDias } from '@/lib/datetime-cliente';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { SeletorModalidade } from './SeletorModalidade';
import { SeletorHorario, type EstadoDisp } from './SeletorHorario';
import { FormularioDados, DADOS_VAZIOS, ORDEM_CAMPOS, type Dados } from './FormularioDados';
import { Confirmacao } from './Confirmacao';
import { BarraAcoes, BotaoAcao } from './BarraAcoes';

const JANELA_DIAS = 14;
const HORIZONTE_DIAS = 60;
const CHAVE_RASCUNHO = 'agendamento:rascunho';
const VALIDADE_RASCUNHO_MS = 30 * 60_000;

const ETAPAS = ['Modalidade', 'Data e horário', 'Seus dados'] as const;
const TITULOS = {
  1: 'Como você prefere ser atendido(a)?',
  2: 'Escolha o dia e o horário',
  3: 'Para quem é a consulta?',
} as const;

type Etapa = 1 | 2 | 3 | 4;
type Alerta = { texto: string; repetir?: boolean } | null;

type Props = { tipos: TipoConsultaPublico[]; hoje: string; fuso: string };

export function FluxoAgendamento({ tipos, hoje, fuso }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [direcao, setDirecao] = useState<'frente' | 'tras'>('frente');
  const [tipo, setTipo] = useState<string | null>(tipos.length === 1 ? tipos[0]!.slug : null);
  const [janela, setJanela] = useState(hoje);
  const [disp, setDisp] = useState<EstadoDisp>({ estado: 'carregando' });
  const [dia, setDia] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotPublico | null>(null);
  const [dados, setDados] = useState<Dados>(DADOS_VAZIOS);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState<Alerta>(null);
  const [confirmado, setConfirmado] = useState<AgendamentoConfirmado | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [fusoPaciente, setFusoPaciente] = useState<string | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const chaveRef = useRef<{ chave: string; slot: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const montado = useRef(false);

  const tipoAtual = tipos.find((t) => t.slug === tipo) ?? null;

  // ── Rascunho (sessionStorage) ─────────────────────────────────────────
  // Restaurar num effect é o caso LEGÍTIMO de setState em effect:
  // sessionStorage só existe no navegador; ler no estado inicial faria o
  // HTML do servidor divergir do cliente (erro de hidratação).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_RASCUNHO);
      if (bruto) {
        const r = JSON.parse(bruto) as { t: number; tipo: string | null; nome: string; telefone: string; email: string };
        if (Date.now() - r.t < VALIDADE_RASCUNHO_MS) {
          if (r.tipo && tipos.some((x) => x.slug === r.tipo)) setTipo(r.tipo);
          setDados((d) => ({ ...d, nome: r.nome ?? '', telefone: r.telefone ?? '', email: r.email ?? '' }));
        }
      }
    } catch { /* navegação privada / armazenamento bloqueado: segue sem rascunho */ }
  }, [tipos]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (confirmado) return;
    try {
      sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
        t: Date.now(), tipo, nome: dados.nome, telefone: dados.telefone, email: dados.email,
      }));
    } catch { /* idem */ }
  }, [tipo, dados.nome, dados.telefone, dados.email, confirmado]);

  // ── Foco e anúncio a cada troca de etapa ──────────────────────────────
  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }   // não rouba o foco ao carregar
    const titulo = tituloRef.current;
    if (!titulo) return;
    // No celular, leva o título da etapa ao topo: sem isso a etapa 2 abria
    // com os horários ABAIXO da dobra, atrás do cabeçalho da página.
    if (window.matchMedia('(max-width: 767px)').matches) {
      const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      titulo.scrollIntoView({ block: 'start', behavior: reduzir ? 'auto' : 'smooth' });
    }
    titulo.focus({ preventScroll: true });
    setAnuncio(etapa <= 3 ? `Etapa ${etapa} de 3: ${ETAPAS[etapa - 1]}` : 'Consulta confirmada');
  }, [etapa]);

  function irPara(n: Etapa) {
    setDirecao(n > etapa ? 'frente' : 'tras');
    setEtapa(n);
  }

  // ── Disponibilidade ───────────────────────────────────────────────────
  const carregar = useCallback(async (slugTipo: string, inicio: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDisp({ estado: 'carregando' });

    try {
      const url = `/api/disponibilidade?tipo=${encodeURIComponent(slugTipo)}&de=${inicio}&ate=${somarDias(inicio, JANELA_DIAS - 1)}`;
      const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!resp.ok) throw new Error(String(resp.status));
      const r = await resp.json() as RespostaDisponibilidade;

      setDisp({ estado: 'ok', dias: r.dias, degradado: r.degradado });
      // Mantém a escolha se ela ainda existe; senão, 1º dia com vaga.
      setDia((atual) => {
        const aindaLivre = r.dias.find((d) => d.data === atual && d.slots.length);
        return aindaLivre ? atual : r.dias.find((d) => d.slots.length)?.data ?? null;
      });
      setSlot((atual) => (atual && r.dias.some((d) => d.slots.some((s) => s.inicio === atual.inicio)) ? atual : null));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setDisp({ estado: 'erro' });
    }
  }, []);

  // ── Etapa 1 ───────────────────────────────────────────────────────────
  function continuarModalidade() {
    if (!tipo) { setErros({ tipo: 'Escolha uma modalidade para continuar.' }); return; }
    setErros({});
    setAlerta(null);
    const t = tipos.find((x) => x.slug === tipo);
    setFusoPaciente(t?.modalidade === 'telehealth' ? fusoDoPaciente(fuso) : null);
    void carregar(tipo, janela);
    irPara(2);
  }

  // ── Etapa 2 ───────────────────────────────────────────────────────────
  function mudarJanela(d: -1 | 1) {
    if (!tipo) return;
    const nova = somarDias(janela, d * JANELA_DIAS);
    setJanela(nova);
    void carregar(tipo, nova);
  }

  function continuarHorario() {
    if (!slot) { setErros({ slot: 'Escolha um horário para continuar.' }); return; }
    setErros({});
    setAlerta(null);
    // A chave de idempotência acompanha o HORÁRIO: trocou o horário, é outro pedido.
    if (chaveRef.current?.slot !== slot.inicio) {
      chaveRef.current = { chave: crypto.randomUUID(), slot: slot.inicio };
    }
    irPara(3);
  }

  // ── Etapa 3 ───────────────────────────────────────────────────────────
  function mudarCampo<K extends keyof Dados>(campo: K, valor: Dados[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    // Revalida ENQUANTO digita só se o campo já mostra erro: o erro some
    // assim que é corrigido, mas não aparece antes de a pessoa terminar.
    if (erros[campo]) validarCampo(campo, valor);
  }

  function validarCampo(campo: keyof Dados, valor: unknown = dados[campo]) {
    if (campo === 'consentimentoSaude') return;
    const esquema = campos[campo as keyof typeof campos];
    const r = esquema.safeParse(valor);
    setErros((e) => {
      const n = { ...e };
      if (r.success) delete n[campo]; else n[campo] = r.error.issues[0]?.message ?? 'Campo inválido.';
      return n;
    });
  }

  function focarPrimeiroErro(e: Record<string, string>) {
    const primeiro = ORDEM_CAMPOS.find((c) => e[c]);
    if (primeiro) requestAnimationFrame(() => document.getElementById(primeiro)?.focus());
  }

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault();
    if (enviando || !tipo || !slot || !chaveRef.current) return;

    const v = schemaDadosPaciente.safeParse(dados);
    if (!v.success) {
      const e = errosPorCampo(v.error);
      setErros(e);
      focarPrimeiroErro(e);
      return;
    }

    setEnviando(true);
    setAlerta(null);
    try {
      const resp = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': chaveRef.current.chave },
        body: JSON.stringify({ tipo, inicio: slot.inicio, site: '', paciente: dados }),
      });
      const corpo = await resp.json().catch(() => null) as AgendamentoConfirmado | ErroApi | null;

      if (resp.ok && corpo && 'urlGestao' in corpo) {
        try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ok */ }
        setConfirmado(corpo);
        irPara(4);
        return;
      }

      const erro = corpo as ErroApi | null;
      if (resp.status === 409) {
        // Alguém levou o horário: volta à etapa 2 COM OS DADOS PRESERVADOS.
        setSlot(null);
        chaveRef.current = null;
        setAlerta({ texto: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro — seus dados foram mantidos.' });
        void carregar(tipo, janela);
        irPara(2);
      } else if (resp.status === 422 && erro?.campos) {
        setErros(erro.campos);
        focarPrimeiroErro(erro.campos);
      } else {
        setAlerta({
          texto: erro?.mensagem ?? 'Não conseguimos concluir agora.',
          repetir: resp.status >= 500,
        });
      }
    } catch {
      // Rede caiu: repetir usa a MESMA chave — se o primeiro envio chegou,
      // o servidor devolve a mesma consulta em vez de criar outra.
      setAlerta({ texto: 'A conexão falhou. Tente de novo — não haverá agendamento duplicado.', repetir: true });
    } finally {
      setEnviando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  const hojeMaisHorizonte = somarDias(hoje, HORIZONTE_DIAS);
  const podeVoltarJanela = janela > hoje;
  const podeAvancarJanela = somarDias(janela, JANELA_DIAS) <= hojeMaisHorizonte;
  const diaSel = disp.estado === 'ok' ? disp.dias.find((d) => d.data === dia) : undefined;

  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>

      {etapa <= 3 && (
        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Etapas do agendamento">
          {ETAPAS.map((nome, i) => {
            const n = i + 1;
            const atual = n === etapa;
            const feita = n < etapa;
            return (
              <li key={nome} aria-current={atual ? 'step' : undefined} className="min-w-0">
                <span aria-hidden className={`block h-1 rounded-full ${atual || feita ? 'bg-gold-500' : 'bg-sand-200'}`} />
                <span className={`mt-2 block truncate text-[.8125rem] ${atual ? 'font-medium text-texto' : 'text-texto-2'}`}>
                  <span className="sr-only">{feita ? 'Concluída: ' : atual ? 'Atual: ' : ''}</span>
                  {n}. {nome}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {alerta && (
        <div role="alert" className="mb-6 flex gap-3 rounded-md border border-danger/40 bg-superficie p-4">
          <TriangleAlert aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm text-texto">
            <p>{alerta.texto}</p>
            {alerta.repetir && (
              <p className="mt-2 flex flex-wrap gap-x-5">
                <button type="submit" form="form-dados" className="inline-flex min-h-11 items-center font-medium text-acento underline underline-offset-4">Tentar de novo</button>
                <a href={linkWhatsApp(MENSAGEM_AGENDAMENTO)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-acento underline underline-offset-4">Agendar pelo WhatsApp</a>
              </p>
            )}
          </div>
        </div>
      )}

      <div key={etapa} className={direcao === 'frente' ? 'entrar-frente' : 'entrar-tras'}>
        {etapa === 1 && (
          <>
            <h2 ref={tituloRef} tabIndex={-1} className="display text-h3 text-texto mb-6 outline-none">{TITULOS[1]}</h2>
            <SeletorModalidade tipos={tipos} selecionado={tipo} erro={erros.tipo}
              aoSelecionar={(s) => {
                if (s !== tipo) { setDia(null); setSlot(null); setJanela(hoje); }
                setTipo(s); setErros({});
              }} />
            <BarraAcoes>
              <BotaoAcao onClick={continuarModalidade} pendente={!tipo}>
                Continuar <ArrowRight aria-hidden size={18} strokeWidth={1.75} />
              </BotaoAcao>
            </BarraAcoes>
          </>
        )}

        {etapa === 2 && (
          <>
            <h2 ref={tituloRef} tabIndex={-1} className="display text-h3 text-texto mb-2 outline-none">{TITULOS[2]}</h2>
            <p className="mb-5 text-sm text-texto-2">{tipoAtual?.label} · {tipoAtual?.duracaoMin} min</p>
            <SeletorHorario
              disp={disp} dia={dia} slot={slot} fusoPaciente={fusoPaciente} erro={erros.slot}
              podeVoltarJanela={podeVoltarJanela} podeAvancarJanela={podeAvancarJanela}
              aoEscolherDia={(d) => { setDia(d); setSlot(null); }}
              aoEscolherSlot={(s) => { setSlot(s); setErros({}); }}
              aoMudarJanela={mudarJanela}
              aoTentarDeNovo={() => tipo && void carregar(tipo, janela)}
            />
            <BarraAcoes>
              <BotaoAcao secundario onClick={() => irPara(1)}>
                <ArrowLeft aria-hidden size={18} strokeWidth={1.75} /><span className="max-md:sr-only">Voltar</span>
              </BotaoAcao>
              <BotaoAcao onClick={continuarHorario} pendente={!slot}>
                Continuar <ArrowRight aria-hidden size={18} strokeWidth={1.75} />
              </BotaoAcao>
            </BarraAcoes>
          </>
        )}

        {etapa === 3 && slot && diaSel && tipoAtual && (
          <form id="form-dados" noValidate onSubmit={confirmar}>
            <h2 ref={tituloRef} tabIndex={-1} className="display text-h3 text-texto mb-5 outline-none">{TITULOS[3]}</h2>

            {/* Resumo fixo: o que foi escolhido não é perguntado de novo (WCAG 3.3.7). */}
            <div className="mb-7 flex items-start justify-between gap-4 rounded-md border border-gold-500/50 bg-superficie p-4">
              <p className="text-texto">
                <span className="block font-medium">{tipoAtual.label}</span>
                <span className="block text-sm text-texto-2 first-letter:uppercase">
                  {dataPorExtenso(diaSel.data, diaSel.diaSemana)} às <span className="tabular">{slot.rotulo}</span>
                </span>
              </p>
              <button type="button" onClick={() => irPara(2)} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-acento underline underline-offset-4">
                Alterar
              </button>
            </div>

            <FormularioDados dados={dados} erros={erros} aoMudar={mudarCampo} aoSair={(c) => validarCampo(c)} />

            <BarraAcoes>
              <BotaoAcao secundario onClick={() => irPara(2)}>
                <ArrowLeft aria-hidden size={18} strokeWidth={1.75} /><span className="max-md:sr-only">Voltar</span>
              </BotaoAcao>
              <BotaoAcao tipo="submit" ocupado={enviando}>
                {enviando
                  ? <><Loader2 aria-hidden size={18} className="animate-spin" /> Confirmando…</>
                  : 'Confirmar agendamento'}
              </BotaoAcao>
            </BarraAcoes>
          </form>
        )}

        {etapa === 4 && confirmado && (
          <Confirmacao ref={tituloRef} ag={confirmado} nome={dados.nome} />
        )}
      </div>

      {etapa <= 2 && (
        <p className="mt-8 text-center text-sm text-texto-2 md:text-left">
          Prefere conversar?{' '}
          <a href={linkWhatsApp(MENSAGEM_AGENDAMENTO)} target="_blank" rel="noopener noreferrer"
            className="font-medium text-acento underline underline-offset-4">
            <MessageCircle aria-hidden size={14} className="mr-1 inline" />Agende pelo WhatsApp
          </a>
        </p>
      )}
    </div>
  );
}
