/**
 * Consulta → agenda do Google (FASE-05 §4 e §6).
 *
 * Princípio (ADR-002): falha de calendário NUNCA perde agendamento. A
 * consulta nasce `pending`; esta rotina tenta gravar o evento logo após a
 * resposta (`after()`) e o cron de reconciliação repete com backoff:
 * 1 → 5 → 15 → 60 → 240 min. Na 5ª falha, alerta à médica.
 *
 * Idempotente por construção: o id do evento é DERIVADO do agendamento,
 * então repetir um INSERT que já tinha dado certo vira 409 → PATCH, nunca
 * evento duplicado.
 */
import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { db, schema } from '../db';
import { TZ_CLINICA, somarMinutos } from '../datetime';
import { localConsulta, type Modalidade } from '../config';
import { urlSite } from '../seo';
import { log } from '../log';
import { enfileirar } from '../notificacoes/fila';
import type { Linha, LinhaProfissional, LinhaTipo } from '../agendamento/apresentacao';
import { clienteDa, conexaoAtiva } from './conexao';
import { GoogleApiError, GoogleRevogadoError, idEventoGoogle, type CorpoEvento } from './google';

const { appointment, appointmentType, practitioner } = schema;

export const MAX_TENTATIVAS_SYNC = 5;
const BACKOFF_MIN = [1, 5, 15, 60, 240];

/** Evento da agenda da médica. O motivo só vai se ela quiser (§4). */
export function corpoDoEvento(ag: Linha, tipo: LinhaTipo, prof: LinhaProfissional): CorpoEvento {
  const modalidade = tipo.locationKind as Modalidade;
  const descricao = [
    `Paciente: ${ag.patientName}`,
    `Telefone: ${ag.patientPhone}`,
    `E-mail: ${ag.patientEmail}`,
    ag.patientNote && prof.includeNoteInEvent ? `Motivo informado: ${ag.patientNote}` : null,
    ag.patientNote && !prof.includeNoteInEvent ? 'Motivo informado: ver no painel.' : null,
    '',
    `Painel: ${urlSite()}/admin`,
    'Agendado pelo site.',
  ].filter((l) => l !== null).join('\n');

  return {
    summary: `${tipo.label} — ${ag.patientName}`,
    description: descricao,
    location: localConsulta(modalidade),
    start: { dateTime: ag.visitStartsAt.toISOString(), timeZone: TZ_CLINICA },
    end: { dateTime: ag.visitEndsAt.toISOString(), timeZone: TZ_CLINICA },
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 24 * 60 },
      { method: 'popup', minutes: 120 },
    ] },
    // Âncora para reconhecer o evento quando ele voltar pelo webhook.
    extendedProperties: { private: { appointmentId: ag.id } },
    transparency: 'opaque',
  };
}

export type ResultadoSync = 'synced' | 'sem-conexao' | 'falhou' | 'revogada' | 'ignorado';

async function carregar(id: string) {
  const [r] = await db().select({ ag: appointment, tipo: appointmentType, prof: practitioner })
    .from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .innerJoin(practitioner, eq(appointment.practitionerId, practitioner.id))
    .where(eq(appointment.id, id)).limit(1);
  return r ?? null;
}

function ehAusente(e: unknown) {
  return e instanceof GoogleApiError && (e.status === 404 || e.status === 410);
}

