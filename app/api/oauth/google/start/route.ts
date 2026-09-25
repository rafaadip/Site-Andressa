import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { envAuth, googleConfigurado } from '@/lib/env';
import { ESCOPOS_AGENDA, ESCOPOS_LOGIN, urlAutorizacao } from '@/lib/calendar/google';
import { nomeCookieOauth, opcoesCookie } from '@/lib/auth/sessao';
import { sessaoAtual } from '@/lib/auth/admin';
import { urlSite } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/oauth/google/start?proposito=login|agenda
 *
 * login  → openid + email, só para provar quem é (ADR-006).
 * agenda → os DOIS escopos de agenda, offline, com consentimento forçado
 *          (garante refresh token novo ao reconectar) — FASE-05 §2.
 * `state` aleatório em cookie httpOnly de 10 min: proteção CSRF do OAuth.
 */
export async function GET(req: Request) {
  const base = urlSite();
  if (!googleConfigurado()) return NextResponse.redirect(`${base}/admin/entrar?erro=config`);

  const proposito = new URL(req.url).searchParams.get('proposito') === 'agenda' ? 'agenda' : 'login';
  if (proposito === 'agenda' && !(await sessaoAtual())) {
    return NextResponse.redirect(`${base}/admin/entrar`);
  }

  let email: string | undefined;
  try { email = envAuth().ADMIN_EMAIL; } catch {
    return NextResponse.redirect(`${base}/admin/entrar?erro=config`);
  }

  const state = randomBytes(32).toString('base64url');
  const destino = urlAutorizacao({
    redirectUri: `${base}/api/oauth/google/callback`,
    state,
    escopos: proposito === 'agenda' ? ESCOPOS_AGENDA : ESCOPOS_LOGIN,
    offline: proposito === 'agenda',
    loginHint: email,
  });

  const r = NextResponse.redirect(destino);
  r.cookies.set(nomeCookieOauth(), `${proposito}.${state}`, opcoesCookie(600));
  r.headers.set('Cache-Control', 'no-store');
  return r;
}
