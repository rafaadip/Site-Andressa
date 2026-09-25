/**
 * Agenda pessoal da médica (Google FreeBusy) — FASE-05 §3, ADR-002.
 *
 * Três estados, e o site precisa se comportar bem nos três:
 *
 *   conectada   → FreeBusy ao vivo, com cache de 60 s por dia local.
 *   falhando    → serve o cache se tiver até 15 min (`degradado`); sem
 *                 cache confiável, só oferta a partir de D+2 — a médica
 *                 confirma manualmente (ADR-002, "cache também vazio").
 *   sem agenda  → sem Google conectado o site NÃO sabe dos plantões. Em
 *                 produção isso só é permitido com AGENDAMENTO_SEM_GOOGLE=aceito;
 *                 se a conexão EXISTIU e foi revogada, degrada para D+2.
 *
 * O cache guarda só intervalos ocupados — nenhum título, nenhum detalhe.
 */
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { Interval } from 'luxon';
import { db, schema } from '../db';
import { ehProducao, googleConfigurado } from '../env';
import { TZ_CLINICA, dataLocal, diasNoIntervalo, fimDoDiaLocal, horaLocalParaUtc, somarMinutos } from '../datetime';
import { log } from '../log';
import { clienteDa, conexaoAtiva, registrarErro, ultimaConexao } from './conexao';
import { GoogleApiError, GoogleRevogadoError } from './google';

const { busyCache } = schema;

export const CACHE_FRESCO_S = 60;
export const CACHE_DEGRADADO_S = 15 * 60;
/** Sem saber da agenda: só a partir de D+2, para dar tempo de confirmar. */
export const ANTECEDENCIA_DEGRADADA_H = 48;

export type ResultadoOcupados = {
  intervalos: Interval[];
  /** A agenda externa falhou e servimos sem ela (ou com cache). */
  degradado: boolean;
  /** Antecedência mínima forçada (horas) quando não há informação confiável. */
  antecedenciaMinimaHoras?: number;
};

export type EstadoAgenda = 'conectada' | 'revogada' | 'sem-google';

export async function estadoAgenda(practitionerId: string): Promise<EstadoAgenda> {
  if (!googleConfigurado()) return 'sem-google';
  if (await conexaoAtiva(practitionerId)) return 'conectada';
  return (await ultimaConexao(practitionerId)) ? 'revogada' : 'sem-google';
}

/**
 * O agendamento online pode ser oferecido?
 *
 * Sem a agenda do Google o site ofertaria horários em que a médica está de
 * plantão — o pior defeito possível do produto (ADR-002). Em produção isso
 * só com decisão CONSCIENTE: AGENDAMENTO_SEM_GOOGLE=aceito. Sem ela,
 * /agendar cai no WhatsApp. Agenda revogada NÃO fecha o site: degrada para
 * D+2 enquanto ela reconecta (o /admin grita).
 */
export async function agendamentoOnlineHabilitado(practitionerId: string): Promise<boolean> {
  if (process.env.AGENDAMENTO_SEM_GOOGLE === 'aceito') return true;
  if (!ehProducao()) return true;
  return (await estadoAgenda(practitionerId)) !== 'sem-google';
}

/** Dias locais cobertos por [de, ate). */
function diasDaJanela(de: Date, ate: Date): string[] {
  return diasNoIntervalo(dataLocal(de), dataLocal(somarMinutos(ate, -1)));
}

function paraIntervalos(pares: [string, string][]): Interval[] {
  return pares.map(([s, e]) => Interval.fromDateTimes(new Date(s), new Date(e)));
}

async function lerCache(pid: string, dias: string[], idadeMaxS: number): Promise<Interval[] | null> {
  const limite = new Date(Date.now() - idadeMaxS * 1000);
  const linhas = await db().select().from(busyCache).where(and(
    eq(busyCache.practitionerId, pid),
    inArray(busyCache.day, dias),
    gte(busyCache.fetchedAt, limite),
  ));
  // Só vale se TODOS os dias estiverem no cache: dia ausente ≠ dia livre.
  if (linhas.length !== dias.length) return null;
  return paraIntervalos(linhas.flatMap((l) => l.intervals));
}

async function gravarCache(pid: string, dias: string[], ocupados: { start: string; end: string }[]) {
  if (dias.length === 0) return;
  const agora = new Date();
  const valores = dias.map((dia) => {
    const ini = horaLocalParaUtc(dia, '00:00');
    const fim = fimDoDiaLocal(dia);
    const doDia = ocupados
      .filter((o) => new Date(o.start) < fim && new Date(o.end) > ini)
      .map((o): [string, string] => [o.start, o.end]);
    return { practitionerId: pid, day: dia, intervals: doDia, fetchedAt: agora };
  });
  await db().insert(busyCache).values(valores).onConflictDoUpdate({
    target: [busyCache.practitionerId, busyCache.day],
    set: { intervals: sql`excluded.intervals`, fetchedAt: agora },
  });
}

/** Mudança na agenda (webhook/sync): o cache inteiro deixa de valer. */
export async function invalidarCacheOcupados(practitionerId: string): Promise<void> {
  await db().delete(busyCache).where(eq(busyCache.practitionerId, practitionerId));
}

/**
 * Ocupações externas no intervalo [de, ate).
 *
 * @param aoVivo  ignora o cache fresco (criação do agendamento revalida
 *                contra a agenda real — docs/00-ARQUITETURA.md §8.2 passo 5)
 */
export async function buscarOcupadosExternos(
  practitionerId: string, de: Date, ate: Date, opcoes: { aoVivo?: boolean } = {},
): Promise<ResultadoOcupados> {
  const conexao = await conexaoAtiva(practitionerId);
  if (!conexao) {
    // Nunca conectada: sem informação externa (o opt-in já foi decidido).
    // Conectada e revogada: sabemos que NÃO sabemos — degrada.
    const revogada = googleConfigurado() && (await ultimaConexao(practitionerId)) !== null;
    return revogada
      ? { intervalos: [], degradado: true, antecedenciaMinimaHoras: ANTECEDENCIA_DEGRADADA_H }
      : { intervalos: [], degradado: false };
  }

  const dias = diasDaJanela(de, ate);
  if (!opcoes.aoVivo) {
    const fresco = await lerCache(practitionerId, dias, CACHE_FRESCO_S);
    if (fresco) return { intervalos: fresco, degradado: false };
  }

  try {
    // Consulta os dias INTEIROS: o cache por dia precisa estar completo.
    const inicio = horaLocalParaUtc(dias[0]!, '00:00');
    const fim = fimDoDiaLocal(dias[dias.length - 1]!);
    const ocupados = await clienteDa(conexao).ocupados(inicio, fim, TZ_CLINICA);
    await gravarCache(practitionerId, dias, ocupados);
    if (conexao.lastError) await registrarErro(conexao.id, null);
    return {
      intervalos: ocupados.map((o) => Interval.fromDateTimes(new Date(o.start), new Date(o.end))),
      degradado: false,
    };
  } catch (e) {
    const codigo = e instanceof GoogleApiError ? `${e.status}:${e.motivo}`
      : e instanceof GoogleRevogadoError ? 'invalid_grant' : 'erro';
    log.erro('freebusy.falhou', { codigo });
    if (!(e instanceof GoogleRevogadoError)) await registrarErro(conexao.id, codigo).catch(() => undefined);

    const recente = await lerCache(practitionerId, dias, CACHE_DEGRADADO_S);
    if (recente) return { intervalos: recente, degradado: true };
    return { intervalos: [], degradado: true, antecedenciaMinimaHoras: ANTECEDENCIA_DEGRADADA_H };
  }
}
