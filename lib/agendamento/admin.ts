/**
 * Operações do painel da médica — FASE-09.
 *
 * Mesma regra do serviço público: o fato é gravado junto com a fila de
 * e-mails, na mesma transação; Google e e-mail acontecem depois
 * (`efeitosDe`). Toda escrita deixa trilha no audit_log (LGPD Art. 37).
 *
 * Regra de ouro (FASE-09 §4): bloquear um período com consulta dentro
 * NUNCA cancela em silêncio — cada consulta afetada exige uma decisão.
 */
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, schema } from '../db';
import { dataLocal, horaLocalParaUtc, somarDiasLocal, somarMinutos, formatarParaPaciente } from '../datetime';
import { codigoPg, PG_EXCLUSION_VIOLATION, SlotIndisponivelError } from '../db/reservas';
import { hashToken } from '../seguranca';
import { enfileirar } from '../notificacoes/fila';
import { conexaoAtiva, ultimaConexao } from '../calendar/conexao';
import { emailConfigurado, googleConfigurado } from '../env';
import type { Modalidade } from '../config';
import { disponibilidade, practitionerId } from './servico';
import type { Linha } from './apresentacao';

const { appointment, appointmentType, availabilityRule, availabilityException, practitioner, auditLog, notification } = schema;

export class OperacaoInvalidaError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OperacaoInvalidaError'; }
}

// ── Agenda ───────────────────────────────────────────────────────────────

export type ItemAgenda = {
  id: string;
  inicio: Date;
  fim: Date;
  status: string;
  nome: string;
  telefone: string;
  email: string;
  motivo: string | null;
  tipo: string;
  modalidade: Modalidade;
  duracaoMin: number;
  syncState: string;
  emailInvalido: boolean;
};

function paraItem(r: { ag: Linha; label: string; kind: string; dur: number }): ItemAgenda {
  return {
    id: r.ag.id, inicio: r.ag.visitStartsAt, fim: r.ag.visitEndsAt, status: r.ag.status,
    nome: r.ag.patientName, telefone: r.ag.patientPhone, email: r.ag.patientEmail, motivo: r.ag.patientNote,
    tipo: r.label, modalidade: r.kind as Modalidade, duracaoMin: r.dur,
    syncState: r.ag.syncState, emailInvalido: Boolean(r.ag.emailBouncedAt),
  };
}

const colunasItem = { ag: appointment, label: appointmentType.label, kind: appointmentType.locationKind, dur: appointmentType.durationMin };

/** Consultas ativas de hoje (inclusive as que já passaram) até `dias` à frente. */
export async function agenda(dias = 30, agora = new Date()): Promise<ItemAgenda[]> {
  const pid = await practitionerId();
  const inicio = horaLocalParaUtc(dataLocal(agora), '00:00');
  const linhas = await db().select(colunasItem).from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(and(
      eq(appointment.practitionerId, pid),
      inArray(appointment.status, ['confirmed', 'no_show']),
      gte(appointment.visitStartsAt, inicio),
      lt(appointment.visitStartsAt, somarMinutos(inicio, (dias + 1) * 24 * 60)),
    ))
    .orderBy(asc(appointment.visitStartsAt));
  return linhas.map(paraItem);
}

export async function consultaPorId(id: string): Promise<(ItemAgenda & { linha: Linha }) | null> {
  const [r] = await db().select(colunasItem).from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(eq(appointment.id, id)).limit(1);
  return r && !r.ag.anonymizedAt ? { ...paraItem(r), linha: r.ag } : null;
}

async function exigirConsulta(id: string): Promise<Linha> {
  const [l] = await db().select().from(appointment).where(eq(appointment.id, id)).limit(1);
  if (!l || l.anonymizedAt) throw new OperacaoInvalidaError('Consulta não encontrada.');
  return l;
}

