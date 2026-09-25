/**
 * Guardas do painel para Server Components e Server Actions.
 *
 * O proxy.ts já barra /admin sem sessão; isto é a SEGUNDA porta, dentro de
 * cada página e de cada ação (uma Server Action é um POST que pode ser
 * disparado por fora da navegação normal). Aqui, além da assinatura, a
 * sessão é conferida no BANCO: "Sair" derruba o cookie em todo aparelho,
 * inclusive numa cópia dele (SEC-10). O proxy continua só com a assinatura.
 */
import 'server-only';
import { cache } from 'react';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, schema } from '../db';
import { lerSessao, nomeCookieSessao, type Sessao } from './sessao';

const { practitioner } = schema;

/**
 * A sessão foi emitida DEPOIS do último "Sair"? Um usuário só (ADR-006):
 * a marca mora na linha do profissional. Mesmo segundo do "Sair" = inválida.
 */
export async function sessaoValidaNoServidor(s: Sessao): Promise<boolean> {
  const [p] = await db().select({ depois: practitioner.sessionsValidAfter }).from(practitioner).limit(1);
  return !p?.depois || s.iat > Math.floor(p.depois.getTime() / 1000);
}

/** "Sair": toda sessão emitida até agora deixa de valer, em qualquer aparelho. */
export async function encerrarSessoes(): Promise<void> {
  await db().update(practitioner).set({ sessionsValidAfter: sql`now()` });
}

/** Uma leitura por requisição (layout + página + ação pedem a mesma coisa). */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const c = await cookies();
  const s = lerSessao(c.get(nomeCookieSessao())?.value);
  return s && (await sessaoValidaNoServidor(s)) ? s : null;
});

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
