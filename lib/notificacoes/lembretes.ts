/**
 * Lembretes (FASE-08 §5). Os crons só ENFILEIRAM; o envio é da fila, que
 * deduplica pela chave — rodar o cron duas vezes não manda dois lembretes.
 *
 * ⚠️ Cron roda em UTC. O D-1 sai às 18:00 de Brasília = 21:00 UTC
 * (`0 21 * * *` no vercel.json). `0 18 * * *` mandaria às 15:00.
 */
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { dataLocal, fimDoDiaLocal, horaLocalParaUtc, somarDiasLocal, somarMinutos } from '../datetime';
import { enfileirar, processarFila } from './fila';

const { appointment } = schema;

/** Quem acabou de agendar já recebeu a confirmação: não emendar lembrete. */
const RECENTE_MIN = 180;

/**
 * A chave leva o HORÁRIO da consulta: remarcada depois do lembrete, é outro
 * lembrete (o do dia novo). Só o id travaria para sempre no primeiro.
 * Conta só o que entrou de fato na fila — rodar de novo não infla a métrica.
 */
async function enfileirarTodos(tipo: 'lembrete_d1' | 'lembrete_h2', alvos: { id: string; inicio: Date }[], agora: Date) {
  let novos = 0;
  for (const a of alvos) {
    // Vence em `agora`: o processarFila({ agora }) logo abaixo já leva.
    if (await enfileirar(db(), { tipo, chave: `${a.id}:${a.inicio.toISOString()}`, appointmentId: a.id, vencimento: agora })) novos++;
  }
  return novos;
}

/** Consultas de AMANHÃ (dia local da clínica). */
export async function lembretesD1(agora = new Date()) {
  const amanha = somarDiasLocal(dataLocal(agora), 1);
  const inicio = horaLocalParaUtc(amanha, '00:00');
  const fim = fimDoDiaLocal(amanha);   // 23 ou 25 h em dia de horário de verão
  const alvos = await db().select({ id: appointment.id, inicio: appointment.visitStartsAt }).from(appointment).where(and(
    eq(appointment.status, 'confirmed'),
    gte(appointment.visitStartsAt, inicio), lt(appointment.visitStartsAt, fim),
    isNull(appointment.reminderD1At), isNull(appointment.anonymizedAt),
    lt(appointment.createdAt, somarMinutos(agora, -RECENTE_MIN)),
  ));
  const enfileirados = await enfileirarTodos('lembrete_d1', alvos, agora);
  return { enfileirados, envio: await processarFila({ agora, limite: 100 }) };
}

/**
 * Consultas que começam em ~2 h. Cron de hora em hora; a janela (1h30–3h)
 * se sobrepõe de propósito entre execuções — a chave impede duplicata.
 */
export async function lembretesH2(agora = new Date()) {
  const alvos = await db().select({ id: appointment.id, inicio: appointment.visitStartsAt }).from(appointment).where(and(
    eq(appointment.status, 'confirmed'),
    gte(appointment.visitStartsAt, somarMinutos(agora, 90)),
    lt(appointment.visitStartsAt, somarMinutos(agora, 180)),
    isNull(appointment.reminderH2At), isNull(appointment.anonymizedAt),
    lt(appointment.createdAt, somarMinutos(agora, -RECENTE_MIN)),
  ));
  const enfileirados = await enfileirarTodos('lembrete_h2', alvos, agora);
  return { enfileirados, envio: await processarFila({ agora, limite: 100 }) };
}
