'use client';

/**
 * Formulário de contato: grava o pedido (POST /api/contatos, validado de
 * novo no servidor) para a médica ver no painel e abre o WhatsApp do
 * consultório com a mensagem já personalizada.
 *
 * O WhatsApp abre no MESMO toque, sem esperar a API: `window.open` depois
 * de um `await` é barrado pelo bloqueador de pop-up do Safari, e o paciente
 * não pode ficar sem canal se o registro falhar. O pedido vai com
 * `keepalive` (sobrevive à troca de aba) e, se gravar, a tela confirma.
 *
 * Validação: lib/validation/contato.ts (lista de permitidos). O erro de um
 * campo aparece ao sair dele e é refeito a cada tecla dali em diante; no
 * envio, todos os erros aparecem e o foco vai para o primeiro inválido.
 * Obrigatórios: nome, sobrenome, e-mail, idade e motivo.
 */
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { FORMULARIO_CONTATO } from '@/lib/content/site';
import { linkWhatsApp, mensagemContato } from '@/lib/contato';
import { mascararTelefone } from '@/lib/telefone';
import {
  CONTATO_VAZIO, LIMITES_CONTATO, validarContato,
  type CampoContato, type FormularioContatoDados,
} from '@/lib/validation/contato';
import { Campo, CampoSelecao } from '@/components/agendamento/Campo';

const T = FORMULARIO_CONTATO;
/** Ordem visual — é nela que o foco procura o primeiro erro. */
const ORDEM: CampoContato[] = ['nome', 'sobrenome', 'telefone', 'email', 'idade', 'horario', 'motivo', 'consentimento'];
const id = (campo: CampoContato) => `contato-${campo}`;

