/**
 * Serviço de agendamento — orquestra banco, motor e regras de negócio.
 *
 * Os Route Handlers só traduzem HTTP ↔ este módulo. Toda regra vive aqui,
 * onde os testes de integração a exercitam contra Postgres real.
 *
 * Efeitos externos (Google, e-mail) NÃO acontecem aqui dentro: o serviço
 * grava o fato e enfileira as notificações na mesma transação; quem
 * chama dispara `efeitosDe()` depois de responder (lib/agendamento/efeitos.ts).
 */
import { and, asc, count, eq, gt, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { Interval } from 'luxon';
import { db, schema } from '../db';
import { calcularDisponibilidade, type Excecao, type Politicas, type RegraSemanal } from '../availability/engine';
import {
  TZ_CLINICA, dataLocal, diasNoIntervalo, fimDoDiaLocal, formatarParaPaciente, horaLocalParaUtc, somarMinutos,
  DataInvalidaError,
} from '../datetime';
import { chaveDoSlot, chaveDosLimites, codigoPg, reservarSlot, SlotIndisponivelError } from '../db/reservas';
import { buscarOcupadosExternos } from '../calendar/freebusy';
import { gerarIcs, linkGoogleCalendar, novoUid } from '../calendar/ics';
import { hashIp, hashToken, tokenGestaoPara, tokenValido } from '../seguranca';
import { localConsulta, type Modalidade } from '../config';
import { urlSite } from '../seo';
import { comLimiteDeTempo, ESGOTOU } from '../limite-tempo';
import { VERSAO_CONSENTIMENTO, type CriarAgendamento } from '../validation/agendamento';
import { enfileirar, type Executor } from '../notificacoes/fila';
import { log } from '../log';
import { dadosIcs, podeCancelarPeloLink, type Linha, type LinhaProfissional } from './apresentacao';
import type {
  AgendamentoConfirmado, RespostaDisponibilidade, TipoConsultaPublico,
} from './tipos';

const { appointment, appointmentType, availabilityRule, availabilityException, practitioner, auditLog } = schema;

export { dadosIcs };

// ── Erros de domínio (os handlers mapeiam para HTTP) ─────────────────────

export class TipoInexistenteError extends Error {
  constructor() { super('Tipo de consulta inexistente.'); this.name = 'TipoInexistenteError'; }
}
export class AgendamentoInexistenteError extends Error {
  constructor() { super('Consulta não encontrada.'); this.name = 'AgendamentoInexistenteError'; }
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
  constructor(horas: number) {
    super(`Faltam menos de ${horas} horas para a consulta. Para cancelar, fale pelo WhatsApp.`);
    this.name = 'PrazoCancelamentoError';
  }
}
export { SlotIndisponivelError };

// ── Políticas ────────────────────────────────────────────────────────────

/**
 * Limites FIXOS contra abuso. As políticas que a médica ajusta (antecedência,
 * horizonte, prazo de cancelamento) moram no banco — /admin/configuracoes.
 */
export const LIMITES = {
  /** Agendamentos criados por origem (hash de IP) por hora. */
  porIpPorHora: 5,
  /** Consultas futuras confirmadas por e-mail. */
  futurasPorEmail: 3,
  /**
   * Criações pelo site por hora, somando todas as origens. Uma agenda de
   * uma médica não enche assim; acima disto é robô (SEC-02) — e o log avisa.
   */
  porHoraNoTotal: 30,
  /** Janela máxima de uma consulta de disponibilidade. */
  janelaMaximaDias: 31,
  /**
   * Nenhuma consulta de datas além disto (em dias a partir de hoje). O
   * horizonte do painel vai até 180; datas absurdas (ano 9999) estouravam
   * o intervalo de timestamp do Postgres e viravam 500 (pentest PT-03).
   */
  alcanceMaximoDias: 366,
} as const;

/** Grade de alinhamento dos slots (min). */
const GRADE_MIN = 5;

/** Prazo de cancelamento se o banco estiver fora do ar (é o padrão da coluna). */
export const PRAZO_CANCELAMENTO_PADRAO_H = 24;

let prazoCache: { valor: number; ate: number } | null = null;

/**
 * Prazo de cancelamento para os TEXTOS públicos (FAQ, termos). Nunca
 * derruba nem trava a home: cache de 60 s e, se o banco não responder em
 * 800 ms, usa o último valor conhecido (ou o padrão).
 */
export async function prazoCancelamentoPublico(): Promise<number> {
  if (prazoCache && prazoCache.ate > Date.now()) return prazoCache.valor;
  const reserva = prazoCache?.valor ?? PRAZO_CANCELAMENTO_PADRAO_H;
  try {
    const valor = await comLimiteDeTempo(profissional().then((p) => p.cancelDeadlineHours), 800);
    if (valor === ESGOTOU) return reserva;
    prazoCache = { valor, ate: Date.now() + 60_000 };
    return valor;
  } catch {
    return reserva;
  }
}

/** Só para testes: o prazo muda entre casos. */
export function _limparCachePrazo() { prazoCache = null; }

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

/** Linha do profissional, com as políticas editáveis (lidas a cada uso). */
export async function profissional(): Promise<LinhaProfissional> {
  const pid = await practitionerId();
  const [p] = await db().select().from(practitioner).where(eq(practitioner.id, pid)).limit(1);
  return p!;
}

export function politicasDe(p: LinhaProfissional): Politicas {
  return { leadTimeHoras: p.leadTimeHours, horizonteDias: p.horizonDays, grade: GRADE_MIN };
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

async function tipoPorSlug(pid: string, slug: string, soAtivo = true) {
  const [t] = await db().select().from(appointmentType)
    .where(and(eq(appointmentType.practitionerId, pid), eq(appointmentType.slug, slug),
      ...(soAtivo ? [eq(appointmentType.isActive, true)] : [])))
    .limit(1);
  if (!t) throw new TipoInexistenteError();
  return t;
}

/** Validação de data 'YYYY-MM-DD', do tamanho da janela e do alcance. */
function janelaValida(de: string, ate: string, agora: Date): { inicio: Date; fim: Date } {
  const inicio = horaLocalParaUtc(de, '00:00');
  // Fim do dia LOCAL (dia de 23/25 h se o horário de verão voltar).
  const fim = fimDoDiaLocal(ate);
  // Alcance ANTES de contar os dias: contar até o ano 9999 é um laço de
  // milhões de iterações.
  if (!dentroDoAlcance(inicio, agora) || !dentroDoAlcance(fim, agora)) {
    throw new DataInvalidaError(`fora do alcance de ${LIMITES.alcanceMaximoDias} dias`);
  }
  // Dias do calendário, não horas/24: um dia de 23 h não é "0,958 dia".
  const dias = diasNoIntervalo(de, ate).length;
  if (dias < 1 || dias > LIMITES.janelaMaximaDias) {
    throw new DataInvalidaError(`janela de ${dias} dias (máx. ${LIMITES.janelaMaximaDias})`);
  }
  return { inicio, fim };
}

/** De ontem até `alcanceMaximoDias` à frente. */
function dentroDoAlcance(instante: Date, agora: Date): boolean {
  return instante >= somarMinutos(agora, -2 * 24 * 60)
    && instante <= somarMinutos(agora, (LIMITES.alcanceMaximoDias + 1) * 24 * 60);
}

/**
 * E-mail canônico, SÓ para contar consultas por pessoa (o e-mail gravado
 * não muda): minúsculas, sem `+sufixo` e, no Gmail, sem pontos — senão
 * `ana+1@`, `a.na@` e `ana@gmail.com` burlavam o limite (pentest PT-02).
 */
export function emailCanonico(email: string): string {
  const [local = '', dominio = ''] = email.trim().toLowerCase().split('@');
  const semSufixo = local.split('+')[0]!;
  const gmail = dominio === 'gmail.com' || dominio === 'googlemail.com';
  return `${gmail ? semSufixo.replace(/\./g, '') : semSufixo}@${gmail ? 'gmail.com' : dominio}`;
}

/** A mesma canonicalização em SQL, sobre a coluna. */
const emailCanonicoSql = sql`(
  CASE WHEN split_part(lower(${appointment.patientEmail}), '@', 2) IN ('gmail.com', 'googlemail.com')
       THEN replace(split_part(split_part(lower(${appointment.patientEmail}), '@', 1), '+', 1), '.', '') || '@gmail.com'
       ELSE split_part(split_part(lower(${appointment.patientEmail}), '@', 1), '+', 1) || '@' || split_part(lower(${appointment.patientEmail}), '@', 2)
  END)`;

export async function disponibilidade(p: {
  tipo: string; de: string; ate: string; agora?: Date;
  /** Revalidação da criação: ignora o cache do FreeBusy. */
  aoVivo?: boolean;
  /** Remarcação pelo painel: a própria consulta não se bloqueia. */
  ignorarAgendamento?: string;
  /** Painel: a médica pode encaixar dentro da antecedência mínima. */
  semAntecedencia?: boolean;
  /**
   * Só regras, exceções e consultas — sem perguntar ao Google. Dá um
   * SUPERCONJUNTO dos horários reais: serve para recusar de graça o que
   * nunca seria ofertado.
   */
  semAgendaExterna?: boolean;
}): Promise<RespostaDisponibilidade> {
  const agora = p.agora ?? new Date();
  const prof = await profissional();
  const pid = prof.id;
  const t = await tipoPorSlug(pid, p.tipo, !p.ignorarAgendamento);
  const { inicio, fim } = janelaValida(p.de, p.ate, agora);

  const [regras, excecoes, ocupados, externos] = await Promise.all([
    db().select().from(availabilityRule).where(eq(availabilityRule.practitionerId, pid)),
    db().select().from(availabilityException).where(and(
      eq(availabilityException.practitionerId, pid),
      lt(availabilityException.startsAt, fim), gt(availabilityException.endsAt, inicio))),
    db().select({ s: appointment.startsAt, e: appointment.endsAt }).from(appointment).where(and(
      eq(appointment.practitionerId, pid),
      inArray(appointment.status, ['held', 'confirmed']),
      lt(appointment.startsAt, fim), gt(appointment.endsAt, inicio),
      ...(p.ignorarAgendamento ? [ne(appointment.id, p.ignorarAgendamento)] : []))),
    p.semAgendaExterna
      ? { intervalos: [], degradado: false, antecedenciaMinimaHoras: undefined }
      : buscarOcupadosExternos(pid, inicio, fim, { aoVivo: p.aoVivo }),
  ]);

  const pol = politicasDe(prof);
  if (p.semAntecedencia) pol.leadTimeHoras = 0;
  // Sem informação confiável da agenda externa: só a partir de D+2 (ADR-002).
  if (externos.antecedenciaMinimaHoras) {
    pol.leadTimeHoras = Math.max(pol.leadTimeHoras, externos.antecedenciaMinimaHoras);
  }

  const dias = calcularDisponibilidade({
    de: p.de,
    ate: p.ate,
    agora,
    politicas: pol,
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
    horizonteDias: pol.horizonteDias,
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

function paraConfirmado(ag: Linha, tipoLabel: string, modalidade: Modalidade, token: string, prazoCancelamentoHoras: number): AgendamentoConfirmado {
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
    prazoCancelamentoHoras,
  };
}

export type ResultadoCriacao = { agendamento: AgendamentoConfirmado; repetido: boolean };

/**
 * Cria um agendamento confirmado.
 *
 * Ordem (docs/00-ARQUITETURA.md §8.2):
 *   idempotência → limites → o horário é REALMENTE ofertado (FreeBusy ao
 *   vivo)? → transação { advisory lock → recheck → INSERT (exclusion
 *   constraint) → auditoria → fila de e-mails }
 *
 * A sincronização com o Google fica `pending`: se a integração falhar ou
 * ainda não existir, a consulta continua marcada (ADR-002).
 */
export async function criarAgendamento(
  entrada: CriarAgendamento,
  ctx: { ip: string; idempotencyKey: string; agora?: Date },
): Promise<ResultadoCriacao> {
  const agora = ctx.agora ?? new Date();
  const prof = await profissional();
  const pid = prof.id;
  const t = await tipoPorSlug(pid, entrada.tipo);
  const modalidade = t.locationKind as Modalidade;
  const paciente = entrada.paciente;

  /**
   * A mesma chave devolve o MESMO agendamento — e o MESMO link. O token é
   * recomputado a partir da linha que EXISTE no banco (id + chave), nunca
   * de um id gerado nesta requisição: o perdedor de uma corrida com a
   * mesma chave recebia um link que não abria nada.
   */
  const devolverExistente = (linha: Linha): ResultadoCriacao => {
    const mesmoPedido = linha.patientEmail === paciente.email
      && linha.typeId === t.id
      && linha.visitStartsAt.toISOString() === new Date(entrada.inicio).toISOString();
    if (!mesmoPedido) throw new IdempotenciaConflitanteError();
    const token = tokenGestaoPara(linha.id, ctx.idempotencyKey);
    return { agendamento: paraConfirmado(linha, t.label, modalidade, token, prof.cancelDeadlineHours), repetido: true };
  };

  // 1. Idempotência (caminho rápido, sem lock).
  const repetido = await buscarPorIdempotencia(ctx.idempotencyKey);
  if (repetido) return devolverExistente(repetido);

  // 2. Limites contra abuso — caminho rápido, sem lock. A contagem que
  //    VALE é a de dentro da transação (SEC-01).
  const ipHash = hashIp(ctx.ip);
  await conferirLimites(db(), { pid, ipHash, email: paciente.email, agora });

  // 3. O horário pedido é um dos OFERTADOS agora — contra a agenda real,
  //    ao vivo? (impede reservar fora do expediente com um POST à mão, e
  //    pega o plantão que ela acabou de marcar no celular)
  const inicioClinico = new Date(entrada.inicio);
  // Fora do alcance não é "ofertado" — e nem chega ao banco (PT-03).
  if (!dentroDoAlcance(inicioClinico, agora)) throw new SlotIndisponivelError();
  const data = dataLocal(inicioClinico);
  const ofertadoEm = (r: RespostaDisponibilidade) =>
    r.dias.some((d) => d.slots.some((s) => s.inicio === inicioClinico.toISOString()));
  // Antes do FreeBusy ao vivo, o filtro de graça: um POST para as 03:00 não
  // pode custar uma chamada ao Google com o token da médica (SEC-04).
  if (!ofertadoEm(await disponibilidade({ tipo: t.slug, de: data, ate: data, agora, semAgendaExterna: true }))) {
    throw new SlotIndisponivelError();
  }
  if (!ofertadoEm(await disponibilidade({ tipo: t.slug, de: data, ate: data, agora, aoVivo: true }))) {
    throw new SlotIndisponivelError();
  }

  // 4. Intervalo bloqueado = buffer antes + consulta + buffer depois.
  const fimClinico = somarMinutos(inicioClinico, t.durationMin);
  const inicioBloqueio = somarMinutos(inicioClinico, -t.bufferBeforeMin);
  const fimBloqueio = somarMinutos(fimClinico, t.bufferAfterMin);

  // Id gerado aqui para o token de gestão existir já no INSERT.
  const id = crypto.randomUUID();
  const token = tokenGestaoPara(id, ctx.idempotencyKey);

  let criado: Linha;
  // `as`: atribuída dentro do callback da transação — sem isso o TS estreita para `null`.
  let existente = null as Linha | null;
  try {
    criado = await reservarSlot(() => db().transaction(async (tx) => {
      // Limites recontados sob lock: sem isso, N requisições simultâneas
      // para slots DIFERENTES contavam 0 juntas e todas passavam (SEC-01).
      // Ordem fixa dos locks (limites → slot): nunca forma ciclo.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${chaveDosLimites(pid).toString()}::bigint)`);
      await conferirLimites(tx, { pid, ipHash, email: paciente.email, agora });
      // Enfileira concorrentes do MESMO horário (ADR-004): 7s → 116ms.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${chaveDoSlot(pid, inicioBloqueio).toString()}::bigint)`);

      // Recheca a idempotência DEPOIS do lock. Dois envios simultâneos com
      // a mesma chave (o reenvio do 4G ruim) passam juntos pelo passo 1; o
      // lock os enfileira, e o segundo precisa ver a consulta do primeiro —
      // senão esbarra na exclusion constraint e recebe "horário ocupado"
      // pela própria consulta. Em READ COMMITTED, este SELECT já enxerga o
      // commit que liberou o lock.
      const [ja] = await tx.select().from(appointment)
        .where(eq(appointment.idempotencyKey, ctx.idempotencyKey)).limit(1);
      if (ja) { existente = ja; return ja; }

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
        consentVersion: VERSAO_CONSENTIMENTO,
        manageTokenHash: hashToken(token),   // só o hash vai para o banco
        icsUid: novoUid(),
        icsSequence: 0,
        idempotencyKey: ctx.idempotencyKey,
        syncState: 'pending',
      }).returning();
      if (!linha) throw new Error('INSERT não retornou linha');

      await tx.insert(auditLog).values({
        actor: 'patient', action: 'appointment.created', subjectId: linha.id,
        meta: { tipo: t.slug, comMotivo: Boolean(paciente.motivo), consentimento: VERSAO_CONSENTIMENTO },   // nunca o motivo em si
      });
      await enfileirar(tx, { tipo: 'confirmacao', chave: linha.id, appointmentId: linha.id });
      await enfileirar(tx, { tipo: 'nova_consulta', chave: linha.id, appointmentId: linha.id });
      return linha;
    }));
  } catch (e) {
    // Duas requisições simultâneas com a MESMA chave: a segunda bate no UNIQUE.
    if (codigoPg(e) === '23505' && String((e as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? '').includes('idempotency')) {
      return criarAgendamento(entrada, ctx);
    }
    throw e;
  }

  if (existente) return devolverExistente(existente);
  return { agendamento: paraConfirmado(criado, t.label, modalidade, token, prof.cancelDeadlineHours), repetido: false };
}

/**
 * Limites contra abuso. Roda duas vezes: fora da transação (caminho rápido,
 * sem custo de lock) e DENTRO, depois do lock dos limites — só a segunda
 * é garantia.
 */
async function conferirLimites(ex: Executor, p: { pid: string; ipHash: string; email: string; agora: Date }) {
  const umaHoraAtras = somarMinutos(p.agora, -60);
  const [porIp] = await ex.select({ n: count() }).from(appointment).where(and(
    eq(appointment.consentIpHash, p.ipHash), gte(appointment.createdAt, umaHoraAtras)));
  if ((porIp?.n ?? 0) >= LIMITES.porIpPorHora) {
    throw new LimiteExcedidoError('Muitos agendamentos em pouco tempo. Aguarde alguns minutos ou fale pelo WhatsApp.');
  }
  const [futuras] = await ex.select({ n: count() }).from(appointment).where(and(
    eq(appointment.practitionerId, p.pid),
    // `starts_at` ≤ `visit_starts_at` (buffer antes < 1 dia): o recorte usa
    // o índice da agenda e a canonicalização só roda sobre as futuras.
    gt(appointment.startsAt, somarMinutos(p.agora, -24 * 60)),
    gt(appointment.visitStartsAt, p.agora),
    eq(appointment.status, 'confirmed'),
    sql`${emailCanonicoSql} = ${emailCanonico(p.email)}`));
  if ((futuras?.n ?? 0) >= LIMITES.futurasPorEmail) {
    throw new LimiteExcedidoError(
      `Você já tem ${LIMITES.futurasPorEmail} consultas marcadas. Para marcar outra, fale pelo WhatsApp.`);
  }
  const [naHora] = await ex.select({ n: count() }).from(appointment).where(and(
    eq(appointment.practitionerId, p.pid), gte(appointment.createdAt, umaHoraAtras)));
  if ((naHora?.n ?? 0) >= LIMITES.porHoraNoTotal) {
    log.aviso('agendamento.limite-global', { limite: LIMITES.porHoraNoTotal });
    throw new LimiteExcedidoError('Muitos agendamentos agora. Tente de novo em alguns minutos ou fale pelo WhatsApp.');
  }
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
  prazoCancelamentoHoras: number;
  telehealthUrl: string | null;
};

export async function buscarPorToken(token: string, agora = new Date()): Promise<AgendamentoGestao | null> {
  if (!tokenValido(token)) return null;
  const [r] = await db().select({ a: appointment, label: appointmentType.label, kind: appointmentType.locationKind, prof: practitioner })
    .from(appointment)
    .innerJoin(appointmentType, eq(appointment.typeId, appointmentType.id))
    .innerJoin(practitioner, eq(appointment.practitionerId, practitioner.id))
    .where(eq(appointment.manageTokenHash, hashToken(token)))
    .limit(1);
  if (!r || r.a.anonymizedAt) return null;

  const modalidade = r.kind as Modalidade;
  return {
    linha: r.a,
    tipoLabel: r.label,
    modalidade,
    quando: formatarParaPaciente(r.a.visitStartsAt),
    local: localConsulta(modalidade),
    podeCancelar: podeCancelarPeloLink(r.a, r.prof.cancelDeadlineHours, agora),
    prazoCancelamentoHoras: r.prof.cancelDeadlineHours,
    telehealthUrl: modalidade === 'telehealth' ? r.prof.telehealthUrl : null,
  };
}

export async function cancelarPorToken(token: string, agora = new Date()): Promise<AgendamentoGestao> {
  const atual = await buscarPorToken(token, agora);
  if (!atual) throw new AgendamentoInexistenteError();
  if (atual.linha.status === 'cancelled') return atual;       // idempotente
  if (!atual.podeCancelar) throw new PrazoCancelamentoError(atual.prazoCancelamentoHoras);

  await db().transaction(async (tx) => {
    const feitos = await tx.update(appointment).set({
      status: 'cancelled',
      cancelledAt: agora,
      cancelledBy: 'patient',
      // RFC 5545: sem incrementar, o iPhone IGNORA o cancelamento.
      icsSequence: sql`${appointment.icsSequence} + 1`,
      syncState: 'pending',             // o evento sai da agenda do Google
      syncAttempts: 0,
      syncNextAt: null,
      updatedAt: agora,
    }).where(and(eq(appointment.id, atual.linha.id), eq(appointment.status, 'confirmed')))
      .returning({ id: appointment.id });
    // Dois cliques simultâneos: só quem de fato cancelou audita e avisa.
    if (feitos.length === 0) return;

    await tx.insert(auditLog).values({
      actor: 'patient', action: 'appointment.cancelled', subjectId: atual.linha.id, meta: {},
    });
    await enfileirar(tx, { tipo: 'cancelamento', chave: atual.linha.id, appointmentId: atual.linha.id });
    await enfileirar(tx, { tipo: 'cancelamento_medica', chave: atual.linha.id, appointmentId: atual.linha.id });
  });

  return (await buscarPorToken(token, agora))!;
}

/**
 * LGPD Art. 8º §5º: revogar o consentimento de saúde apaga o motivo NA
 * HORA. O evento do Google é reescrito sem ele (sync volta a `pending`).
 */
export async function revogarMotivoPorToken(token: string): Promise<AgendamentoGestao> {
  const atual = await buscarPorToken(token);
  if (!atual) throw new AgendamentoInexistenteError();
  if (!atual.linha.patientNote) return atual;

  await db().transaction(async (tx) => {
    await tx.update(appointment).set({
      patientNote: null,
      consentHealthAt: null,
      syncState: atual.linha.status === 'confirmed' ? 'pending' : atual.linha.syncState,
      syncAttempts: 0,
      syncNextAt: null,
      updatedAt: new Date(),
    }).where(eq(appointment.id, atual.linha.id));
    await tx.insert(auditLog).values({
      actor: 'patient', action: 'data.health_note_revoked', subjectId: atual.linha.id, meta: {},
    });
  });
  return (await buscarPorToken(token))!;
}

/** .ics do agendamento: REQUEST se ativo, CANCEL se cancelado. */
export async function icsPorToken(token: string): Promise<string | null> {
  const g = await buscarPorToken(token);
  if (!g) return null;
  const metodo = g.linha.status === 'cancelled' ? 'CANCEL' : 'REQUEST';
  return gerarIcs(dadosIcs(g.linha, g.tipoLabel, g.modalidade, `${urlSite()}/consulta/${token}`), metodo);
}
