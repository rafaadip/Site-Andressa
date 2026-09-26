/**
 * Verifica o contraste WCAG de todos os pares semânticos, lendo os valores
 * REAIS de app/globals.css. Quebra o build se algum reprovar.
 *
 * Existe porque o ouro da marca (#B8874E) reprova para texto pequeno em
 * fundo claro (3,00:1) — um erro fácil de reintroduzir sem perceber.
 *
 * Texto sobre VIDRO: o fundo real é a tinta do vidro composta sobre o que
 * passa por trás. Cada caso de vidro compõe o material (opacidade lida dos
 * tokens --vidro-*) sobre o PIOR fundo daquele uso — sem contar o brilho de
 * topo nem o desfoque, que só ajudam. Baixou a opacidade? O build acusa.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MARCA } from '../lib/marca';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

function token(nome: string): string {
  const m = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`Token --color-${nome} não encontrado em globals.css`);
  return m[1]!;
}

/** Opacidade de um material de vidro, ex.: `--vidro-fino: 60%` → 0.6. */
function opacidade(nome: string): number {
  const m = css.match(new RegExp(`--${nome}:\\s*(\\d+(?:\\.\\d+)?)%`));
  if (!m) throw new Error(`Token --${nome} não encontrado em globals.css`);
  return Number(m[1]) / 100;
}

