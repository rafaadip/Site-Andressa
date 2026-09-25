/**
 * Fontes via next/font/google: baixadas NO BUILD e servidas do próprio
 * domínio. Nenhuma requisição ao Google em tempo de execução — o que evita
 * expor o IP do visitante (ADR-005) e elimina o salto de layout (CLS).
 *
 * `preload` só nas duas que aparecem acima da dobra.
 *
 * Subconjunto só `latin`: ele já cobre TODO o português (ã, ç, õ, acentos —
 * U+0000–00FF) e a pontuação tipográfica usada (— – · “ ” … e o hífen
 * inseparável, U+2000–206F). `latin-ext` é para ą, ő, ł…: com preload, eram
 * 3 arquivos (~80 KB) baixados à toa, disputando banda com o retrato do
 * hero — o LCP no 4G (medido com Lighthouse).
 */
import { Playfair_Display, Jost, Cormorant_Garamond } from 'next/font/google';

export const fonteDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--fonte-display',
});

export const fonteSans = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--fonte-sans',
});

/** Só para a citação — uma por página. */
export const fonteCitacao = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  display: 'swap',
  preload: false,
  variable: '--fonte-citacao',
});