/** Cancelamento pela médica — com recado opcional; o paciente é avisado (se futura). */
export async function cancelarPelaMedica(id: string, p: { motivo?: string | null; avisar?: boolean } = {}, agora = new Date()) {
  const l = await exigirConsulta(id);
  if (l.status === 'cancelled') return;
  if (l.status !== 'confirmed') throw new OperacaoInvalidaError('Só consultas confirmadas podem ser canceladas.');
  const recado = p.motivo?.trim().slice(0, 300) || null;

  await db().transaction(async (tx) => {
    const feitos = await tx.update(appointment).set({
      status: 'cancelled', cancelledAt: agora, cancelledBy: 'practitioner', cancelReason: recado,
      icsSequence: sql`${appointment.icsSequence} + 1`,
      syncState: 'pending', syncAttempts: 0, syncNextAt: null, updatedAt: agora,
    }).where(and(eq(appointment.id, id), eq(appointment.status, 'confirmed'))).returning({ id: appointment.id });
    if (feitos.length === 0) return;
    await tx.insert(auditLog).values({ actor: 'practitioner', action: 'appointment.cancelled', subjectId: id, meta: { avisou: p.avisar !== false } });
    if (p.avisar !== false && l.visitStartsAt > agora) {
      await enfileirar(tx, { tipo: 'cancelamento', chave: id, appointmentId: id });
    }
  });
}

/** Falta: só depois do início da consulta. Reversível. */
export async function marcarFalta(id: string, falta: boolean, agora = new Date()) {
  const l = await exigirConsulta(id);
  if (falta) {
    if (l.status !== 'confirmed') throw new OperacaoInvalidaError('Só consultas confirmadas.');
    if (l.visitStartsAt > agora) throw new OperacaoInvalidaError('A consulta ainda não começou.');
  } else if (l.status !== 'no_show') {
    return;
  }
  await db().transaction(async (tx) => {
    await tx.update(appointment).set({ status: falta ? 'no_show' : 'confirmed', updatedAt: agora })
      .where(eq(appointment.id, id));
    await tx.insert(auditLog).values({ actor: 'practitioner', action: falta ? 'appointment.no_show' : 'appointment.no_show_undone', subjectId: id, meta: {} });
  });
}

/** Horários para remarcar: ignora a própria consulta e a antecedência mínima. */
export async function horariosParaRemarcar(id: string, de: string, ate: string) {
  const l = await exigirConsulta(id);
  const [t] = await db().select().from(appointmentType).where(eq(appointmentType.id, l.typeId)).limit(1);
  return disponibilidade({ tipo: t!.slug, de, ate, ignorarAgendamento: id, semAntecedencia: true });
}

export async function remarcarPelaMedica(id: string, novoInicioIso: string, agora = new Date()) {
  const l = await exigirConsulta(id);
  if (l.status !== 'confirmed') throw new OperacaoInvalidaError('Só consultas confirmadas podem ser remarcadas.');
  const novoInicio = new Date(novoInicioIso);
  if (Number.isNaN(novoInicio.getTime())) throw new OperacaoInvalidaError('Horário inválido.');

  const dia = dataLocal(novoInicio);
  const disp = await horariosParaRemarcar(id, dia, dia);
  if (!disp.dias.some((d) => d.slots.some((s) => s.inicio === novoInicio.toISOString()))) {
    throw new SlotIndisponivelError();
  }
  const [t] = await db().select().from(appointmentType).where(eq(appointmentType.id, l.typeId)).limit(1);
  const fim = somarMinutos(novoInicio, t!.durationMin);
  const quandoAnterior = formatarParaPaciente(l.visitStartsAt);

  try {
    await db().transaction(async (tx) => {
      const [feito] = await tx.update(appointment).set({
        visitStartsAt: novoInicio, visitEndsAt: fim,
        startsAt: somarMinutos(novoInicio, -t!.bufferBeforeMin), endsAt: somarMinutos(fim, t!.bufferAfterMin),
        icsSequence: sql`${appointment.icsSequence} + 1`,
        reminderD1At: null, reminderH2At: null,
        syncState: 'pending', syncAttempts: 0, syncNextAt: null, updatedAt: agora,
      }).where(and(eq(appointment.id, id), eq(appointment.status, 'confirmed')))
        .returning({ seq: appointment.icsSequence });
      if (!feito) throw new OperacaoInvalidaError('A consulta mudou enquanto você remarcava.');
      await tx.insert(auditLog).values({ actor: 'practitioner', action: 'appointment.rescheduled', subjectId: id, meta: { origem: 'painel' } });
      await enfileirar(tx, { tipo: 'remarcacao', chave: `${id}:${feito.seq}`, appointmentId: id, meta: { quandoAnterior } });
    });
  } catch (e) {
    if (codigoPg(e) === PG_EXCLUSION_VIOLATION) throw new SlotIndisponivelError();
    throw e;
  }
}

