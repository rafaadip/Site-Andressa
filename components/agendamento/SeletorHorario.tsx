import { ChevronLeft, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';
import type { DiaPublico, SlotPublico } from '@/lib/agendamento/tipos';
import { dataPorExtenso, horaNoFuso, nomeDoFuso, rotuloDia } from '@/lib/datetime-cliente';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { navegarRadio } from './navegacao-radio';

export type EstadoDisp =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'ok'; dias: DiaPublico[]; degradado: boolean };

type Props = {
  disp: EstadoDisp;
  dia: string | null;
  slot: SlotPublico | null;
  /** Fuso do paciente quando difere do da clínica — só em teleconsulta. */
  fusoPaciente: string | null;
  podeVoltarJanela: boolean;
  podeAvancarJanela: boolean;
  aoEscolherDia: (data: string) => void;
  aoEscolherSlot: (s: SlotPublico) => void;
  aoMudarJanela: (direcao: -1 | 1) => void;
  aoTentarDeNovo: () => void;
  erro?: string;
};

export function SeletorHorario(p: Props) {
  if (p.disp.estado === 'erro') {
    return (
      <EstadoVazio
        titulo="Não conseguimos carregar os horários."
        texto="Verifique a conexão e tente de novo."
        acao={<button type="button" onClick={p.aoTentarDeNovo} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto"><RefreshCw aria-hidden size={18} strokeWidth={1.75} /> Tentar de novo</button>}
      />
    );
  }

  const carregando = p.disp.estado === 'carregando';
  const dias = p.disp.estado === 'ok' ? p.disp.dias : [];
  const semNada = !carregando && dias.every((d) => d.slots.length === 0);
  const diaAtual = dias.find((d) => d.data === p.dia);
  const focavelDia = p.dia ?? dias.find((d) => d.slots.length)?.data;
  const focavelSlot = p.slot?.inicio ?? diaAtual?.slots[0]?.inicio;

  return (
    <div aria-busy={carregando}>
      <p className="text-sm text-texto-2">
        Horários de Brasília
        {p.fusoPaciente && <> · entre parênteses, no seu fuso ({nomeDoFuso(p.fusoPaciente)})</>}
      </p>
      {p.disp.estado === 'ok' && p.disp.degradado && (
        <p role="status" className="mt-3 rounded-md bg-superficie p-3 text-sm text-texto-2">
          A agenda está sendo atualizada. Se o horário escolhido mudar, confirmaremos pelo WhatsApp.
        </p>
      )}

      {/* ── Navegação entre janelas de 14 dias ─────────────────────── */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <BotaoJanela direcao={-1} habilitado={p.podeVoltarJanela && !carregando} aoClicar={p.aoMudarJanela} />
        <p className="text-sm font-medium text-texto" aria-live="polite">
          {dias.length > 0 && faixaDeDatas(dias)}
        </p>
        <BotaoJanela direcao={1} habilitado={p.podeAvancarJanela && !carregando} aoClicar={p.aoMudarJanela} />
      </div>

      {/* ── Dias ──────────────────────────────────────────────────────
          Celular: rolagem HORIZONTAL dentro do componente (7 dias não
          cabem em 375px com alvo de 44px). A página não rola de lado. */}
      {carregando ? (
        <div className="-mx-[var(--gutter)] mt-3 flex gap-2 overflow-hidden px-[var(--gutter)] md:mx-0 md:grid md:grid-cols-7 md:px-0">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="h-[5.25rem] w-[4.25rem] shrink-0 animate-pulse rounded-md bg-sand-200 md:w-auto" />
          ))}
        </div>
      ) : (
        <div
          id="grupo-dias"
          tabIndex={-1}
          role="radiogroup"
          aria-label="Dia da consulta"
          onKeyDown={navegarRadio}
          className="-mx-[var(--gutter)] mt-3 flex snap-x gap-2 overflow-x-auto px-[var(--gutter)] pb-2
                     [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0"
        >
          {dias.map((d) => {
            const r = rotuloDia(d.data, d.diaSemana);
            const livre = d.slots.length > 0;
            const ativo = d.data === p.dia;
            return (
              <button
                key={d.data}
                type="button"
                role="radio"
                aria-checked={ativo}
                aria-disabled={!livre || undefined}
                tabIndex={d.data === focavelDia ? 0 : -1}
                onClick={() => livre && p.aoEscolherDia(d.data)}
                aria-label={`${dataPorExtenso(d.data, d.diaSemana)}, ${livre ? `${d.slots.length} ${d.slots.length === 1 ? 'horário' : 'horários'}` : 'sem horários'}`}
                className={`flex h-[5.25rem] w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-md border md:w-auto
                            transition-colors duration-150
                            ${ativo ? 'border-espresso-900 bg-espresso-900 text-ivory-100'
                              : livre ? 'border-borda-campo bg-elevado text-texto hover:border-ink'
                                : 'cursor-not-allowed border-borda bg-transparent text-texto-2 opacity-55'}`}
              >
                <span aria-hidden className="text-[.75rem] uppercase tracking-[.12em]">{r.semana}</span>
                <span aria-hidden className="font-display text-[1.375rem] leading-none tabular">{r.numero}</span>
                <span aria-hidden className="text-[.75rem]">{r.mes}</span>
                <span aria-hidden className={`mt-0.5 size-1.5 rounded-full ${livre ? (ativo ? 'bg-gold-200' : 'bg-gold-500') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Horários ─────────────────────────────────────────────── */}
      <div className="mt-7">
        {carregando ? (
          <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-12 animate-pulse rounded-md bg-sand-200" />)}
          </div>
        ) : semNada ? (
          <EstadoVazio
            titulo="Sem horários livres nestes dias."
            texto={p.podeAvancarJanela ? 'Veja os próximos dias ou fale com o consultório.' : 'Fale com o consultório para encontrar um horário.'}
            acao={
              <div className="flex flex-col gap-3 md:flex-row">
                {p.podeAvancarJanela && (
                  <button type="button" onClick={() => p.aoMudarJanela(1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto">
                    Ver próximos dias <ChevronRight aria-hidden size={18} />
                  </button>
                )}
                <a href={linkWhatsApp(MENSAGEM_AGENDAMENTO)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto">
                  <MessageCircle aria-hidden size={18} strokeWidth={1.75} /> WhatsApp
                </a>
              </div>
            }
          />
        ) : diaAtual ? (
          <>
            <h3 id="rotulo-horarios" className="mb-3 font-medium text-texto first-letter:uppercase">
              {dataPorExtenso(diaAtual.data, diaAtual.diaSemana)}
            </h3>
            <div
              id="grupo-horarios"
              tabIndex={-1}
              role="radiogroup"
              aria-labelledby="rotulo-horarios"
              aria-describedby={p.erro ? 'erro-horario' : undefined}
              onKeyDown={navegarRadio}
              className="grid grid-cols-3 gap-2.5 md:grid-cols-4"
            >
              {diaAtual.slots.map((s) => {
                const ativo = p.slot?.inicio === s.inicio;
                return (
                  <button
                    key={s.inicio}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    tabIndex={s.inicio === focavelSlot ? 0 : -1}
                    onClick={() => p.aoEscolherSlot(s)}
                    className={`flex min-h-12 flex-col items-center justify-center rounded-md border px-2 py-1.5 tabular
                                transition-colors duration-150
                                ${ativo ? 'border-espresso-900 bg-espresso-900 text-ivory-100'
                                  : 'border-borda-campo bg-elevado text-texto hover:border-ink'}`}
                  >
                    <span className="text-[1.0625rem] font-medium">{s.rotulo}</span>
                    {p.fusoPaciente && (
                      <span className={`text-[.75rem] ${ativo ? 'text-cream-muted' : 'text-texto-2'}`}>
                        ({horaNoFuso(s.inicio, p.fusoPaciente)})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-texto-2">Escolha um dia para ver os horários.</p>
        )}
        {p.erro && <p id="erro-horario" role="alert" className="mt-3 text-sm text-danger">{p.erro}</p>}
      </div>
    </div>
  );
}

function BotaoJanela({ direcao, habilitado, aoClicar }: {
  direcao: -1 | 1; habilitado: boolean; aoClicar: (d: -1 | 1) => void;
}) {
  const Icone = direcao === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={() => habilitado && aoClicar(direcao)}
      disabled={!habilitado}
      aria-label={direcao === -1 ? 'Dias anteriores' : 'Próximos dias'}
      className="grid size-11 place-items-center rounded-full border border-borda-campo text-texto disabled:border-borda disabled:opacity-40"
    >
      <Icone aria-hidden size={20} strokeWidth={1.75} />
    </button>
  );
}

function EstadoVazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: React.ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-borda bg-superficie p-6 text-center">
      <p className="font-medium text-texto">{titulo}</p>
      <p className="mt-1 mb-5 text-sm text-texto-2">{texto}</p>
      <div className="flex justify-center">{acao}</div>
    </div>
  );
}

function faixaDeDatas(dias: DiaPublico[]): string {
  const a = dias[0]!;
  const b = dias[dias.length - 1]!;
  const ra = rotuloDia(a.data, a.diaSemana);
  const rb = rotuloDia(b.data, b.diaSemana);
  return ra.mes === rb.mes
    ? `${ra.numero} a ${rb.numero} de ${ra.mesLongo}`
    : `${ra.numero} ${ra.mes} a ${rb.numero} ${rb.mes}`;
}