export function FormularioContato() {
  const [dados, setDados] = useState<FormularioContatoDados>(CONTATO_VAZIO);
  const [tocados, setTocados] = useState<Partial<Record<CampoContato, boolean>>>({});
  const [enviado, setEnviado] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const iscaRef = useRef<HTMLInputElement>(null);

  const validacao = validarContato(dados);
  const erroDe = (campo: CampoContato) =>
    tocados[campo] && !validacao.ok ? validacao.erros[campo] : undefined;

  function mudar(campo: CampoContato, valor: string | boolean) {
    setDados((d) => ({ ...d, [campo]: valor }));
    setEnviado(false);
    setRegistrado(false);
  }
  const sair = (campo: CampoContato) => setTocados((t) => ({ ...t, [campo]: true }));

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!validacao.ok) {
      setTocados(Object.fromEntries(ORDEM.map((c) => [c, true])));
      const primeiro = ORDEM.find((c) => validacao.erros[c]);
      if (primeiro) formRef.current?.querySelector<HTMLElement>(`[name="${id(primeiro)}"]`)?.focus();
      return;
    }
    // Registro para o painel: em paralelo, sem segurar o WhatsApp.
    fetch('/api/contatos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dados, site: iscaRef.current?.value ?? '' }),
      keepalive: true,
    }).then((r) => { if (r.ok) setRegistrado(true); }).catch(() => { /* o WhatsApp já abriu */ });

    // Só dados já validados e normalizados chegam aqui; o link os codifica.
    const url = linkWhatsApp(mensagemContato(validacao.dados));
    // Sem 'noopener' nos recursos: com ele, window.open devolve SEMPRE null
    // (especificação) e pareceria bloqueado — abria o WhatsApp duas vezes e
    // tirava o site da tela. O opener é cortado logo depois, com o mesmo efeito.
    const aba = window.open(url, '_blank');
    if (aba) aba.opener = null;
    else window.location.assign(url);   // bloqueador de pop-up: mesma aba
    setEnviado(true);
  }

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      noValidate
      aria-labelledby="titulo-formulario-contato"
      className="relative rounded-[1.5rem] border border-borda bg-elevado p-6 shadow-sm md:p-8"
    >
      <h3 id="titulo-formulario-contato" className="titulo-display text-[1.625rem] text-texto md:text-[1.875rem]">
        {T.titulo}
      </h3>
      <p className="mt-2 text-texto-2 leading-relaxed">{T.lead}</p>
      <p className="mt-5 text-sm text-texto-2"><span aria-hidden className="text-danger">*</span> Campos obrigatórios</p>

      <div className="mt-5 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Campo
            id={id('nome')} rotulo={T.rotulos.nome} obrigatorio
            autoComplete="given-name" autoCapitalize="words" maxLength={LIMITES_CONTATO.nome}
            value={dados.nome} erro={erroDe('nome')}
            onChange={(e) => mudar('nome', e.target.value)} onBlur={() => sair('nome')}
          />
          <Campo
            id={id('sobrenome')} rotulo={T.rotulos.sobrenome} obrigatorio
            autoComplete="family-name" autoCapitalize="words" maxLength={LIMITES_CONTATO.nome}
            value={dados.sobrenome} erro={erroDe('sobrenome')}
            onChange={(e) => mudar('sobrenome', e.target.value)} onBlur={() => sair('sobrenome')}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_9rem]">
          <Campo
            id={id('telefone')} rotulo={T.rotulos.telefone}
            type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678"
            maxLength={LIMITES_CONTATO.telefone}
            value={dados.telefone} erro={erroDe('telefone')}
            onChange={(e) => mudar('telefone', mascararTelefone(e.target.value))} onBlur={() => sair('telefone')}
          />
          <Campo
            id={id('idade')} rotulo={T.rotulos.idade} obrigatorio
            inputMode="numeric" autoComplete="off" maxLength={LIMITES_CONTATO.idade}
            value={dados.idade} erro={erroDe('idade')}
            // Só dígitos entram no campo: nada de "30 anos", "e", "-" ou colagem de texto.
            onChange={(e) => mudar('idade', e.target.value.replace(/\D/g, '').slice(0, LIMITES_CONTATO.idade))}
            onBlur={() => sair('idade')}
          />
        </div>

        <Campo
          id={id('email')} rotulo={T.rotulos.email} obrigatorio
          type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          maxLength={LIMITES_CONTATO.email}
          value={dados.email} erro={erroDe('email')}
          onChange={(e) => mudar('email', e.target.value)} onBlur={() => sair('email')}
        />

        <fieldset aria-describedby={erroDe('horario') ? `${id('horario')}-erro` : undefined}>
          <legend className="mb-2 font-medium text-texto">
            {T.rotulos.horario} <span className="font-light text-texto-2">(opcional)</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {T.horarios.map((h) => (
              <label key={h.id} className="relative">
                <input
                  type="radio"
                  name={id('horario')}
                  value={h.id}
                  checked={dados.horario === h.id}
                  onChange={() => { mudar('horario', h.id); sair('horario'); }}
                  className="peer sr-only"
                />
                <span
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-borda-campo px-3
                             text-texto transition-colors peer-checked:border-espresso-900 peer-checked:bg-espresso-900
                             peer-checked:text-ivory-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2
                             peer-focus-visible:outline-[var(--focus-ring)]"
                >
                  {h.rotulo}
                </span>
              </label>
            ))}
          </div>
          {erroDe('horario') && (
            <p id={`${id('horario')}-erro`} role="alert" className="mt-2 text-sm text-danger">{erroDe('horario')}</p>
          )}
        </fieldset>

        <CampoSelecao
          id={id('motivo')} rotulo={T.rotulos.motivo} obrigatorio
          value={dados.motivo} erro={erroDe('motivo')}
          onChange={(e) => { mudar('motivo', e.target.value); sair('motivo'); }}
          onBlur={() => sair('motivo')}
        >
          <option value="" disabled>{T.selecione}</option>
          {T.motivos.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
        </CampoSelecao>

        <div>
          {/* O rótulo inteiro é a área de toque — o checkbox sozinho é pequeno. */}
          <label htmlFor={id('consentimento')} className="flex cursor-pointer gap-3.5 text-sm text-texto-2">
            <input
              id={id('consentimento')}
              name={id('consentimento')}
              type="checkbox"
              checked={dados.consentimento}
              onChange={(e) => { mudar('consentimento', e.target.checked); sair('consentimento'); }}
              aria-required
              aria-invalid={Boolean(erroDe('consentimento'))}
              aria-describedby={erroDe('consentimento') ? `${id('consentimento')}-erro` : undefined}
              className="mt-0.5 size-6 min-h-0 shrink-0 cursor-pointer accent-espresso-900"
            />
            <span className="leading-relaxed">
              {T.consentimento.texto}{' '}
              <Link href="/politica-de-privacidade" target="_blank" className="font-medium text-acento underline underline-offset-4">
                {T.consentimento.link}
              </Link>.
              <span aria-hidden className="text-danger"> *</span>
            </span>
          </label>
          {erroDe('consentimento') && (
            <p id={`${id('consentimento')}-erro`} role="alert" className="mt-2 pl-[2.375rem] text-sm text-danger">
              {erroDe('consentimento')}
            </p>
          )}
        </div>

        {/* Isca para robôs: fora da tela, fora do Tab e do leitor de tela. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>{T.isca}<input ref={iscaRef} type="text" name="site" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>
      </div>

      <button
        type="submit"
        className="botao botao-brilho mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border
                   border-espresso-900 bg-espresso-900 px-7 font-medium tracking-[.02em] text-ivory-100
                   hover:border-espresso-700 hover:bg-espresso-700"
      >
        <MessageCircle aria-hidden size={18} strokeWidth={1.75} />
        {T.botao}
      </button>
      <div role="status" className="mt-3 space-y-1 text-sm font-medium text-texto">
        {enviado && <p>{T.enviado}</p>}
        {registrado && <p>{T.registrado}</p>}
      </div>
    </form>
  );
}
