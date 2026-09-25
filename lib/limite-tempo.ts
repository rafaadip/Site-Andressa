/**
 * Limite de tempo para dependências que podem pendurar (banco sem resposta).
 *
 * Um banco que ACEITA a conexão e não responde segura a função até o
 * `connect_timeout` do driver — a página fica em branco. Páginas que têm
 * plano B (texto padrão, WhatsApp) não podem esperar isso:
 * tests/nao-funcional/resiliencia.ts mede.
 */
export const ESGOTOU = Symbol('esgotou');

export async function comLimiteDeTempo<T>(p: Promise<T>, ms: number): Promise<T | typeof ESGOTOU> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<typeof ESGOTOU>((r) => { timer = setTimeout(() => r(ESGOTOU), ms); });
  try {
    return await Promise.race([p, limite]);
  } finally {
    clearTimeout(timer);
  }
}
