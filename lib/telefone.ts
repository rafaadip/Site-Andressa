/**
 * Telefone brasileiro: máscara, validação e normalização E.164.
 * DDDs válidos segundo o plano de numeração da Anatel.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos nacionais (sem o 55), até 11. */
export function digitosNacionais(valor: string): string {
  let d = valor.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

export function telefoneValido(valor: string): boolean {
  const d = digitosNacionais(valor);
  if (d.length !== 10 && d.length !== 11) return false;
  if (!DDDS.has(Number(d.slice(0, 2)))) return false;
  // Celular: 11 dígitos começando com 9. Fixo: 10 dígitos começando com 2–5.
  if (d.length === 11) return d[2] === '9';
  return /[2-5]/.test(d[2]!);
}

/** "11998053826" → "+5511998053826" */
export function normalizarTelefone(valor: string): string {
  return `+55${digitosNacionais(valor)}`;
}

/** Máscara progressiva enquanto digita: (11) 99805-3826 */
export function mascararTelefone(valor: string): string {
  const d = digitosNacionais(valor);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const celular = resto.startsWith('9');
  const corte = celular ? 5 : 4;
  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte, corte + 4)}`;
}
