/**
 * Cores da marca para onde CSS variável NÃO chega: e-mail (estilo inline,
 * Outlook), imagem OpenGraph (Satori) e `theme-color` do navegador.
 *
 * ⚠️ NÃO é uma segunda paleta. A fonte da verdade é app/globals.css;
 * `npm run check:contrast` confere, valor a valor, que isto aqui é idêntico
 * ao token de lá — e quebra o build se divergir.
 */
export const MARCA = {
  'ivory-50': '#FBF8F3',
  'ivory-100': '#F5EFE5',
  'sand-200': '#E9DDCA',
  'sand-400': '#A08A68',
  'gold-200': '#EBD9BC',
  'gold-400': '#C9A06A',
  'gold-500': '#B8874E',
  'gold-700': '#8A6230',
  'espresso-900': '#241A13',
  ink: '#241A13',
  'ink-muted': '#6B5A4B',
  'cream-muted': '#C4B5A3',
  danger: '#A3271F',
} as const;

export type TokenMarca = keyof typeof MARCA;
