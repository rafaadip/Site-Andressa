/**
 * Conexão da agenda da médica: lê a linha de `calendar_connection`, decifra
 * o refresh token, mantém o access token em cache e marca a conexão como
 * revogada ao primeiro `invalid_grant` (FASE-05 §6).
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { cifrar, decifrar } from '../crypto';
import { ehProducao, envGoogle, googleConfigurado } from '../env';
import { PROFISSIONAL } from '../config';
import { dataLocal } from '../datetime';
import { enfileirar } from '../notificacoes/fila';
import { AgendaGoogle, GoogleRevogadoError, renovarAccessToken, revogarToken } from './google';

const { calendarConnection } = schema;
export type Conexao = typeof calendarConnection.$inferSelect;

/** Access token por conexão, na memória da instância (vale ~1 h). */
const tokens = new Map<string, { token: string; expiraEm: number }>();

/** Só para testes: simula instância nova (sem access token em cache). */
export function _limparTokens() { tokens.clear(); }

export async function conexaoAtiva(practitionerId: string): Promise<Conexao | null> {
  if (!googleConfigurado()) return null;
  const [c] = await db().select().from(calendarConnection).where(and(
    eq(calendarConnection.practitionerId, practitionerId),
    eq(calendarConnection.provider, 'google'),
    isNull(calendarConnection.revokedAt),
  )).limit(1);
  return c ?? null;
}

/** Última conexão, ativa ou não — para o /admin mostrar "desconectada". */
export async function ultimaConexao(practitionerId: string): Promise<Conexao | null> {
  const [c] = await db().select().from(calendarConnection)
    .where(eq(calendarConnection.practitionerId, practitionerId)).limit(1);
  return c ?? null;
}

export function clienteDa(conexao: Conexao): AgendaGoogle {
  return new AgendaGoogle(async () => {
    const atual = tokens.get(conexao.id);
    if (atual && atual.expiraEm > Date.now()) return atual.token;
    try {
      const novo = await renovarAccessToken(decifrar(conexao.refreshTokenEnc));
      tokens.set(conexao.id, novo);
      return novo.token;
    } catch (e) {
      if (e instanceof GoogleRevogadoError) await marcarRevogada(conexao.id, 'invalid_grant');
      throw e;
    }
  }, conexao.calendarId);
}

/**
 * Ponto ÚNICO onde a revogação é registrada — venha ela da FreeBusy, da
 * escrita de evento ou do sync. Avisa a médica (no máximo 1×/dia): sem a
 * agenda, o site não enxerga os plantões dela (ADR-002).
 */
export async function marcarRevogada(id: string, motivo: string): Promise<void> {
  tokens.delete(id);
  const marcadas = await db().update(calendarConnection)
    .set({ revokedAt: new Date(), lastError: motivo, channelId: null, channelResourceId: null, channelExpiresAt: null })
    .where(and(eq(calendarConnection.id, id), isNull(calendarConnection.revokedAt)))
    .returning({ id: calendarConnection.id });
  if (marcadas.length > 0) {
    await enfileirar(db(), { tipo: 'alerta_agenda', chave: dataLocal(new Date()) });
  }
}

export async function registrarErro(id: string, codigo: string | null): Promise<void> {
  await db().update(calendarConnection).set({ lastError: codigo }).where(eq(calendarConnection.id, id));
}

/**
 * Regra inegociável (FASE-13 §1): fora da produção, NUNCA a agenda real.
 * Um teste criando eventos na agenda da médica destrói a confiança.
 */
export function garantirAgendaPermitida(emailConta: string): void {
  if (ehProducao()) return;
  const real = (process.env.AGENDA_REAL_EMAIL || PROFISSIONAL.email).toLowerCase();
  if (emailConta.toLowerCase() === real) {
    throw new Error('Ambiente não-produtivo tentando usar a agenda REAL da médica. Use uma conta de teste.');
  }
}

/** Grava (ou substitui) a conexão depois do OAuth. Token só cifrado. */
export async function salvarConexao(p: {
  practitionerId: string; emailConta: string; refreshToken: string;
}): Promise<Conexao> {
  garantirAgendaPermitida(p.emailConta);
  const calendarId = envGoogle().GOOGLE_CALENDAR_ID;
  const valores = {
    practitionerId: p.practitionerId,
    provider: 'google',
    accountEmail: p.emailConta,
    calendarId,
    refreshTokenEnc: cifrar(p.refreshToken),
    syncToken: null,
    channelId: null,
    channelResourceId: null,
    channelExpiresAt: null,
    revokedAt: null,
    lastError: null,
    lastSyncAt: null,
    connectedAt: new Date(),
  };
  // Uma conexão por profissional: reconectar SUBSTITUI a anterior.
  const [linha] = await db().transaction(async (tx) => {
    await tx.delete(calendarConnection).where(eq(calendarConnection.practitionerId, p.practitionerId));
    return tx.insert(calendarConnection).values(valores).returning();
  });
  tokens.clear();
  return linha!;
}

/** Desconectar: revoga no Google e apaga a credencial. Agendamentos ficam. */
export async function removerConexao(practitionerId: string): Promise<void> {
  const c = await ultimaConexao(practitionerId);
  if (!c) return;
  try {
    const cli = clienteDa(c);
    if (c.channelId && c.channelResourceId) await cli.pararCanal(c.channelId, c.channelResourceId).catch(() => undefined);
    await revogarToken(decifrar(c.refreshTokenEnc));
  } catch { /* revogar é melhor esforço: a credencial some do banco de qualquer jeito */ }
  tokens.delete(c.id);
  await db().delete(calendarConnection).where(eq(calendarConnection.id, c.id));
}
