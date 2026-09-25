/**
 * Webhook da Resend (bounce e reclamação) — FASE-08 §3 item 7.
 *
 * A Resend assina com Svix: HMAC-SHA256 de `${id}.${timestamp}.${corpo}`
 * com o segredo `whsec_<base64>`. Conferimos assinatura (tempo constante)
 * e janela de 5 min contra replay.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { enfileirar } from '../notificacoes/fila';

const TOLERANCIA_S = 5 * 60;

export function assinaturaValida(p: {
  segredo: string; id: string | null; timestamp: string | null; assinaturas: string | null; corpo: string; agora?: number;
}): boolean {
  if (!p.id || !p.timestamp || !p.assinaturas) return false;
  const ts = Number(p.timestamp);
  const agora = Math.floor((p.agora ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(agora - ts) > TOLERANCIA_S) return false;

  const chave = Buffer.from(p.segredo.replace(/^whsec_/, ''), 'base64');
  const esperada = createHmac('sha256', chave).update(`${p.id}.${p.timestamp}.${p.corpo}`).digest();
  return p.assinaturas.split(' ').some((item) => {
    const [versao, sig] = item.split(',');
    if (versao !== 'v1' || !sig) return false;
    const recebida = Buffer.from(sig, 'base64');
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

type Evento = { type?: string; data?: { email_id?: string } };

/** Bounce/reclamação: marca o agendamento e avisa a médica (1× por consulta). */
export async function processarEventoResend(e: Evento): Promise<'marcado' | 'ignorado'> {
  if (e.type !== 'email.bounced' && e.type !== 'email.complained') return 'ignorado';
  const emailId = e.data?.email_id;
  if (!emailId) return 'ignorado';

  const [n] = await db().select({ appointmentId: schema.notification.appointmentId, recipient: schema.notification.recipient })
    .from(schema.notification).where(eq(schema.notification.providerId, emailId)).limit(1);
  if (!n?.appointmentId || n.recipient !== 'patient') return 'ignorado';

  const marcados = await db().update(schema.appointment).set({ emailBouncedAt: new Date() })
    .where(and(eq(schema.appointment.id, n.appointmentId), isNull(schema.appointment.emailBouncedAt)))
    .returning({ id: schema.appointment.id });
  if (marcados.length > 0) {
    await enfileirar(db(), { tipo: 'alerta_bounce', chave: n.appointmentId, appointmentId: n.appointmentId });
  }
  return 'marcado';
}
