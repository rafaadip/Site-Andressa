/**
 * Agenda do Google → consultas (FASE-05 §5). Mudanças feitas no celular.
 *
 * O webhook NÃO diz o que mudou — só que algo mudou. Então listamos com
 * `syncToken` (só o delta) e, para cada evento NOSSO:
 *   - apagado → consulta cancelada + e-mail ao paciente com .ics CANCEL;
 *   - movido  → consulta remarcada (SEQUENCE+1) + e-mail com .ics novo.
 * Eventos pessoais dela são ignorados (a FreeBusy já os enxerga).
 *
 * Armadilhas tratadas:
 *   - `syncToken` expira (410) → sincronização completa, sem intervenção;
 *   - evento apagado volta SÓ com o id → casamos pelo `google_event_id`;
 *   - webhook e cron juntos → atualizações otimistas (WHERE status/horário
 *     ainda são os que vimos), então ninguém cancela ou avisa duas vezes.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { formatarParaPaciente, somarMinutos } from '../datetime';
import { codigoPg, PG_EXCLUSION_VIOLATION } from '../db/reservas';
import { log } from '../log';
import { enfileirar } from '../notificacoes/fila';
import { clienteDa, conexaoAtiva, type Conexao } from './conexao';
import { invalidarCacheOcupados } from './freebusy';
import { GoogleApiError, type EventoGoogle } from './google';

const { appointment, appointmentType, calendarConnection, auditLog } = schema;

export type ResumoRecebimento = { eventos: number; cancelados: number; remarcados: number; conflitos: number; completo: boolean };

/** Nossos eventos têm id derivado do agendamento (idEventoGoogle). */
const ID_NOSSO = /^ag[0-9a-f]{32}$/;

async function aplicarEvento(ev: EventoGoogle, r: ResumoRecebimento): Promise<void> {
  // A sincronização completa traz o histórico inteiro da agenda dela:
  // sem este filtro seria uma consulta ao banco por compromisso pessoal.
  if (!ID_NOSSO.test(ev.id)) return;
  const [linha] = await db().select({ ag: appointment, tipo: appointmentType })
    .from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(eq(appointment.googleEventId, ev.id)).limit(1);
  if (!linha) return;                                   // evento pessoal dela
  const { ag, tipo } = linha;
  if (ag.status !== 'confirmed') return;

  if (ev.status === 'cancelled') {
    await db().transaction(async (tx) => {
      const feitos = await tx.update(appointment).set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: 'calendar',
        icsSequence: sql`${appointment.icsSequence} + 1`,
        // O evento já não existe no Google: nada a empurrar de volta.
        syncState: 'synced', googleEventId: null, syncedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(appointment.id, ag.id), eq(appointment.status, 'confirmed')))
        .returning({ id: appointment.id });
      if (feitos.length === 0) return;
      await tx.insert(auditLog).values({ actor: 'practitioner', action: 'appointment.cancelled', subjectId: ag.id, meta: { origem: 'google' } });
      await enfileirar(tx, { tipo: 'cancelamento', chave: ag.id, appointmentId: ag.id });
    });
    r.cancelados++;
    return;
  }

  // Movido? Só eventos com hora (dia inteiro não é consulta).
  const novoInicio = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
  const novoFim = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
  if (!novoInicio || !novoFim || novoFim <= novoInicio) return;
  if (novoInicio.getTime() === ag.visitStartsAt.getTime() && novoFim.getTime() === ag.visitEndsAt.getTime()) return;

  const quandoAnterior = formatarParaPaciente(ag.visitStartsAt);
  try {
    await db().transaction(async (tx) => {
      const [feito] = await tx.update(appointment).set({
        visitStartsAt: novoInicio,
        visitEndsAt: novoFim,
        startsAt: somarMinutos(novoInicio, -tipo.bufferBeforeMin),
        endsAt: somarMinutos(novoFim, tipo.bufferAfterMin),
        icsSequence: sql`${appointment.icsSequence} + 1`,
        // Lembretes valem para o horário NOVO.
        reminderD1At: null, reminderH2At: null,
        updatedAt: new Date(),
      }).where(and(
        eq(appointment.id, ag.id), eq(appointment.status, 'confirmed'),
        eq(appointment.visitStartsAt, ag.visitStartsAt),     // otimista: ninguém moveu antes
      )).returning({ seq: appointment.icsSequence });
      if (!feito) return;
      await tx.insert(auditLog).values({ actor: 'practitioner', action: 'appointment.rescheduled', subjectId: ag.id, meta: { origem: 'google' } });
      await enfileirar(tx, { tipo: 'remarcacao', chave: `${ag.id}:${feito.seq}`, appointmentId: ag.id, meta: { quandoAnterior } });
    });
    r.remarcados++;
  } catch (e) {
    // Ela moveu para cima de outra consulta: a exclusion constraint barra.
    // Mantemos o horário original e avisamos — nunca overbooking.
    if (codigoPg(e) !== PG_EXCLUSION_VIOLATION) throw e;
    r.conflitos++;
    log.aviso('google.receber.conflito', { agendamento: ag.id });
    await enfileirar(db(), { tipo: 'alerta_conflito', chave: `${ag.id}:${novoInicio.toISOString()}`, appointmentId: ag.id });
  }
}

async function percorrer(conexao: Conexao, syncToken: string | null, r: ResumoRecebimento): Promise<string | null> {
  const cli = clienteDa(conexao);
  let pageToken: string | undefined;
  let proximo: string | null = null;
  do {
    const pagina = await cli.listarEventos({ syncToken: syncToken ?? undefined, pageToken });
    for (const ev of pagina.items ?? []) {
      r.eventos++;
      await aplicarEvento(ev, r);
    }
    pageToken = pagina.nextPageToken;
    proximo = pagina.nextSyncToken ?? proximo;
  } while (pageToken);
  return proximo;
}

/**
 * Traz o delta da agenda. Chamado pelo webhook (após responder) e pelo cron
 * de 15 min — a rede de segurança para notificação perdida.
 */
export async function receberDaAgenda(practitionerId: string): Promise<ResumoRecebimento | null> {
  const conexao = await conexaoAtiva(practitionerId);
  if (!conexao) return null;

  // Um de cada vez por profissional (webhook + cron simultâneos). Lock de
  // TRANSAÇÃO, não de sessão: com o pooler do Supabase em modo transação,
  // lock de sessão vazaria para a próxima requisição que pegasse a conexão.
  return db().transaction(async (tx) => {
    const [linha] = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${`receber:${practitionerId}`})) AS ok`,
    ) as unknown as { ok: boolean }[];
    if (!linha?.ok) return null;

    const r: ResumoRecebimento = { eventos: 0, cancelados: 0, remarcados: 0, conflitos: 0, completo: !conexao.syncToken };
    let token: string | null;
    try {
      token = await percorrer(conexao, conexao.syncToken, r);
    } catch (e) {
      // 410: token expirou. Sincronização completa e token novo.
      if (!(e instanceof GoogleApiError && e.status === 410) || !conexao.syncToken) throw e;
      log.aviso('google.receber.sync-completo', {});
      r.completo = true;
      token = await percorrer(conexao, null, r);
    }
    await db().update(calendarConnection)
      .set({ syncToken: token ?? conexao.syncToken, lastSyncAt: new Date(), lastError: null })
      .where(eq(calendarConnection.id, conexao.id));
    if (r.eventos > 0) await invalidarCacheOcupados(practitionerId);
    return r;
  });
}
