/**
 * Fila de e-mails (outbox) — FASE-08.
 *
 * 1. `enfileirar()` grava a intenção na MESMA transação do fato (consulta
 *    criada, cancelada…). Se o e-mail falhar, a consulta não se perde; se
 *    a consulta falhar, nenhum e-mail sai.
 * 2. `processarFila()` envia: logo depois da resposta (`after()`) e, de
 *    novo, pelo cron — que reprocessa falhas com backoff.
 *
 * Garantias:
 *   - `dedup_key` único → cron rodado duas vezes não duplica lembrete;
 *   - lease de 5 min ao pegar a linha (FOR UPDATE SKIP LOCKED) → dois
 *     processos nunca pegam a mesma notificação;
 *   - Idempotency-Key na Resend → processo morto depois do envio e antes
 *     de marcar "enviado" não vira segundo e-mail.
 *   - o conteúdo é montado NA HORA do envio, a partir do estado atual:
 *     lembrete de consulta já cancelada não sai.
 */
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { emailConfigurado, emailDaMedica } from '../env';
import { gerarIcs } from '../calendar/ics';
import { enviarEmail, EmailError, type Anexo } from '../email/cliente';
import { renderizar, type Documento } from '../email/layout';
import * as T from '../email/templates';
import { ctxConsulta, ctxMedica, dadosIcs, urlGestaoDe, type Linha, type LinhaProfissional, type LinhaTipo } from '../agendamento/apresentacao';
import type { Modalidade } from '../config';
import { formatarParaPaciente, somarMinutos } from '../datetime';
import { log } from '../log';
import { urlSite } from '../seo';

const { notification, appointment, appointmentType, practitioner } = schema;

export const TIPOS_NOTIFICACAO = {
  confirmacao: 'patient',
  cancelamento: 'patient',
  remarcacao: 'patient',
  lembrete_d1: 'patient',
  lembrete_h2: 'patient',
  nova_consulta: 'practitioner',
  cancelamento_medica: 'practitioner',
  alerta_agenda: 'practitioner',
  alerta_sync: 'practitioner',
  alerta_conflito: 'practitioner',
  alerta_bounce: 'practitioner',
} as const;
export type TipoNotificacao = keyof typeof TIPOS_NOTIFICACAO;

export const MAX_TENTATIVAS = 5;
/** Backoff em minutos por tentativa já feita: 1 → 5 → 15 → 60 → 240. */
const BACKOFF_MIN = [1, 5, 15, 60, 240];

type Db = ReturnType<typeof db>;
export type Executor = Pick<Db, 'insert' | 'update' | 'select' | 'execute'>;

/**
 * Enfileira (idempotente). `chave` diferencia repetições legítimas do
 * mesmo tipo — ex.: a 2ª remarcação da mesma consulta usa a nova SEQUENCE.
 * Devolve `true` só se a linha foi criada agora (`false`: já existia).
 *
 * `vencimento`: a partir de quando pode sair (padrão: `now()` do banco).
 * Quem enfileira e já chama `processarFila({ agora })` em seguida passa o
 * MESMO `agora` — senão `now()`, posterior, fica "no futuro" e a linha só
 * sai na próxima execução.
 */
export async function enfileirar(ex: Executor, n: {
  tipo: TipoNotificacao; chave: string; appointmentId?: string | null; meta?: Record<string, unknown>;
  vencimento?: Date;
}): Promise<boolean> {
  const criadas = await ex.insert(notification).values({
    dedupKey: `${n.tipo}:${n.chave}`,
    appointmentId: n.appointmentId ?? null,
    kind: n.tipo,
    recipient: TIPOS_NOTIFICACAO[n.tipo],
    meta: n.meta ?? {},
    ...(n.vencimento ? { nextAt: n.vencimento } : {}),
  }).onConflictDoNothing({ target: notification.dedupKey }).returning({ id: notification.id });
  return criadas.length > 0;
}

type LinhaNotificacao = typeof notification.$inferSelect;

type Montagem =
  | { pular: string }
  | { para: string; doc: Documento; anexos?: Anexo[]; cabecalhos?: Record<string, string> };

type Contexto = { ag: Linha; tipo: LinhaTipo; prof: LinhaProfissional } | null;

