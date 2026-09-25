/**
 * Fontes via next/font/google: baixadas NO BUILD e servidas do próprio
 * domínio. Nenhuma requisição ao Google em tempo de execução — o que evita
 * expor o IP do visitante (ADR-005) e elimina o salto de layout (CLS).
 *
 * `preload` só nas duas que aparecem acima da dobra.
 */
import { Playfair_Display, Jost, Cormorant_Garamond } from 'next/font/google';

export const fonteDisplay = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--fonte-display',
});

export const fonteSans = Jost({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--fonte-sans',
});

/** Só para a citação — uma por página. */
export const fonteCitacao = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['500'],
  style: ['italic'],
  display: 'swap',
  preload: false,
  variable: '--fonte-citacao',
});