// ── Exceções (bloqueios e horários extras) ───────────────────────────────

export type Excecao = { id: string; inicio: Date; fim: Date; tipo: 'block' | 'extra'; nota: string | null };

export async function listarExcecoes(agora = new Date()): Promise<Excecao[]> {
  const pid = await practitionerId();
  const linhas = await db().select().from(availabilityException)
    .where(and(eq(availabilityException.practitionerId, pid), gt(availabilityException.endsAt, agora)))
    .orderBy(asc(availabilityException.startsAt));
  return linhas.map((x) => ({ id: x.id, inicio: x.startsAt, fim: x.endsAt, tipo: x.kind as Excecao['tipo'], nota: x.note }));
}

/** Consultas confirmadas que um bloqueio atingiria. */
export async function afetadosPor(inicio: Date, fim: Date): Promise<ItemAgenda[]> {
  const pid = await practitionerId();
  const linhas = await db().select(colunasItem).from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(and(
      eq(appointment.practitionerId, pid), eq(appointment.status, 'confirmed'),
      lt(appointment.visitStartsAt, fim), gt(appointment.visitEndsAt, inicio),
    )).orderBy(asc(appointment.visitStartsAt));
  return linhas.map(paraItem);
}

export type Decisao = 'cancelar' | 'manter';

/**
 * Cria um bloqueio. Se houver consulta dentro, `decisoes` precisa trazer
 * uma escolha para CADA uma — senão, recusa (nada de cancelar em silêncio).
 */
export async function bloquear(p: {
  inicio: Date; fim: Date; nota?: string | null; decisoes?: Record<string, Decisao>; motivoAoPaciente?: string | null;
}, agora = new Date()): Promise<{ cancelados: string[] }> {
  if (!(p.fim > p.inicio)) throw new OperacaoInvalidaError('O fim precisa ser depois do início.');
  const afetados = await afetadosPor(p.inicio, p.fim);
  const semDecisao = afetados.filter((a) => !p.decisoes?.[a.id]);
  if (semDecisao.length > 0) {
    throw new OperacaoInvalidaError(`Decida o que fazer com ${semDecisao.length === 1 ? 'a consulta' : `as ${semDecisao.length} consultas`} deste período.`);
  }
  const pid = await practitionerId();
  await db().insert(availabilityException).values({
    practitionerId: pid, startsAt: p.inicio, endsAt: p.fim, kind: 'block', note: p.nota?.trim().slice(0, 120) || null,
  });
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'availability.blocked', meta: { afetados: afetados.length } });

  const cancelados: string[] = [];
  for (const a of afetados) {
    if (p.decisoes![a.id] === 'cancelar') {
      await cancelarPelaMedica(a.id, { motivo: p.motivoAoPaciente, avisar: true }, agora);
      cancelados.push(a.id);
    }
  }
  return { cancelados };
}

/**
 * Período vindo de formulário (datas e horas LOCAIS da clínica). Sem hora
 * final — ou "dia inteiro" — vai até a meia-noite do último dia.
 */
export function periodoDoFormulario(p: { de: string; ate?: string; hi?: string; hf?: string; diaInteiro?: boolean }): { inicio: Date; fim: Date } {
  const ate = p.ate || p.de;
  const hi = p.diaInteiro ? '00:00' : p.hi || '00:00';
  const hf = p.diaInteiro ? '' : p.hf ?? '';
  return {
    inicio: horaLocalParaUtc(p.de, hi),
    fim: hf ? horaLocalParaUtc(ate, hf) : horaLocalParaUtc(somarDiasLocal(ate, 1), '00:00'),
  };
}

/** "Bloquear o resto de hoje" (FASE-09 §3.2): de agora até meia-noite. */
export function restoDeHoje(agora = new Date()): { inicio: Date; fim: Date } {
  return { inicio: agora, fim: horaLocalParaUtc(somarDiasLocal(dataLocal(agora), 1), '00:00') };
}

