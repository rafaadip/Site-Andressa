/**
 * Serviço de agendamento — orquestra banco, motor e regras de negócio.
 *
 * Os Route Handlers só traduzem HTTP ↔ este módulo. Toda regra vive aqui,
 * onde os testes de integração a exercitam contra Postgres real.
 */
import { and, asc, count, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';
import { Interval } from 'luxon';
import { db, schema } from '../db';
import { calcularDisponibilidade, type Excecao, type RegraSemanal } from '../availability/engine';
import {
  TZ_CLINICA, dataLocal, formatarParaPaciente, horaLocalParaUtc, somarMinutos, DataInvalidaError,
} from '../datetime';
import { chaveDoSlot, codigoPg, reservarSlot, SlotIndisponivelError } from '../db/reservas';
import { buscarOcupadosExternos } from '../calendar/freebusy';
import { gerarIcs, linkGoogleCalendar, novoUid, type DadosIcs } from '../calendar/ics';
import { hashIp, hashToken, tokenGestaoPara, tokenValido } from '../seguranca';
import { localConsulta, PROFISSIONAL, type Modalidade } from '../config';
import { urlSite } from '../seo';
import type { CriarAgendamento } from '../validation/agendamento';
import type {
  AgendamentoConfirmado, RespostaDisponibilidade, TipoConsultaPublico,
} from './tipos';

const { appointment, appointmentType, availabilityRule, availabilityException, practitioner, auditLog } = schema;

// ── Erros de domínio (os handlers mapeiam para HTTP) ─────────────────────

export class TipoInexistenteError extends Error {
  constructor() { super('Tipo de consulta inexistente.'); this.name = 'TipoInexistenteError'; }
}
export class LimiteExcedidoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'LimiteExcedidoError'; }
}
export class IdempotenciaConflitanteError extends Error {
  constructor() {
    super('Esta requisição já foi usada para outro agendamento.');
    this.name = 'IdempotenciaConflitanteError';
  }
}
export class PrazoCancelamentoError extends Error {
  constructor() {
    super('Faltam menos de 24 horas para a consulta. Para cancelar, fale pelo WhatsApp.');
    this.name = 'PrazoCancelamentoError';
  }
}
export { SlotIndisponivelError };

// ── Políticas ────────────────────────────────────────────────────────────

export const LIMITES = {
  /** Agendamentos criados por origem (hash de IP) por hora. */
  porIpPorHora: 5,
  /** Consultas futuras confirmadas por e-mail. */
  futurasPorEmail: 3,
  /** Antecedência mínima para cancelar/remarcar pelo link. */
  prazoCancelamentoHoras: 24,
  /** Janela máxima de uma consulta de disponibilidade. */
  janelaMaximaDias: 31,
} as const;

// ── Leitura ──────────────────────────────────────────────────────────────

let practitionerIdCache: string | null = null;

/** Um profissional hoje; o modelo já suporta mais (practitioner_id). */
export async function practitionerId(): Promise<string> {
  if (practitionerIdCache) return practitionerIdCache;
  const [p] = await db().select({ id: practitioner.id }).from(practitioner)
    .orderBy(asc(practitioner.createdAt)).limit(1);
  if (!p) throw new Error('Nenhum profissional cadastrado. Rode `npm run db:seed`.');
  practitionerIdCache = p.id;
  return p.id;
}

export async function listarTipos(): Promise<TipoConsultaPublico[]> {
  const pid = await practitionerId();
  const linhas = await db().select().from(appointmentType)
    .where(and(eq(appointmentType.practitionerId, pid), eq(appointmentType.isActive, true)))
    .orderBy(asc(appointmentType.locationKind));
  return linhas.map((t) => ({
    slug: t.slug, label: t.label, duracaoMin: t.durationMin, modalidade: t.locationKind as Modalidade,
  }));
}

async function tipoPorSlug(pid: string, slug: string) {
  const [t] = await db().select().from(appointmentType)
    .where(and(eq(appointmentType.practitionerId, pid), eq(appointmentType.slug, slug),
      eq(appointmentType.isActive, true)))
    .limit(1);
  if (!t) throw new TipoInexistenteError();
  return t;
}

