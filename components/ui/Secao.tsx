import type { ReactNode } from 'react';

type Props = {
  id?: string;
  escura?: boolean;
  superficie?: boolean;
  className?: string;
  children: ReactNode;
  rotulo?: string;
};

/** Seção com ritmo vertical padrão (--section-y, cresce com a tela). */
export function Secao({ id, escura, superficie, className = '', children, rotulo }: Props) {
  const fundo = escura ? 'superficie-escura' : superficie ? 'bg-superficie' : 'bg-fundo';
  return (
    <section
      id={id}
      aria-label={rotulo}
      className={`${fundo} py-[var(--section-y)] ${className}`}
    >
      <div className="wrap">{children}</div>
    </section>
  );
}

type CabecalhoProps = {
  eyebrow: string;
  titulo: ReactNode;
  lead?: string;
  centralizado?: boolean;
  nivel?: 'h1' | 'h2';
};

export function CabecalhoSecao({
  eyebrow, titulo, lead, centralizado, nivel = 'h2',
}: CabecalhoProps) {
  const Titulo = nivel;
  return (
    <header className={`max-w-[40rem] mb-10 lg:mb-14 ${centralizado ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <Titulo className="display text-h2 text-texto mt-3 mb-4 text-balance">{titulo}</Titulo>
      {lead && <p className="text-lead text-texto-2 font-light">{lead}</p>}
    </header>
  );
}