async function carregarContexto(appointmentId: string | null): Promise<Contexto> {
  if (!appointmentId) return null;
  const [r] = await db().select({ ag: appointment, tipo: appointmentType, prof: practitioner })
    .from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .innerJoin(practitioner, eq(appointment.practitionerId, practitioner.id))
    .where(eq(appointment.id, appointmentId)).limit(1);
  return r ?? null;
}

function anexoIcs(ctx: NonNullable<Contexto>, metodo: 'REQUEST' | 'CANCEL'): Anexo {
  const { ag, tipo } = ctx;
  const ics = gerarIcs(dadosIcs(ag, tipo.label, tipo.locationKind as Modalidade, urlGestaoDe(ag) ?? undefined), metodo);
  return { nome: 'consulta-dra-andressa.ics', conteudo: ics, tipo: `text/calendar; charset=utf-8; method=${metodo}` };
}

/** Monta o e-mail a partir do estado ATUAL — ou diz por que não enviar. */
export function montar(n: LinhaNotificacao, ctx: Contexto, agora = new Date()): Montagem {
  const tipo = n.kind as TipoNotificacao;
  const painel = (p = '/admin') => ({ urlPainel: `${urlSite()}${p}` });

  if (tipo === 'alerta_agenda') {
    return { para: emailDaMedica(), doc: T.alertaAgendaDesconectada(painel('/admin/integracoes')) };
  }
  if (!ctx) return { pular: 'sem-agendamento' };
  const { ag } = ctx;

  if (TIPOS_NOTIFICACAO[tipo] === 'patient') {
    if (ag.anonymizedAt) return { pular: 'anonimizado' };
    if (ag.emailBouncedAt) return { pular: 'email-invalido' };
  }
  const c = () => ctxConsulta(ag, ctx.tipo, ctx.prof, agora);
  const futura = ag.visitStartsAt > agora;
  const lembretes = { 'List-Unsubscribe': `<mailto:${emailDaMedica()}?subject=${encodeURIComponent('Não quero receber lembretes')}>` };

  switch (tipo) {
    case 'confirmacao':
      if (ag.status !== 'confirmed' || !futura) return { pular: 'nao-confirmada' };
      return { para: ag.patientEmail, doc: T.confirmacao(c()), anexos: [anexoIcs(ctx, 'REQUEST')] };
    case 'remarcacao':
      if (ag.status !== 'confirmed' || !futura) return { pular: 'nao-confirmada' };
      return {
        para: ag.patientEmail,
        doc: T.remarcacao({ ...c(), quandoAnterior: String(n.meta.quandoAnterior ?? 'o horário anterior') }),
        anexos: [anexoIcs(ctx, 'REQUEST')],
      };
    case 'cancelamento':
      if (ag.status !== 'cancelled') return { pular: 'nao-cancelada' };
      if (!futura) return { pular: 'passada' };
      return {
        para: ag.patientEmail,
        doc: T.cancelamento({ ...c(), motivo: ag.cancelReason, pelaMedica: ag.cancelledBy !== 'patient' }),
        anexos: [anexoIcs(ctx, 'CANCEL')],
      };
    case 'lembrete_d1':
      if (ag.status !== 'confirmed' || !futura) return { pular: 'nao-confirmada' };
      return { para: ag.patientEmail, doc: T.lembreteD1(c()), cabecalhos: lembretes };
    case 'lembrete_h2':
      if (ag.status !== 'confirmed' || !futura) return { pular: 'nao-confirmada' };
      return { para: ag.patientEmail, doc: T.lembreteH2(c()), cabecalhos: lembretes };
    case 'nova_consulta':
      if (ag.status !== 'confirmed') return { pular: 'nao-confirmada' };
      return { para: emailDaMedica(), doc: T.novaConsulta(ctxMedica(ag, ctx.tipo)) };
    case 'cancelamento_medica':
      return { para: emailDaMedica(), doc: T.cancelamentoParaMedica(ctxMedica(ag, ctx.tipo)) };
    case 'alerta_sync':
      return {
        para: emailDaMedica(),
        doc: T.alertaSincronizacao({ ...painel(), quando: formatarParaPaciente(ag.visitStartsAt), nome: ag.patientName, detalhe: String(n.meta.detalhe ?? '') || undefined }),
      };
    case 'alerta_conflito':
      return {
        para: emailDaMedica(),
        doc: T.alertaConflito({ ...painel(), quando: formatarParaPaciente(ag.visitStartsAt), nome: ag.patientName }),
      };
    case 'alerta_bounce':
      return {
        para: emailDaMedica(),
        doc: T.alertaBounce({ ...painel(), quando: formatarParaPaciente(ag.visitStartsAt), nome: ag.patientName, telefone: ag.patientPhone }),
      };
    default:
      return { pular: 'tipo-desconhecido' };
  }
}