/** Validação de data 'YYYY-MM-DD' e da janela pedida. */
function janelaValida(de: string, ate: string): { inicio: Date; fim: Date } {
  const inicio = horaLocalParaUtc(de, '00:00');
  const fim = somarMinutos(horaLocalParaUtc(ate, '00:00'), 24 * 60);
  const dias = (fim.getTime() - inicio.getTime()) / 86_400_000;
  if (dias < 1 || dias > LIMITES.janelaMaximaDias) {
    throw new DataInvalidaError(`janela de ${dias} dias (máx. ${LIMITES.janelaMaximaDias})`);
  }
  return { inicio, fim };
}

export async function disponibilidade(p: {
  tipo: string; de: string; ate: string; agora?: Date;
}): Promise<RespostaDisponibilidade> {
  const agora = p.agora ?? new Date();
  const pid = await practitionerId();
  const t = await tipoPorSlug(pid, p.tipo);
  const { inicio, fim } = janelaValida(p.de, p.ate);

  const [regras, excecoes, ocupados, externos] = await Promise.all([
    db().select().from(availabilityRule).where(eq(availabilityRule.practitionerId, pid)),
    db().select().from(availabilityException).where(and(
      eq(availabilityException.practitionerId, pid),
      lt(availabilityException.startsAt, fim), gt(availabilityException.endsAt, inicio))),
    db().select({ s: appointment.startsAt, e: appointment.endsAt }).from(appointment).where(and(
      eq(appointment.practitionerId, pid),
      inArray(appointment.status, ['held', 'confirmed']),
      lt(appointment.startsAt, fim), gt(appointment.endsAt, inicio))),
    buscarOcupadosExternos(inicio, fim),
  ]);

  const dias = calcularDisponibilidade({
    de: p.de,
    ate: p.ate,
    agora,
    tipo: {
      slug: t.slug, duracaoMin: t.durationMin, bufferAntesMin: t.bufferBeforeMin,
      bufferDepoisMin: t.bufferAfterMin, modalidade: t.locationKind as Modalidade,
    },
    regras: regras.map((r): RegraSemanal => ({
      diaSemana: r.weekday,
      horaInicio: r.startTime.slice(0, 5),
      horaFim: r.endTime.slice(0, 5),
      modalidade: r.locationKind as Modalidade,
      validoDe: r.validFrom, validoAte: r.validUntil,
    })),
    excecoes: excecoes.map((x): Excecao => ({
      inicio: x.startsAt, fim: x.endsAt, tipo: x.kind as Excecao['tipo'],
    })),
    ocupadosInternos: ocupados.map((o) => Interval.fromDateTimes(o.s, o.e)),
    ocupadosExternos: externos.intervalos,
  });

  return {
    timezone: TZ_CLINICA,
    hoje: dataLocal(agora),
    tipo: { slug: t.slug, label: t.label, duracaoMin: t.durationMin, modalidade: t.locationKind as Modalidade },
    dias: dias.map((d) => ({
      data: d.data,
      diaSemana: d.diaSemana,
      slots: d.slots.map((s) => ({ inicio: s.inicio.toISOString(), rotulo: s.rotulo })),
    })),
    degradado: externos.degradado,
  };
}

// ── Criação ──────────────────────────────────────────────────────────────

type Linha = typeof appointment.$inferSelect;

function paraConfirmado(ag: Linha, tipoLabel: string, modalidade: Modalidade, token: string): AgendamentoConfirmado {
  const base = urlSite();
  const dados = dadosIcs(ag, tipoLabel, modalidade, `${base}/consulta/${token}`);
  return {
    id: ag.id,
    inicio: ag.visitStartsAt.toISOString(),
    fim: ag.visitEndsAt.toISOString(),
    quando: formatarParaPaciente(ag.visitStartsAt),
    tipo: tipoLabel,
    modalidade,
    local: localConsulta(modalidade),
    urlGestao: `${base}/consulta/${token}`,
    urlIcs: `${base}/api/ics?t=${token}`,
    urlGoogle: linkGoogleCalendar(dados),
  };
}

export function dadosIcs(ag: Linha, tipoLabel: string, modalidade: Modalidade, urlGestao?: string): DadosIcs {
  return {
    uid: ag.icsUid,
    sequence: ag.icsSequence,
    inicio: ag.visitStartsAt,
    fim: ag.visitEndsAt,
    tipoLabel,
    modalidade,
    pacienteNome: ag.patientName,
    pacienteEmail: ag.patientEmail,
    organizadorEmail: PROFISSIONAL.email,
    urlGestao,
  };
}

export type ResultadoCriacao = { agendamento: AgendamentoConfirmado; repetido: boolean };

