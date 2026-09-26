/**
 * Cores da marca para onde CSS variável NÃO chega: e-mail (estilo inline,
 * Outlook), imagem OpenGraph (Satori) e `theme-color` do navegador.
 *
 * ⚠️ NÃO é uma segunda paleta. A fonte da verdade é app/globals.css;
 * `npm run check:contrast` confere, valor a valor, que isto aqui é idêntico
 * ao token de lá — e quebra o build se divergir.
 */
export const MARCA = {
  'ivory-50': '#F7F4EC',
  'ivory-100': '#EEE8DB',
  'sand-200': '#E3DCCB',
  'sand-400': '#938B73',
  'oliva-200': '#D3DEBD',
  'oliva-400': '#A7B98A',
  'oliva-500': '#7B9166',
  'oliva-700': '#4E6A3D',
  'floresta-900': '#1D2A1F',
  ink: '#1D2A1F',
  'ink-muted': '#56604F',
  'cream-muted': '#BCC6B0',
  danger: '#A3271F',
} as const;

export type TokenMarca = keyof typeof MARCA;