async function finalizar(id: string, dados: Partial<LinhaNotificacao>) {
  await db().update(notification).set(dados).where(eq(notification.id, id));
}

async function enviarUma(n: LinhaNotificacao, agora: Date): Promise<'sent' | 'skipped' | 'failed'> {
  if (!emailConfigurado()) {
    await finalizar(n.id, { status: 'skipped', lastError: 'email-nao-configurado' });
    return 'skipped';
  }
  try {
    const m = montar(n, await carregarContexto(n.appointmentId), agora);
    if ('pular' in m) {
      await finalizar(n.id, { status: 'skipped', lastError: m.pular });
      return 'skipped';
    }
    const r = renderizar(m.doc);
    const { id } = await enviarEmail({
      para: m.para, assunto: r.assunto, html: r.html, texto: r.texto,
      anexos: m.anexos, cabecalhos: m.cabecalhos, idempotencia: n.dedupKey,
    });
    await finalizar(n.id, { status: 'sent', sentAt: new Date(), providerId: id, lastError: null });
    if (n.appointmentId && (n.kind === 'lembrete_d1' || n.kind === 'lembrete_h2')) {
      await db().update(appointment)
        .set(n.kind === 'lembrete_d1' ? { reminderD1At: new Date() } : { reminderH2At: new Date() })
        .where(eq(appointment.id, n.appointmentId));
    }
    return 'sent';
  } catch (e) {
    const definitivo = e instanceof EmailError && !e.transitorio;
    const codigo = e instanceof EmailError ? `${e.status}:${e.codigo}` : 'erro';
    const esgotou = definitivo || n.attempts >= MAX_TENTATIVAS;
    await finalizar(n.id, {
      status: 'failed',
      lastError: codigo,
      attempts: definitivo ? MAX_TENTATIVAS : n.attempts,
      nextAt: somarMinutos(agora, BACKOFF_MIN[Math.min(n.attempts, BACKOFF_MIN.length) - 1] ?? 240),
    });
    if (esgotou) log.excecao('email.desistiu', e, { tipo: n.kind, codigo, notificacao: n.id });
    else log.aviso('email.falhou', { tipo: n.kind, codigo, tentativa: n.attempts });
    return 'failed';
  }
}

/**
 * Envia o que estiver vencido. Com `appointmentId`, só daquela consulta
 * (chamado logo após a resposta, via `after()`).
 */
export async function processarFila(p: { appointmentId?: string; limite?: number; agora?: Date } = {}) {
  const agora = p.agora ?? new Date();
  const limite = p.limite ?? 25;
  const filtro = p.appointmentId ? sql`AND appointment_id = ${p.appointmentId}` : sql``;

  // Sem `agora` explícito, o corte é o relógio do BANCO: `next_at` nasce do
  // now() do Postgres (microssegundos) e o Date da aplicação só tem
  // milissegundos — no mesmo milissegundo, o recém-enfileirado parecia "do
  // futuro" e não saía (teste do bounce intermitente no CI).
  // (ISO, não Date: o Drizzle troca o serializador de data do cliente.)
  const corte = p.agora ? sql`${agora.toISOString()}::timestamptz` : sql`now()`;

  // Pega com LEASE: next_at vai 5 min à frente e a tentativa é contada
  // ANTES do envio. Se o processo morrer, a linha volta sozinha à fila.
  const pegas = await db().execute(sql`
    UPDATE notification
       SET next_at = ${corte} + interval '5 minutes', attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM notification
        WHERE status IN ('pending','failed') AND next_at <= ${corte}
          AND attempts < ${MAX_TENTATIVAS} ${filtro}
        ORDER BY created_at
        LIMIT ${limite}
        FOR UPDATE SKIP LOCKED)
    RETURNING id`) as unknown as { id: string }[];

  const resultado = { sent: 0, skipped: 0, failed: 0 };
  for (const { id } of pegas) {
    const [n] = await db().select().from(notification).where(eq(notification.id, id)).limit(1);
    if (!n) continue;
    resultado[await enviarUma(n, agora)]++;
  }
  return resultado;
}