/**
 * Cria um agendamento confirmado.
 *
 * Ordem (docs/00-ARQUITETURA.md §8.2):
 *   idempotência → limites → o horário é REALMENTE ofertado? →
 *   transação { advisory lock → INSERT (exclusion constraint) → auditoria }
 *
 * A sincronização com o Google fica `pending`: se a integração falhar ou
 * ainda não existir, a consulta continua marcada (ADR-002).
 */
export async function criarAgendamento(
  entrada: CriarAgendamento,
  ctx: { ip: string; idempotencyKey: string; agora?: Date },
): Promise<ResultadoCriacao> {
  const agora = ctx.agora ?? new Date();
  const pid = await practitionerId();
  const t = await tipoPorSlug(pid, entrada.tipo);
  const modalidade = t.locationKind as Modalidade;
  const paciente = entrada.paciente;

  // 1. Idempotência: a mesma chave devolve o MESMO agendamento.
  const repetido = await buscarPorIdempotencia(ctx.idempotencyKey);
  if (repetido) {
    const mesmoPedido = repetido.patientEmail === paciente.email
      && repetido.visitStartsAt.toISOString() === new Date(entrada.inicio).toISOString();
    if (!mesmoPedido) throw new IdempotenciaConflitanteError();
    const token = tokenGestaoPara(repetido.id, ctx.idempotencyKey);
    return { agendamento: paraConfirmado(repetido, t.label, modalidade, token), repetido: true };
  }

  // 2. Limites contra abuso.
  const ipHash = hashIp(ctx.ip);
  const [porIp] = await db().select({ n: count() }).from(appointment).where(and(
    eq(appointment.consentIpHash, ipHash),
    gte(appointment.createdAt, somarMinutos(agora, -60))));
  if ((porIp?.n ?? 0) >= LIMITES.porIpPorHora) {
    throw new LimiteExcedidoError('Muitos agendamentos em pouco tempo. Aguarde alguns minutos ou fale pelo WhatsApp.');
  }
  const [futuras] = await db().select({ n: count() }).from(appointment).where(and(
    eq(appointment.patientEmail, paciente.email),
    eq(appointment.status, 'confirmed'),
    gt(appointment.visitStartsAt, agora)));
  if ((futuras?.n ?? 0) >= LIMITES.futurasPorEmail) {
    throw new LimiteExcedidoError(
      `Você já tem ${LIMITES.futurasPorEmail} consultas marcadas. Para marcar outra, fale pelo WhatsApp.`);
  }

  // 3. O horário pedido é um dos OFERTADOS agora? (impede reservar
  //    fora do expediente mandando um POST à mão)
  const inicioClinico = new Date(entrada.inicio);
  const data = dataLocal(inicioClinico);
  const disp = await disponibilidade({ tipo: t.slug, de: data, ate: data, agora });
  const ofertado = disp.dias.some((d) => d.slots.some((s) => s.inicio === inicioClinico.toISOString()));
  if (!ofertado) throw new SlotIndisponivelError();

  // 4. Intervalo bloqueado = buffer antes + consulta + buffer depois.
  const fimClinico = somarMinutos(inicioClinico, t.durationMin);
  const inicioBloqueio = somarMinutos(inicioClinico, -t.bufferBeforeMin);
  const fimBloqueio = somarMinutos(fimClinico, t.bufferAfterMin);

  // Id gerado aqui para o token de gestão existir já no INSERT.
  const id = crypto.randomUUID();
  const token = tokenGestaoPara(id, ctx.idempotencyKey);

  let criado: Linha;
  let jaExistia = false;
  try {
    criado = await reservarSlot(() => db().transaction(async (tx) => {
      // Enfileira concorrentes do MESMO horário (ADR-004): 7s → 116ms.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${chaveDoSlot(pid, inicioBloqueio).toString()}::bigint)`);

      // Recheca a idempotência DEPOIS do lock. Dois envios simultâneos com
      // a mesma chave (o reenvio do 4G ruim) passam juntos pelo passo 1; o
      // lock os enfileira, e o segundo precisa ver a consulta do primeiro —
      // senão esbarra na exclusion constraint e recebe "horário ocupado"
      // pela própria consulta. Em READ COMMITTED, este SELECT já enxerga o
      // commit que liberou o lock.
      const [existente] = await tx.select().from(appointment)
        .where(eq(appointment.idempotencyKey, ctx.idempotencyKey)).limit(1);
      if (existente) { jaExistia = true; return existente; }

      const [linha] = await tx.insert(appointment).values({
        id,
        practitionerId: pid,
        typeId: t.id,
        startsAt: inicioBloqueio,
        endsAt: fimBloqueio,
        visitStartsAt: inicioClinico,
        visitEndsAt: fimClinico,
        status: 'confirmed',
        patientName: paciente.nome,
        patientEmail: paciente.email,
        patientPhone: paciente.telefone,
        patientNote: paciente.motivo || null,
        consentLgpdAt: agora,
        consentHealthAt: paciente.motivo ? agora : null,
        consentIpHash: ipHash,
        manageTokenHash: hashToken(token),   // só o hash vai para o banco
        icsUid: novoUid(),
        icsSequence: 0,
        idempotencyKey: ctx.idempotencyKey,
        syncState: 'pending',
      }).returning();
      if (!linha) throw new Error('INSERT não retornou linha');

      await tx.insert(auditLog).values({
        actor: 'patient', action: 'appointment.created', subjectId: linha.id,
        meta: { tipo: t.slug, comMotivo: Boolean(paciente.motivo) },   // nunca o motivo em si
      });
      return linha;
    }));
  } catch (e) {
    // Duas requisições simultâneas com a MESMA chave: a segunda bate no UNIQUE.
    if (codigoPg(e) === '23505' && String((e as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? '').includes('idempotency')) {
      return criarAgendamento(entrada, ctx);
    }
    throw e;
  }

  return { agendamento: paraConfirmado(criado, t.label, modalidade, token), repetido: jaExistia };
}

async function buscarPorIdempotencia(chave: string) {
  const [linha] = await db().select().from(appointment)
    .where(eq(appointment.idempotencyKey, chave)).limit(1);
  return linha ?? null;
}

// ── Gestão pelo link (sem login) ─────────────────────────────────────────

export type AgendamentoGestao = {
  linha: Linha;
  tipoLabel: string;
  modalidade: Modalidade;
  quando: string;
  local: string;
  podeCancelar: boolean;
};

export async function buscarPorToken(token: string, agora = new Date()): Promise<AgendamentoGestao | null> {
  if (!tokenValido(token)) return null;
  const [r] = await db().select({ a: appointment, label: appointmentType.label, kind: appointmentType.locationKind })
    .from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(eq(appointment.manageTokenHash, hashToken(token)))
    .limit(1);
  if (!r) return null;

  const modalidade = r.kind as Modalidade;
  const horasAte = (r.a.visitStartsAt.getTime() - agora.getTime()) / 3_600_000;
  return {
    linha: r.a,
    tipoLabel: r.label,
    modalidade,
    quando: formatarParaPaciente(r.a.visitStartsAt),
    local: localConsulta(modalidade),
    podeCancelar: r.a.status === 'confirmed' && horasAte >= LIMITES.prazoCancelamentoHoras,
  };
}

export async function cancelarPorToken(token: string, agora = new Date()): Promise<AgendamentoGestao> {
  const atual = await buscarPorToken(token, agora);
  if (!atual) throw new TipoInexistenteError();
  if (atual.linha.status === 'cancelled') return atual;       // idempotente
  if (!atual.podeCancelar) throw new PrazoCancelamentoError();

  await db().transaction(async (tx) => {
    await tx.update(appointment).set({
      status: 'cancelled',
      // RFC 5545: sem incrementar, o iPhone IGNORA o cancelamento.
      icsSequence: sql`${appointment.icsSequence} + 1`,
      syncState: 'pending',             // FASE-05 remove o evento do Google
      updatedAt: agora,
    }).where(and(eq(appointment.id, atual.linha.id), eq(appointment.status, 'confirmed')));

    await tx.insert(auditLog).values({
      actor: 'patient', action: 'appointment.cancelled', subjectId: atual.linha.id, meta: {},
    });
  });

  return (await buscarPorToken(token, agora))!;
}

/** .ics do agendamento: REQUEST se ativo, CANCEL se cancelado. */
export async function icsPorToken(token: string): Promise<string | null> {
  const g = await buscarPorToken(token);
  if (!g) return null;
  const metodo = g.linha.status === 'cancelled' ? 'CANCEL' : 'REQUEST';
  return gerarIcs(dadosIcs(g.linha, g.tipoLabel, g.modalidade, `${urlSite()}/consulta/${token}`), metodo);
}