export async function adicionarExtra(inicio: Date, fim: Date, nota?: string | null) {
  if (!(fim > inicio)) throw new OperacaoInvalidaError('O fim precisa ser depois do início.');
  const pid = await practitionerId();
  await db().insert(availabilityException).values({ practitionerId: pid, startsAt: inicio, endsAt: fim, kind: 'extra', note: nota?.trim().slice(0, 120) || null });
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'availability.extra', meta: {} });
}

export async function removerExcecao(id: string) {
  const pid = await practitionerId();
  await db().delete(availabilityException).where(and(eq(availabilityException.id, id), eq(availabilityException.practitionerId, pid)));
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'availability.exception_removed', meta: {} });
}

// ── Semana padrão ────────────────────────────────────────────────────────

export type Faixa = { inicio: string; fim: string; modalidade: Modalidade | 'ambas' };
export type Regra = { id: string; diaSemana: number; inicio: string; fim: string; modalidade: Modalidade };

export async function listarRegras(): Promise<Regra[]> {
  const pid = await practitionerId();
  const linhas = await db().select().from(availabilityRule).where(eq(availabilityRule.practitionerId, pid))
    .orderBy(asc(availabilityRule.weekday), asc(availabilityRule.startTime));
  return linhas.map((r) => ({ id: r.id, diaSemana: r.weekday, inicio: r.startTime.slice(0, 5), fim: r.endTime.slice(0, 5), modalidade: r.locationKind as Modalidade }));
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Substitui as faixas de UM dia da semana. `ambas` vira duas regras. */
export async function salvarDia(diaSemana: number, faixas: Faixa[]) {
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) throw new OperacaoInvalidaError('Dia inválido.');
  for (const f of faixas) {
    if (!HORA.test(f.inicio) || !HORA.test(f.fim)) throw new OperacaoInvalidaError('Use horários no formato 09:00.');
    if (f.inicio >= f.fim) throw new OperacaoInvalidaError(`A faixa ${f.inicio}–${f.fim} termina antes de começar.`);
  }
  // Sobreposição na MESMA modalidade é quase sempre erro de digitação.
  for (const m of ['in_person', 'telehealth'] as const) {
    const doTipo = faixas.filter((f) => f.modalidade === m || f.modalidade === 'ambas').sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < doTipo.length; i++) {
      if (doTipo[i]!.inicio < doTipo[i - 1]!.fim) {
        throw new OperacaoInvalidaError(`As faixas ${doTipo[i - 1]!.inicio}–${doTipo[i - 1]!.fim} e ${doTipo[i]!.inicio}–${doTipo[i]!.fim} se sobrepõem.`);
      }
    }
  }
  const pid = await practitionerId();
  const linhas = faixas.flatMap((f) => (f.modalidade === 'ambas' ? ['in_person', 'telehealth'] as const : [f.modalidade])
    .map((m) => ({ practitionerId: pid, weekday: diaSemana, startTime: f.inicio, endTime: f.fim, locationKind: m })));
  await db().transaction(async (tx) => {
    await tx.delete(availabilityRule).where(and(eq(availabilityRule.practitionerId, pid), eq(availabilityRule.weekday, diaSemana)));
    if (linhas.length) await tx.insert(availabilityRule).values(linhas);
    await tx.insert(auditLog).values({ actor: 'practitioner', action: 'availability.rules_updated', meta: { diaSemana, faixas: faixas.length } });
  });
}

// ── Configurações ────────────────────────────────────────────────────────

export async function listarTiposAdmin() {
  const pid = await practitionerId();
  return db().select().from(appointmentType).where(eq(appointmentType.practitionerId, pid)).orderBy(asc(appointmentType.locationKind));
}

export async function atualizarTipo(id: string, p: { label: string; durationMin: number; bufferBeforeMin: number; bufferAfterMin: number; isActive: boolean }) {
  const label = p.label.trim();
  if (label.length < 3 || label.length > 60) throw new OperacaoInvalidaError('Nome entre 3 e 60 caracteres.');
  if (!Number.isInteger(p.durationMin) || p.durationMin < 10 || p.durationMin > 240) throw new OperacaoInvalidaError('Duração entre 10 e 240 minutos.');
  for (const b of [p.bufferBeforeMin, p.bufferAfterMin]) {
    if (!Number.isInteger(b) || b < 0 || b > 120) throw new OperacaoInvalidaError('Intervalo entre 0 e 120 minutos.');
  }
  const pid = await practitionerId();
  await db().update(appointmentType).set({ ...p, label })
    .where(and(eq(appointmentType.id, id), eq(appointmentType.practitionerId, pid)));
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'settings.type_updated', subjectId: id, meta: {} });
}

