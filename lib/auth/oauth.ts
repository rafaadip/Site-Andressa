/**
 * Conclusão dos dois fluxos OAuth do Google (login do painel e conexão da
 * agenda). Separado da rota para ser testável sem HTTP.
 */
import { timingSafeEqual } from 'node:crypto';
import { db, schema } from '../db';
import { envAuth } from '../env';
import { AgendaGoogle, ESCOPOS_AGENDA, emailDoIdToken, type Tokens } from '../calendar/google';
import { salvarConexao } from '../calendar/conexao';
import { registrarCanal } from '../calendar/canal';
import { reenfileirarFuturas } from '../calendar/sincronizar';
import { log } from '../log';

export type Proposito = 'login' | 'agenda';

/** Cookie `proposito.state` × `state` da URL, em tempo constante. */
export function conferirEstado(cookie: string | undefined, stateUrl: string | null): Proposito | null {
  if (!cookie || !stateUrl) return null;
  const [proposito, esperado] = cookie.split('.');
  if ((proposito !== 'login' && proposito !== 'agenda') || !esperado) return null;
  const a = Buffer.from(esperado);
  const b = Buffer.from(stateUrl);
  return a.length === b.length && timingSafeEqual(a, b) ? proposito : null;
}

export type ResultadoLogin = { ok: true; email: string } | { ok: false; motivo: 'token' | 'conta' };

/** Login: a conta do Google PRECISA ser o ADMIN_EMAIL, com e-mail verificado. */
export async function concluirLogin(tokens: Tokens): Promise<ResultadoLogin> {
  const id = tokens.id_token ? emailDoIdToken(tokens.id_token) : null;
  if (!id) return { ok: false, motivo: 'token' };
  const permitido = id.verificado && id.email === envAuth().ADMIN_EMAIL;
  await db().insert(schema.auditLog).values({
    actor: 'practitioner', action: permitido ? 'admin.login' : 'admin.login_denied', meta: {},
  });
  return permitido ? { ok: true, email: id.email } : { ok: false, motivo: 'conta' };
}

export type ResultadoAgenda =
  | { ok: true; email: string; canal: boolean }
  | { ok: false; motivo: 'escopo' | 'sem-refresh' | 'conta' | 'agenda-real' };

/**
 * Conexão da agenda: exatamente os dois escopos, refresh token presente,
 * conta = ADMIN_EMAIL e — fora da produção — nunca a agenda real.
 */
export async function concluirConexaoAgenda(practitionerId: string, tokens: Tokens): Promise<ResultadoAgenda> {
  const concedidos = new Set(tokens.scope.split(/\s+/));
  if (!ESCOPOS_AGENDA.every((e) => concedidos.has(e))) return { ok: false, motivo: 'escopo' };
  if (!tokens.refresh_token) return { ok: false, motivo: 'sem-refresh' };

  const email = await new AgendaGoogle(async () => tokens.access_token, 'primary').emailDaConta();
  if (email !== envAuth().ADMIN_EMAIL) return { ok: false, motivo: 'conta' };

  let conexao;
  try {
    conexao = await salvarConexao({ practitionerId, emailConta: email, refreshToken: tokens.refresh_token });
  } catch (e) {
    log.aviso('google.conectar.recusado', { tipo: e instanceof Error ? e.name : 'erro' });
    return { ok: false, motivo: 'agenda-real' };
  }

  let canal = false;
  try { canal = await registrarCanal(conexao); } catch (e) { log.excecao('google.canal.registro', e); }
  await reenfileirarFuturas(practitionerId);
  await db().insert(schema.auditLog).values({ actor: 'practitioner', action: 'calendar.connected', meta: { canal } });
  return { ok: true, email, canal };
}
