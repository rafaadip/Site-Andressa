/**
 * Tokens e hashes do agendamento.
 *
 * - Link de gestão (/consulta/<token>): 32 bytes (HMAC-SHA256). No banco fica só
 *   o HASH — um vazamento do banco não entrega os links.
 * - IP do consentimento: guardamos SHA-256(ip + sal). Prova que houve
 *   consentimento vindo daquela origem sem armazenar o IP (LGPD, minimização).
 */
import { createHash, createHmac } from 'node:crypto';
import { envSeguranca } from './env';

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

/** Formato válido de token (evita consulta ao banco com lixo). */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * IP do cliente atrás do proxy da Vercel. A Vercel SOBRESCREVE
 * `x-forwarded-for` com o IP real — o cliente não consegue forjá-lo lá.
 * ⚠️ Fora da Vercel (outro proxy, CDN na frente) o cliente escolhe esse
 * valor: só a Vercel é suportada (docs/SEGURANCA.md, SEC-08).
 * Usado só para o limite por hora e, com hash, como prova do consentimento.
 */
export function ipDaRequisicao(headers: Headers): string {
  return origemParaLimite(headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')?.trim()
    || '0.0.0.0');
}

/**
 * IPv6 agrupado por /64: um único cliente costuma ter o /64 inteiro
 * (2^64 endereços) e trocaria de "origem" a cada requisição (SEC-08).
 * IPv4 (inclusive mapeado em IPv6) fica como está.
 */
export function origemParaLimite(ip: string): string {
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4) return v4[1]!;
  if (!ip.includes(':')) return ip;
  const [esquerda = '', direita] = ip.split('%')[0]!.toLowerCase().split('::');
  const a = esquerda ? esquerda.split(':') : [];
  const b = direita ? direita.split(':') : [];
  const grupos = direita === undefined ? a : [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return `${grupos.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
