/**
 * Sessão do /admin — um usuário só, sem tabela de usuários (ADR-006).
 *
 * Cookie `<payload>.<hmac>`: payload em base64url, HMAC-SHA256 com
 * AUTH_SECRET. Na leitura, três portas:
 *   1. assinatura (tempo constante) — cookie forjado não entra;
 *   2. validade (30 dias) — ela não precisa logar toda semana (FASE-09 §2);
 *   3. o e-mail AINDA é o ADMIN_EMAIL — trocar a variável derruba sessões
 *      antigas, "nem com sessão válida do Google" (FASE-09 §6).
 * Girar AUTH_SECRET invalida todas as sessões de uma vez.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { envAuth } from '../env';
import { urlSite } from '../seo';

export const DURACAO_SESSAO_S = 30 * 24 * 3600;

export type Sessao = { email: string; iat: number; exp: number };

/** `__Host-` exige HTTPS; em localhost (http) o nome é outro. */
export function seguro(): boolean {
  return urlSite().startsWith('https://');
}
export const nomeCookieSessao = () => (seguro() ? '__Host-admin' : 'admin_sessao');
export const nomeCookieOauth = () => (seguro() ? '__Host-oauth' : 'oauth_estado');

function assinatura(dados: string, segredo: string): Buffer {
  return createHmac('sha256', segredo).update(`sessao|${dados}`).digest();
}

export function criarSessao(email: string, agora = Date.now(), segredo = envAuth().AUTH_SECRET): string {
  const s: Sessao = { email: email.toLowerCase(), iat: Math.floor(agora / 1000), exp: Math.floor(agora / 1000) + DURACAO_SESSAO_S };
  const dados = Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
  return `${dados}.${assinatura(dados, segredo).toString('base64url')}`;
}

export function lerSessao(valor: string | undefined | null, agora = Date.now()): Sessao | null {
  if (!valor) return null;
  let env: ReturnType<typeof envAuth>;
  try { env = envAuth(); } catch { return null; }         // painel não configurado

  const [dados, assin] = valor.split('.');
  if (!dados || !assin) return null;
  const esperada = assinatura(dados, env.AUTH_SECRET);
  const recebida = Buffer.from(assin, 'base64url');
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  try {
    const s = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8')) as Sessao;
    if (typeof s.exp !== 'number' || s.exp * 1000 <= agora) return null;
    if (s.email !== env.ADMIN_EMAIL) return null;
    return s;
  } catch {
    return null;
  }
}

export function opcoesCookie(maxAgeS: number) {
  return {
    httpOnly: true,
    secure: seguro(),
    // Lax: o retorno do OAuth é navegação de topo vinda do Google.
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeS,
  };
}
