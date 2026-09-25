/**
 * Retenção automática — FASE-10 §3.5 (cron diário às 05:00 UTC = 02:00 em
 * Brasília). Cada execução registra no audit_log o QUE apagou (contagens,
 * nunca conteúdo): a trilha da própria exclusão.
 *
 *   motivo da consulta (dado de saúde) → apagado 90 dias após a consulta
 *   recado de cancelamento (texto livre) → apagado 90 dias após a consulta
 *   (motivo e contato saem também do evento na agenda Google — SEC-06)
 *   dados de contato                   → anonimizados 5 anos após a consulta
 *   audit_log                          → apagado após 5 anos
 *   fila de e-mails já resolvida       → apagada após 1 ano (só metadados)
 *   cache do FreeBusy                  → dias que já passaram
 */
import { and, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { dataLocal, somarMinutos } from '../datetime';

const { appointment, auditLog, notification, busyCache } = schema;

export const RETENCAO = {
  motivoDias: 90,
  contatoAnos: 5,
  auditoriaAnos: 5,
  filaDias: 365,
} as const;

const dias = (agora: Date, n: number) => somarMinutos(agora, -n * 24 * 60);

export async function aplicarRetencao(agora = new Date()) {
  return db().transaction(async (tx) => {
    // O evento da agenda Google é redigido pela reconciliação (SEC-06):
    // quem tem evento volta a `pending`, e o evento passa a espelhar a linha.
    const redigirEvento = {
      syncState: sql`CASE WHEN ${appointment.googleEventId} IS NOT NULL THEN 'pending' ELSE ${appointment.syncState} END`,
      syncAttempts: 0, syncNextAt: null,
    };

    const motivos = await tx.update(appointment)
      .set({ patientNote: null, consentHealthAt: null, updatedAt: agora, ...redigirEvento })
      .where(and(isNotNull(appointment.patientNote), lt(appointment.visitStartsAt, dias(agora, RETENCAO.motivoDias))))
      .returning({ id: appointment.id });

    // O recado da médica ao cancelar é texto livre (pode citar exame,
    // diagnóstico): mesmo prazo do motivo. Não vai ao evento.
    const recados = await tx.update(appointment)
      .set({ cancelReason: null, updatedAt: agora })
      .where(and(isNotNull(appointment.cancelReason), lt(appointment.visitStartsAt, dias(agora, RETENCAO.motivoDias))))
      .returning({ id: appointment.id });

    const contatos = await tx.update(appointment)
      .set({
        patientName: 'Titular removido', patientEmail: '', patientPhone: '', patientNote: null,
        cancelReason: null, consentHealthAt: null, anonymizedAt: agora, updatedAt: agora, ...redigirEvento,
        // O link de gestão deixa de abrir: nenhum SHA-256 (64 hex) é igual a
        // este valor. Sem depender de pgcrypto no search_path do Supabase.
        manageTokenHash: sql`'anonimizado:' || ${appointment.id}`,
      })
      .where(and(isNull(appointment.anonymizedAt), lt(appointment.visitStartsAt, dias(agora, RETENCAO.contatoAnos * 365))))
      .returning({ id: appointment.id });

    const auditoria = await tx.delete(auditLog)
      .where(lt(auditLog.at, dias(agora, RETENCAO.auditoriaAnos * 365)))
      .returning({ id: auditLog.id });

    const fila = await tx.delete(notification)
      .where(and(inArray(notification.status, ['sent', 'skipped', 'failed']), lt(notification.createdAt, dias(agora, RETENCAO.filaDias))))
      .returning({ id: notification.id });

    await tx.delete(busyCache).where(lt(busyCache.day, dataLocal(agora)));

    const resumo = {
      motivosApagados: motivos.length,
      recadosApagados: recados.length,
      contatosAnonimizados: contatos.length,
      auditoriaApagada: auditoria.length,
      filaApagada: fila.length,
    };
    await tx.insert(auditLog).values({ actor: 'system', action: 'data.retention', meta: resumo });
    return resumo;
  });
}
