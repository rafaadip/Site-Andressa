import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variante = 'primario' | 'destaque' | 'fantasma' | 'contorno' | 'vidro';

const VARIANTES: Record<Variante, string> = {
  // marfim sobre floresta: 12,26:1 — ação principal, com reflexo no hover
  primario: 'botao-brilho bg-floresta-900 text-ivory-100 border-floresta-900 hover:bg-floresta-700 hover:border-floresta-700 hover:shadow-md',
  // tinta sobre oliva claro: 7,09:1
  destaque: 'bg-oliva-400 text-ink border-oliva-400 hover:bg-oliva-200 hover:border-oliva-200',
  // sobre superfície escura
  fantasma: 'bg-transparent text-texto border-borda-campo hover:border-oliva-200 hover:text-oliva-200',
  // sobre superfície clara
  contorno: 'bg-transparent text-texto border-borda-campo hover:border-ink hover:bg-elevado',
  // vidro sobre marfim/aurora (tinta sobre quase-marfim)
  vidro: 'vidro text-texto hover:bg-elevado',
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
  href, variante = 'primario', larguraTotalMobile = false, nativo = false, icone, children, ...resto
}: Props) {
  // Rota interna → <Link>. Qualquer outra coisa (https, mailto, tel) → <a> nativo.
  const interno = href.startsWith('/') || href.startsWith('#');
  const novaAba = /^https?:/.test(href) && !nativo;
  const classes = [
    'botao inline-flex items-center justify-center gap-2.5',
    'min-h-12 px-7 rounded-full border',
    'font-medium tracking-[.02em] text-[0.96875rem] leading-tight text-center',
    larguraTotalMobile ? 'w-full md:w-auto' : '',
    VARIANTES[variante],
  ].join(' ');
  const conteudo = <>{children}{icone && <span className="botao-icone">{icone}</span>}</>;

  if (!interno || nativo) {
    return (
      <a
        href={href}
        className={classes}
        {...(novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {conteudo}
      </a>
    );
  }
  return <Link href={href} className={classes} {...resto}>{conteudo}</Link>;
}