export type Politicas = {
  leadTimeHours: number; horizonDays: number; cancelDeadlineHours: number;
  telehealthUrl: string | null; includeNoteInEvent: boolean;
};

export async function atualizarPoliticas(p: Politicas) {
  const faixa = (v: number, min: number, max: number, nome: string) => {
    if (!Number.isInteger(v) || v < min || v > max) throw new OperacaoInvalidaError(`${nome}: entre ${min} e ${max}.`);
  };
  faixa(p.leadTimeHours, 0, 168, 'Antecedência mínima (horas)');
  faixa(p.horizonDays, 7, 180, 'Agenda aberta (dias)');
  faixa(p.cancelDeadlineHours, 0, 168, 'Prazo para cancelar (horas)');
  const url = p.telehealthUrl?.trim() || null;
  if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new OperacaoInvalidaError('O link da teleconsulta precisa começar com https://');
  const pid = await practitionerId();
  await db().update(practitioner).set({ ...p, telehealthUrl: url }).where(eq(practitioner.id, pid));
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'settings.policies_updated', meta: {} });
}

// ── Integrações e alertas ────────────────────────────────────────────────

export type EstadoPainel = {
  google: 'nao-configurado' | 'desconectado' | 'revogado' | 'conectado';
  contaGoogle: string | null;
  ultimaSincronizacao: Date | null;
  canalExpiraEm: Date | null;
  erroGoogle: string | null;
  filaSync: { pendentes: number; falhas: number };
  email: 'nao-configurado' | 'ativo';
  emails7d: { enviados: number; falhas: number };
  bounces: number;
};

export async function estadoPainel(agora = new Date()): Promise<EstadoPainel> {
  const pid = await practitionerId();
  const [ativa, ultima] = await Promise.all([conexaoAtiva(pid), ultimaConexao(pid)]);
  const google: EstadoPainel['google'] = !googleConfigurado() ? 'nao-configurado'
    : ativa ? 'conectado' : ultima ? 'revogado' : 'desconectado';

  const semana = somarMinutos(agora, -7 * 24 * 60);
  const [[sync], [emails], [bounces]] = await Promise.all([
    db().select({
      pendentes: sql<number>`count(*) filter (where ${appointment.syncState} = 'pending')`.mapWith(Number),
      falhas: sql<number>`count(*) filter (where ${appointment.syncState} = 'failed')`.mapWith(Number),
    }).from(appointment).where(and(eq(appointment.practitionerId, pid), gt(appointment.visitEndsAt, agora),
      inArray(appointment.syncState, ['pending', 'failed']))),
    db().select({
      enviados: sql<number>`count(*) filter (where ${notification.status} = 'sent')`.mapWith(Number),
      falhas: sql<number>`count(*) filter (where ${notification.status} = 'failed' and ${notification.attempts} >= 5)`.mapWith(Number),
    }).from(notification).where(gte(notification.createdAt, semana)),
    db().select({ n: count() }).from(appointment).where(and(
      eq(appointment.practitionerId, pid), isNotNull(appointment.emailBouncedAt),
      eq(appointment.status, 'confirmed'), gt(appointment.visitStartsAt, agora))),
  ]);

  return {
    google,
    contaGoogle: (ativa ?? ultima)?.accountEmail ?? null,
    ultimaSincronizacao: ativa?.lastSyncAt ?? null,
    canalExpiraEm: ativa?.channelExpiresAt ?? null,
    erroGoogle: (ativa ?? ultima)?.lastError ?? null,
    filaSync: { pendentes: sync?.pendentes ?? 0, falhas: sync?.falhas ?? 0 },
    email: emailConfigurado() ? 'ativo' : 'nao-configurado',
    emails7d: { enviados: emails?.enviados ?? 0, falhas: emails?.falhas ?? 0 },
    bounces: bounces?.n ?? 0,
  };
}

