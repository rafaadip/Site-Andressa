/**
 * Guardas do painel para Server Components e Server Actions.
 *
 * O proxy.ts já barra /admin sem sessão; isto é a SEGUNDA porta, dentro de
 * cada página e de cada ação (uma Server Action é um POST que pode ser
 * disparado por fora da navegação normal).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { lerSessao, nomeCookieSessao, type Sessao } from './sessao';

export async function sessaoAtual(): Promise<Sessao | null> {
  const c = await cookies();
  return lerSessao(c.get(nomeCookieSessao())?.value);
}

/** Páginas: sem sessão, vai para o login. */
export async function exigirAdmin(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect('/admin/entrar');
  return s;
}

export class NaoAutorizadoError extends Error {
  constructor() { super('Sessão expirada. Entre de novo.'); this.name = 'NaoAutorizadoError'; }
}

/** Ações: sem sessão, lança (a UI mostra "entre de novo"). */
export async function exigirAdminAcao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) throw new NaoAutorizadoError();
  return s;
}
