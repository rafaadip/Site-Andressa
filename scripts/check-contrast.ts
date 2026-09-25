/**
 * Verifica o contraste WCAG de todos os pares semânticos, lendo os valores
 * REAIS de app/globals.css. Quebra o build se algum reprovar.
 *
 * Existe porque o ouro da marca (#B8874E) reprova para texto pequeno em
 * fundo claro (3,00:1) — um erro fácil de reintroduzir sem perceber.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

function token(nome: string): string {
  const m = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`Token --color-${nome} não encontrado em globals.css`);
  return m[1]!;
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

type Caso = { nome: string; fg: string; bg: string; minimo: number };

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
];

let falhas = 0;
console.log('\n  Contraste WCAG — pares semânticos\n');
for (const c of CASOS) {
  const r = razao(token(c.fg), token(c.bg));
  const ok = r >= c.minimo;
  if (!ok) falhas++;
  console.log(
    `  ${ok ? '✓' : '✗'} ${c.nome.padEnd(34)} ${String(r).padStart(6)} ` +
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

if (falhas > 0) {
  console.error(`\n  ${falhas} par(es) reprovado(s). Corrija os tokens.\n`);
  process.exit(1);
}
console.log(`\n  ${CASOS.length} pares aprovados.\n`);
