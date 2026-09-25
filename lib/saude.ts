/**
 * Health check (FASE-13 §5) — consumido por um monitor externo a cada 5 min.
 * Nada de dado pessoal: só estados e contagens. 503 quando o banco cai (o
 * resto degrada sem derrubar o agendamento — ADR-002).
 */
import { and, count, gt, inArray, min, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { emailConfigurado } from './env';
import { somarMinutos } from './datetime';
import { estadoAgenda } from './calendar/freebusy';
import { practitionerId } from './agendamento/servico';

const { appointment, notification } = schema;

export type Saude = {
  status: 'ok' | 'degradado' | 'fora';
  banco: boolean;
  agenda: 'conectada' | 'revogada' | 'sem-google' | 'desconhecida';
  email: boolean;
  /** Minutos desde a consulta pendente de sincronização mais antiga. */
  filaSyncMin: number | null;
  syncFalhas: number;
  emailsFalhos: number;
};

export async function verificarSaude(agora = new Date()): Promise<Saude> {
  try {
    await db().execute(sql`SELECT 1`);
  } catch {
    return { status: 'fora', banco: false, agenda: 'desconhecida', email: emailConfigurado(), filaSyncMin: null, syncFalhas: 0, emailsFalhos: 0 };
  }

  const pid = await practitionerId();
  const [agenda, [fila], [falhasEmail]] = await Promise.all([
    estadoAgenda(pid),
    db().select({
      maisAntiga: min(appointment.updatedAt),
      falhas: sql<number>`count(*) filter (where ${appointment.syncState} = 'failed')`.mapWith(Number),
    }).from(appointment).where(and(inArray(appointment.syncState, ['pending', 'failed']), gt(appointment.visitEndsAt, agora))),
    db().select({ n: count() }).from(notification).where(and(
      sql`${notification.status} = 'failed'`, gt(notification.attempts, 4),
      gt(notification.createdAt, somarMinutos(agora, -7 * 24 * 60)))),
  ]);

  const filaSyncMin = agenda === 'conectada' && fila?.maisAntiga
    ? Math.round((agora.getTime() - new Date(fila.maisAntiga).getTime()) / 60_000) : null;
  const degradado = agenda === 'revogada' || (fila?.falhas ?? 0) >= 5 || (filaSyncMin ?? 0) > 60
    || (falhasEmail?.n ?? 0) > 0;

  return {
    status: degradado ? 'degradado' : 'ok',
    banco: true,
    agenda,
    email: emailConfigurado(),
    filaSyncMin,
    syncFalhas: fila?.falhas ?? 0,
    emailsFalhos: falhasEmail?.n ?? 0,
  };
}
