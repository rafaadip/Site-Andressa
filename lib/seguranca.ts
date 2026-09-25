/**
 * Tokens e hashes do agendamento.
 *
 * - Link de gestão (/consulta/<token>): 32 bytes aleatórios. No banco fica só
 *   o HASH — um vazamento do banco não entrega os links.
 * - IP do consentimento: guardamos SHA-256(ip + sal). Prova que houve
 *   consentimento vindo daquela origem sem armazenar o IP (LGPD, minimização).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { envSeguranca } from './env';

export function novoTokenGestao(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Token do link de gestão, DERIVADO do agendamento + Idempotency-Key.
 *
 * Por quê: no banco só existe o hash do token. Se a resposta do POST se
 * perde (4G ruim) e o navegador reenvia com a mesma chave, o servidor
 * precisa devolver o MESMO link — então ele tem que ser recomputável.
 * HMAC com o sal do servidor: quem tem só a chave de idempotência (gerada
 * no navegador do paciente) não consegue calcular o token.
 */
export function tokenGestaoPara(agendamentoId: string, idempotencyKey: string): string {
  return createHmac('sha256', envSeguranca().TOKEN_SALT)
    .update(`gestao|${agendamentoId}|${idempotencyKey}`)
    .digest('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(`${envSeguranca().TOKEN_SALT}|token|${token}`).digest('hex');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${envSeguranca().TOKEN_SALT}|ip|${ip}`).digest('hex');
}

/** Comparação em tempo constante — não vaza, pelo tempo, quantos caracteres batem. */
export function hashesIguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Formato válido de token (evita consulta ao banco com lixo). */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** IP do cliente atrás do proxy da Vercel. */
export function ipDaRequisicao(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || '0.0.0.0';
}
