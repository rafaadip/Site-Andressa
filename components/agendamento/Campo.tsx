import { AlertCircle } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Base = {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  extra?: ReactNode;
};

const CLASSE_CAMPO =
  'w-full rounded-md border bg-elevado px-4 text-base text-texto placeholder:text-ink-subtle ' +
  'border-borda-campo transition-colors aria-[invalid=true]:border-danger aria-[invalid=true]:border-2';

function Rotulo({ id, rotulo, obrigatorio }: Pick<Base, 'id' | 'rotulo' | 'obrigatorio'>) {
  return (
    <label htmlFor={id} className="mb-2 block font-medium text-texto">
      {rotulo}
      {obrigatorio
        ? <span aria-hidden className="text-danger"> *</span>
        : <span className="font-light text-texto-2"> (opcional)</span>}
    </label>
  );
}

/** Erro abaixo do campo, com ícone E texto — nunca só cor (WCAG 1.4.1). */
function Rodape({ id, ajuda, erro, extra }: Pick<Base, 'id' | 'ajuda' | 'erro' | 'extra'>) {
  return (
    <>
      {erro && (
        <p id={`${id}-erro`} role="alert" className="mt-2 flex gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden size={16} strokeWidth={2} className="mt-[.2rem] shrink-0" />
          <span>{erro}</span>
        </p>
      )}
      {extra}
      {ajuda && <p id={`${id}-ajuda`} className="mt-2 text-sm text-texto-2">{ajuda}</p>}
    </>
  );
}

function descritoPor(id: string, ajuda?: ReactNode, erro?: string) {
  return [erro && `${id}-erro`, ajuda && `${id}-ajuda`].filter(Boolean).join(' ') || undefined;
}

export function Campo({ id, rotulo, obrigatorio, ajuda, erro, extra, ...input }:
  Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} obrigatorio={obrigatorio} />
      <input
        id={id}
        name={id}
        required={obrigatorio}
        aria-required={obrigatorio}
        aria-invalid={Boolean(erro)}
        aria-describedby={descritoPor(id, ajuda, erro)}
        className={`${CLASSE_CAMPO} min-h-12`}
        {...input}
      />
      <Rodape id={id} ajuda={ajuda} erro={erro} extra={extra} />
    </div>
  );
}

export function CampoTexto({ id, rotulo, obrigatorio, ajuda, erro, extra, ...area }:
  Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <Rotulo id={id} rotulo={rotulo} obrigatorio={obrigatorio} />
      <textarea
        id={id}
        name={id}
        aria-invalid={Boolean(erro)}
        aria-describedby={descritoPor(id, ajuda, erro)}
        className={`${CLASSE_CAMPO} min-h-28 py-3 resize-y`}
        {...area}
      />
      <Rodape id={id} ajuda={ajuda} erro={erro} extra={extra} />
    </div>
  );
}
