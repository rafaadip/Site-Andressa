import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variante = 'ouro' | 'espresso' | 'fantasma' | 'contorno';

const VARIANTES: Record<Variante, string> = {
  // tinta sobre ouro: 7,08:1
  ouro: 'bg-gold-400 text-ink border-gold-400 hover:bg-gold-200 hover:border-gold-200',
  // marfim sobre espresso: 14,9:1
  espresso: 'bg-espresso-900 text-ivory-100 border-espresso-900 hover:bg-espresso-700 hover:border-espresso-700',
  // sobre superfície escura
  fantasma: 'bg-transparent text-texto border-borda-campo hover:border-gold-200 hover:text-gold-200',
  // sobre superfície clara
  contorno: 'bg-transparent text-texto border-borda-campo hover:border-ink',
};

type Props = {
  href: string;
  variante?: Variante;
  /** Largura total abaixo de 768px — alvo grande, alcance do polegar. */
  larguraTotalMobile?: boolean;
  /** Força <a> nativo na mesma aba (ex.: download de .ics, rota de API). */
  nativo?: boolean;
  icone?: ReactNode;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, 'href' | 'className' | 'children'>;

export function Botao({
  href, variante = 'ouro', larguraTotalMobile = false, nativo = false, icone, children, ...resto
}: Props) {
  // Rota interna → <Link>. Qualquer outra coisa (https, mailto, tel) → <a> nativo.
  const interno = href.startsWith('/') || href.startsWith('#');
  const novaAba = /^https?:/.test(href) && !nativo;
  const classes = [
    'inline-flex items-center justify-center gap-2.5',
    'min-h-12 px-7 rounded-full border',
    'font-medium tracking-[.03em] text-[0.96875rem] leading-tight text-center',
    'transition-[background-color,border-color,color,transform] duration-200',
    'active:scale-[.98]',
    larguraTotalMobile ? 'w-full md:w-auto' : '',
    VARIANTES[variante],
  ].join(' ');

  if (!interno || nativo) {
    return (
      <a
        href={href}
        className={classes}
        {...(novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}{icone}
      </a>
    );
  }
  return <Link href={href} className={classes} {...resto}>{children}{icone}</Link>;
}
