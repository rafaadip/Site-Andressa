/**
 * Fontes via next/font/google: baixadas NO BUILD e servidas do próprio
 * domínio. Nenhuma requisição ao Google em tempo de execução — o que evita
 * expor o IP do visitante (ADR-005) e elimina o salto de layout (CLS).
 *
 * Tipografia (redesenho de 26/09/2026):
 *   - Fraunces — títulos e a citação. Serifa contemporânea, variável, com
 *     eixo de tamanho óptico (opsz): o desenho se ajusta sozinho do 17 px
 *     de um cartão ao 72 px do hero. O itálico é o destaque da marca.
 *   - DM Sans — texto e interface. Grotesca limpa, muito legível no
 *     celular, com números bem desenhados para horários e telefone.
 *
 * Subconjunto só `latin`: ele já cobre TODO o português (ã, ç, õ, acentos —
 * U+0000–00FF) e a pontuação tipográfica usada (— – · “ ” … e o hífen
 * inseparável, U+2000–206F). `latin-ext` seriam arquivos baixados à toa,
 * disputando banda com o retrato do hero — o LCP no 4G.
 */
import { Fraunces, DM_Sans } from 'next/font/google';

export const fonteDisplay = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--fonte-display',
});

export const fonteSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--fonte-sans',
});
