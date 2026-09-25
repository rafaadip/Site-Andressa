/**
 * Remoção de dado pessoal antes de qualquer coisa sair do processo (log,
 * Sentry). Duas defesas:
 *   1. chaves sensíveis são descartadas pelo NOME;
 *   2. valores com cara de e-mail, telefone ou token são mascarados.
 * A segunda existe porque a primeira depende de disciplina.
 */
const CHAVES_SENSIVEIS = /^(patient_?|paciente|nome|name|email|e_?mail|telefone|phone|motivo|note|token|refresh|access|authorization|cookie|senha|password|ip$)/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Telefone BR com ou sem +55/DDD. Bordas evitam casar datas e UUIDs. */
const TELEFONE = /(?<![\w-])(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?![\w-])/g;
/** Token base64url (link de gestão, OAuth): 32+ chars com maiúscula ou _. */
const TOKEN = /(?<![\w-])(?=[A-Za-z0-9_-]*[A-Z_])[A-Za-z0-9_-]{32,}(?![\w-])/g;

export function mascararTexto(v: string): string {
  return v.replace(EMAIL, '[email]').replace(TOKEN, '[token]').replace(TELEFONE, '[telefone]');
}

export function limparPii(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 5) return '[…]';
  if (typeof valor === 'string') return mascararTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => limparPii(v, profundidade + 1));
  if (valor && typeof valor === 'object') {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      r[k] = CHAVES_SENSIVEIS.test(k) ? '[removido]' : limparPii(v, profundidade + 1);
    }
    return r;
  }
  return valor;
}