// ── LGPD: direitos do titular (FASE-10 §3.4) ─────────────────────────────

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function consultasDoTitular(email: string) {
  const pid = await practitionerId();
  return db().select({ ag: appointment, tipo: appointmentType.label }).from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .where(and(eq(appointment.practitionerId, pid), eq(appointment.patientEmail, normalizarEmail(email))))
    .orderBy(desc(appointment.visitStartsAt));
}

/** Portabilidade/acesso: tudo o que existe sobre o titular, sem campo interno. */
export async function exportarTitular(email: string) {
  const linhas = await consultasDoTitular(email);
  await db().insert(auditLog).values({ actor: 'practitioner', action: 'data.exported', meta: { consultas: linhas.length } });
  return {
    geradoEm: new Date().toISOString(),
    titular: normalizarEmail(email),
    consultas: linhas.map(({ ag, tipo }) => ({
      tipo,
      inicio: ag.visitStartsAt.toISOString(),
      fim: ag.visitEndsAt.toISOString(),
      status: ag.status,
      nome: ag.patientName,
      email: ag.patientEmail,
      telefone: ag.patientPhone,
      motivo: ag.patientNote,
      consentimentoDados: ag.consentLgpdAt.toISOString(),
      consentimentoSaude: ag.consentHealthAt?.toISOString() ?? null,
      versaoConsentimento: ag.consentVersion,
      criadaEm: ag.createdAt.toISOString(),
      canceladaEm: ag.cancelledAt?.toISOString() ?? null,
    })),
  };
}

export function paraCsv(dados: Awaited<ReturnType<typeof exportarTitular>>): string {
  const cab = ['tipo', 'inicio', 'fim', 'status', 'nome', 'email', 'telefone', 'motivo', 'consentimentoDados', 'consentimentoSaude', 'versaoConsentimento', 'criadaEm', 'canceladaEm'] as const;
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutraliza fórmula no Excel (=, +, -, @) e escapa aspas.
    const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  return [cab.join(','), ...dados.consultas.map((c) => cab.map((k) => esc(c[k])).join(','))].join('\r\n') + '\r\n';
}

/**
 * Eliminação (Art. 18, VI): anonimiza em vez de apagar a linha — a agenda
 * continua íntegra (a exclusion constraint e o histórico dependem dela).
 * Consultas futuras são canceladas SEM e-mail (a pessoa pediu para sumir)
 * e saem da agenda do Google; o link de gestão deixa de funcionar.
 */
export async function anonimizarTitular(email: string, agora = new Date()): Promise<{ consultas: number; canceladas: string[] }> {
  const linhas = await consultasDoTitular(email);
  const canceladas: string[] = [];
  await db().transaction(async (tx) => {
    for (const { ag } of linhas) {
      if (ag.anonymizedAt) continue;
      const futuraAtiva = ag.status === 'confirmed' && ag.visitStartsAt > agora;
      if (futuraAtiva) canceladas.push(ag.id);
      await tx.update(appointment).set({
        patientName: 'Titular removido',
        patientEmail: '',
        patientPhone: '',
        patientNote: null,
        consentHealthAt: null,
        manageTokenHash: hashToken(randomBytes(32).toString('base64url')),
        anonymizedAt: agora,
        updatedAt: agora,
        ...(futuraAtiva ? {
          status: 'cancelled', cancelledAt: agora, cancelledBy: 'practitioner',
          icsSequence: sql`${appointment.icsSequence} + 1`, syncState: 'pending', syncAttempts: 0, syncNextAt: null,
        } : {}),
      }).where(eq(appointment.id, ag.id));
      // Nada pendente na fila pode sair para quem pediu a eliminação.
      await tx.update(notification).set({ status: 'skipped', lastError: 'anonimizado' })
        .where(and(eq(notification.appointmentId, ag.id), inArray(notification.status, ['pending', 'failed'])));
    }
    await tx.insert(auditLog).values({ actor: 'practitioner', action: 'data.erased', meta: { consultas: linhas.length, canceladas: canceladas.length } });
  });
  return { consultas: linhas.length, canceladas };
}
