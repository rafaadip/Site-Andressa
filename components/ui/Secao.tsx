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
  /** A partir de 1024px, o lead vai para a coluna ao lado do título. */
  lado?: boolean;
  /** Entra com a revelação ao rolar (desligue quando o pai já revela). */
  revelar?: boolean;
};

export function CabecalhoSecao({
  eyebrow, titulo, lead, centralizado, nivel = 'h2', lado, revelar = true,
}: CabecalhoProps) {
  const Titulo = nivel;
  const alinhamento = centralizado
    ? 'mx-auto max-w-[42rem] text-center'
    : lado
      ? 'lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:gap-16'
      : 'max-w-[42rem]';
  return (
    <header data-revelar={revelar ? 'titulo' : undefined} className={`mb-10 lg:mb-16 ${alinhamento}`}>
      <div>
        <p className={`eyebrow ${centralizado ? '' : 'eyebrow-fio'}`}>{eyebrow}</p>
        <Titulo className="titulo-display titulo-mascara text-h2 text-texto mt-4">{titulo}</Titulo>
      </div>
      {lead && (
        <p className={`titulo-lead text-lead text-texto-2 text-pretty ${lado ? 'mt-5 lg:mt-0 lg:pb-1.5' : 'mt-5'} ${centralizado ? 'mx-auto max-w-[36rem]' : 'max-w-[40rem]'}`}>
          {lead}
        </p>
      )}
    </header>
  );
}