/** Leva UMA consulta ao estado certo na agenda do Google. */
export async function sincronizarAgendamento(id: string, agora = new Date()): Promise<ResultadoSync> {
  const r = await carregar(id);
  if (!r) return 'ignorado';
  const { ag, tipo, prof } = r;
  if (ag.syncState === 'synced' || ag.syncState === 'skipped') return 'ignorado';

  const conexao = await conexaoAtiva(ag.practitionerId);
  // Sem agenda conectada: fica `pending` (sem gastar tentativa). Quando ela
  // conectar, a reconciliação leva tudo o que é futuro.
  if (!conexao) return 'sem-conexao';

  const cli = clienteDa(conexao);
  const eventoId = ag.googleEventId ?? idEventoGoogle(ag.id);
  const statusVisto = ag.status;

  try {
    let googleEventId: string | null = ag.googleEventId;
    if (ag.status === 'confirmed') {
      const corpo = corpoDoEvento(ag, tipo, prof);
      if (ag.googleEventId) {
        await cli.atualizarEvento(ag.googleEventId, corpo);
      } else {
        try {
          await cli.inserirEvento(eventoId, corpo);
        } catch (e) {
          // 409: o INSERT anterior deu certo, mas não chegou a ser gravado aqui.
          if (!(e instanceof GoogleApiError && e.status === 409)) throw e;
          await cli.atualizarEvento(eventoId, corpo);
        }
        googleEventId = eventoId;
      }
    } else if (ag.status === 'cancelled' || ag.status === 'expired') {
      // Apaga mesmo sem googleEventId: um INSERT pode ter dado certo sem registro.
      await cli.apagarEvento(eventoId).catch((e) => { if (!ehAusente(e)) throw e; });
      googleEventId = null;
    }
    // no_show / completed: o evento fica como registro na agenda dela.

    // Versão otimista: grava `synced` SÓ se nada que vai no evento mudou
    // enquanto a chamada ao Google estava em voo — status, SEQUENCE
    // (remarcar e cancelar incrementam) e o motivo (revogação LGPD o apaga).
    // Mudou → continua como está (pending) e o próximo ciclo reenvia o
    // estado novo. `updated_at` não serve de versão: quando vem do now() do
    // banco tem µs, e a Date do JS só guarda ms — a igualdade falharia sempre.
    const feitos = await db().update(appointment).set({
      syncState: 'synced', syncedAt: new Date(), googleEventId,
      syncAttempts: 0, syncLastError: null, syncNextAt: null,
    }).where(and(
      eq(appointment.id, ag.id),
      eq(appointment.status, statusVisto),
      eq(appointment.icsSequence, ag.icsSequence),
      ag.patientNote === null ? isNull(appointment.patientNote) : eq(appointment.patientNote, ag.patientNote),
    )).returning({ id: appointment.id });
    if (feitos.length === 0) {
      log.info('google.sync.mudou-no-meio', { agendamento: ag.id });
      return 'ignorado';
    }
    return 'synced';
  } catch (e) {
    // Não é culpa desta consulta: não gasta tentativa. O aviso à médica sai
    // de marcarRevogada() (conexao.ts), ponto único da revogação.
    if (e instanceof GoogleRevogadoError) return 'revogada';
    const codigo = e instanceof GoogleApiError ? `${e.status}:${e.motivo}` : 'erro';
    const tentativas = ag.syncAttempts + 1;
    const esgotou = tentativas >= MAX_TENTATIVAS_SYNC;
    await db().update(appointment).set({
      syncState: 'failed',
      syncAttempts: tentativas,
      syncLastError: codigo,
      syncNextAt: somarMinutos(agora, BACKOFF_MIN[tentativas - 1] ?? 240),
    }).where(eq(appointment.id, ag.id));

    if (esgotou) {
      log.excecao('google.sync.desistiu', e, { agendamento: ag.id, codigo });
      await enfileirar(db(), { tipo: 'alerta_sync', chave: `${ag.id}:${ag.icsSequence}`, appointmentId: ag.id, meta: { detalhe: codigo } });
    } else {
      log.aviso('google.sync.falhou', { agendamento: ag.id, codigo, tentativa: tentativas });
    }
    return 'falhou';
  }
}

/**
 * Fila de reconciliação (/api/cron/reconciliar, a cada 5 min): tudo o que
 * está `pending`/`failed`, ainda relevante, com o backoff vencido.
 */
export async function reconciliar(agora = new Date(), limite = 20) {
  const pendentes = await db().select({ id: appointment.id }).from(appointment).where(and(
    inArray(appointment.syncState, ['pending', 'failed']),
    lt(appointment.syncAttempts, MAX_TENTATIVAS_SYNC),
    gt(appointment.visitEndsAt, agora),
    or(isNull(appointment.syncNextAt), lte(appointment.syncNextAt, agora)),
  )).orderBy(asc(appointment.visitStartsAt)).limit(limite);

  const r: Record<ResultadoSync, number> = { synced: 0, 'sem-conexao': 0, falhou: 0, revogada: 0, ignorado: 0 };
  for (const { id } of pendentes) {
    const s = await sincronizarAgendamento(id, agora);
    r[s]++;
    if (s === 'revogada' || s === 'sem-conexao') break;   // as outras teriam o mesmo destino
  }
  return r;
}

/** Ao (re)conectar a agenda: tudo o que é futuro volta para a fila, do zero. */
export async function reenfileirarFuturas(practitionerId: string, agora = new Date()) {
  await db().update(appointment).set({
    syncState: 'pending', syncAttempts: 0, syncNextAt: null, syncLastError: null,
    // Agenda nova não tem nossos eventos: recria com o id derivado (na mesma
    // agenda, o INSERT dá 409 e vira PATCH — sem duplicar).
    googleEventId: null,
  }).where(and(
    eq(appointment.practitionerId, practitionerId),
    eq(appointment.status, 'confirmed'),
    gt(appointment.visitEndsAt, agora),
  ));
}