/** Tinta com opacidade `alfa` sobre um fundo sólido (composição em sRGB, como o navegador). */
function compor(tinta: string, alfa: number, fundo: string): string {
  const [a, b] = [parseInt(tinta.slice(1), 16), parseInt(fundo.slice(1), 16)];
  const canal = (d: number) => Math.round(alfa * ((a >> d) & 255) + (1 - alfa) * ((b >> d) & 255));
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`;
}

function luminancia(hex: string): number {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}

function razao(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** `bg` é um token; com `vidro`, o fundo vira a tinta do material composta sobre `bg`. */
type Caso = {
  nome: string; fg: string; bg: string; minimo: number;
  vidro?: { tinta: string; opacidade: string };
};

const BRANCO = '#FFFFFF';
const VIDRO_CLARO = (opacidade: string) => ({ tinta: 'ivory-50', opacidade });

const CASOS: Caso[] = [
  // ── Sobre marfim ──────────────────────────────────────────
  { nome: 'texto principal / marfim',    fg: 'ink',        bg: 'ivory-50', minimo: 4.5 },
  { nome: 'texto secundário / marfim',   fg: 'ink-muted',  bg: 'ivory-50', minimo: 4.5 },
  { nome: 'TEXTO em ouro / marfim',      fg: 'gold-700',   bg: 'ivory-50', minimo: 4.5 },
  { nome: 'erro / marfim',               fg: 'danger',     bg: 'ivory-50', minimo: 4.5 },
  { nome: 'sucesso / marfim',            fg: 'success',    bg: 'ivory-50', minimo: 4.5 },
  { nome: 'texto principal / superfície',fg: 'ink',        bg: 'ivory-100', minimo: 4.5 },
  { nome: 'texto secundário / superfície',fg: 'ink-muted', bg: 'ivory-100', minimo: 4.5 },
  // ── Componentes de UI (WCAG 1.4.11 → 3:1) ─────────────────
  { nome: 'borda de campo / marfim',     fg: 'sand-400',   bg: 'ivory-50', minimo: 3.0 },
  { nome: 'anel de foco / marfim',       fg: 'gold-700',   bg: 'ivory-50', minimo: 3.0 },
  { nome: 'ouro decorativo / marfim',    fg: 'gold-500',   bg: 'ivory-50', minimo: 3.0 },
  // ── Sobre espresso ────────────────────────────────────────
  { nome: 'texto claro / espresso',      fg: 'ivory-100',  bg: 'espresso-900', minimo: 4.5 },
  { nome: 'secundário / espresso',       fg: 'cream-muted',bg: 'espresso-900', minimo: 4.5 },
  { nome: 'acento ouro / espresso',      fg: 'gold-200',   bg: 'espresso-900', minimo: 4.5 },
  { nome: 'erro / espresso',             fg: 'danger-dark',bg: 'espresso-900', minimo: 4.5 },
  { nome: 'sucesso / espresso',          fg: 'success-dark',bg: 'espresso-900', minimo: 4.5 },
  { nome: 'texto claro / espresso-800',  fg: 'ivory-100',  bg: 'espresso-800', minimo: 4.5 },
  // ── Botões ────────────────────────────────────────────────
  { nome: 'tinta / botão ouro',          fg: 'ink',        bg: 'gold-400', minimo: 4.5 },
  { nome: 'marfim / botão espresso',     fg: 'ivory-100',  bg: 'espresso-900', minimo: 4.5 },
  // ── Vidro (tinta composta sobre o PIOR fundo de cada uso) ──
  // Fino: selos sobre o retrato (cabelo escuro ≈ espresso) e botão de vidro.
  { nome: 'tinta / vidro fino sobre espresso',  fg: 'ink',       bg: 'espresso-900', minimo: 4.5, vidro: VIDRO_CLARO('vidro-fino') },
  // Regular: credenciais e painel de agendar, sobre halos de ouro (≈ areia).
  { nome: 'tinta / vidro regular sobre areia',  fg: 'ink',       bg: 'sand-200', minimo: 4.5, vidro: VIDRO_CLARO('vidro-regular') },
  { nome: 'secundário / vidro regular s/ areia',fg: 'ink-muted', bg: 'sand-200', minimo: 4.5, vidro: VIDRO_CLARO('vidro-regular') },
  { nome: 'TEXTO ouro / vidro regular s/ areia',fg: 'gold-700',  bg: 'sand-200', minimo: 4.5, vidro: VIDRO_CLARO('vidro-regular') },
  { nome: 'tinta / vidro regular sobre espresso',fg: 'ink',      bg: 'espresso-900', minimo: 4.5, vidro: VIDRO_CLARO('vidro-regular') },
  // Espesso: cabeçalho, menu e barra de ações — qualquer coisa passa por baixo.
  { nome: 'secundário / vidro espesso s/ espresso', fg: 'ink-muted', bg: 'espresso-900', minimo: 4.5, vidro: VIDRO_CLARO('vidro-espesso') },
  // Espesso escuro: cabeçalho sobre seção escura; pior caso, borda sobre marfim.
  { nome: 'claro / vidro escuro sobre marfim',  fg: 'ivory-100',   bg: 'ivory-50', minimo: 4.5, vidro: { tinta: 'espresso-900', opacidade: 'vidro-escuro' } },
  { nome: 'secundário / vidro escuro s/ marfim',fg: 'cream-muted', bg: 'ivory-50', minimo: 4.5, vidro: { tinta: 'espresso-900', opacidade: 'vidro-escuro' } },
  // Cartões escuros: véu branco sobre o halo da seção (≈ espresso-800).
  { nome: 'secundário / cartão de vidro escuro',fg: 'cream-muted', bg: 'espresso-800', minimo: 4.5, vidro: { tinta: BRANCO, opacidade: 'vidro-realce-escuro' } },
  { nome: 'acento ouro / cartão de vidro escuro',fg: 'gold-200',   bg: 'espresso-800', minimo: 4.5, vidro: { tinta: BRANCO, opacidade: 'vidro-realce-escuro' } },
];

let falhas = 0;
console.log('\n  Contraste WCAG — pares semânticos\n');
for (const c of CASOS) {
  const fundo = c.vidro
    ? compor(c.vidro.tinta.startsWith('#') ? c.vidro.tinta : token(c.vidro.tinta), opacidade(c.vidro.opacidade), token(c.bg))
    : token(c.bg);
  const r = razao(token(c.fg), fundo);
  const ok = r >= c.minimo;
  if (!ok) falhas++;
  console.log(
    `  ${ok ? '✓' : '✗'} ${c.nome.padEnd(40)} ${String(r).padStart(6)} ` +
    `(mín. ${c.minimo})`,
  );
}

// Guarda-corpo: o ouro decorativo NÃO pode ser promovido a texto.
const ouroTexto = razao(token('gold-500'), token('ivory-50'));
if (ouroTexto >= 4.5) {
  console.log(
    `\n  ⚠ gold-500 agora passa em ${ouroTexto}:1 para texto. ` +
    'Se foi intencional, atualize este script e a FASE-01.',
  );
}

// lib/marca.ts (e-mail, OpenGraph, theme-color) é espelho, não segunda
// paleta: cada valor precisa ser IDÊNTICO ao token de globals.css.
let divergentes = 0;
for (const [nome, hex] of Object.entries(MARCA)) {
  const real = token(nome);
  if (real.toLowerCase() !== hex.toLowerCase()) {
    divergentes++;
    console.error(`  ✗ lib/marca.ts: ${nome} = ${hex}, mas globals.css diz ${real}`);
  }
}

if (falhas > 0 || divergentes > 0) {
  if (falhas > 0) console.error(`\n  ${falhas} par(es) reprovado(s). Corrija os tokens.`);
  if (divergentes > 0) console.error(`\n  ${divergentes} cor(es) de lib/marca.ts fora de sincronia com globals.css.`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ${CASOS.length} pares aprovados · lib/marca.ts em sincronia (${Object.keys(MARCA).length} cores).\n`);
