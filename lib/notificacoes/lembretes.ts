/**
 * Lembretes (FASE-08 §5). Os crons só ENFILEIRAM; o envio é da fila, que
 * deduplica pela chave — rodar o cron duas vezes não manda dois lembretes.
 *
 * ⚠️ Cron roda em UTC. O D-1 sai às 18:00 de Brasília = 21:00 UTC
 * (`0 21 * * *` no vercel.json). `0 18 * * *` mandaria às 15:00.
 */
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { dataLocal, horaLocalParaUtc, somarMinutos } from '../datetime';
import { enfileirar, processarFila } from './fila';

const { appointment } = schema;

/** Quem acabou de agendar já recebeu a confirmação: não emendar lembrete. */
const RECENTE_MIN = 180;

async function enfileirarTodos(tipo: 'lembrete_d1' | 'lembrete_h2', ids: { id: string }[]) {
  for (const { id } of ids) await enfileirar(db(), { tipo, chave: id, appointmentId: id });
  return ids.length;
}

/** Consultas de AMANHÃ (dia local da clínica). */
export async function lembretesD1(agora = new Date()) {
  const amanha = dataLocal(somarMinutos(horaLocalParaUtc(dataLocal(agora), '12:00'), 24 * 60));
  const inicio = horaLocalParaUtc(amanha, '00:00');
  const fim = somarMinutos(inicio, 24 * 60);
  const alvos = await db().select({ id: appointment.id }).from(appointment).where(and(
    eq(appointment.status, 'confirmed'),
    gte(appointment.visitStartsAt, inicio), lt(appointment.visitStartsAt, fim),
    isNull(appointment.reminderD1At), isNull(appointment.anonymizedAt),
    lt(appointment.createdAt, somarMinutos(agora, -RECENTE_MIN)),
  ));
  const enfileirados = await enfileirarTodos('lembrete_d1', alvos);
  return { enfileirados, envio: await processarFila({ agora, limite: 100 }) };
}

/**
 * Consultas que começam em ~2 h. Cron de hora em hora; a janela (1h30–3h)
 * se sobrepõe de propósito entre execuções — a chave impede duplicata.
 */
export async function lembretesH2(agora = new Date()) {
  const alvos = await db().select({ id: appointment.id }).from(appointment).where(and(
    eq(appointment.status, 'confirmed'),
    gte(appointment.visitStartsAt, somarMinutos(agora, 90)),
    lt(appointment.visitStartsAt, somarMinutos(agora, 180)),
    isNull(appointment.reminderH2At), isNull(appointment.anonymizedAt),
    lt(appointment.createdAt, somarMinutos(agora, -RECENTE_MIN)),
  ));
  const enfileirados = await enfileirarTodos('lembrete_h2', alvos);
  return { enfileirados, envio: await processarFila({ agora, limite: 100 }) };
}
