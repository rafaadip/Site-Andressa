/**
 * Pedidos de contato do formulário da home.
 *
 * Gravação: o schema (lib/validation/contato.ts) valida de novo no
 * servidor — o navegador nunca é confiado. Inserção só pelo builder do
 * Drizzle (parâmetros, nunca SQL montado com texto). Limites contra abuso
 * contados SOB advisory lock (regra 17): fora da transação é só o caminho
 * rápido; dentro, depois do lock, é a garantia.
 */
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { chaveDeLock } from '../db/reservas';
import { somarMinutos } from '../datetime';
import { hashIp } from '../seguranca';
import { log } from '../log';
import { practitionerId, LimiteExcedidoError } from '../agendamento/servico';
import { VERSAO_CONSENTIMENTO_CONTATO, type Contato } from '../validation/contato';

const { contactRequest, auditLog } = schema;

export const LIMITES_CONTATO_ABUSO = {
  /** Pedidos por origem (hash de IP) por hora. */
  porIpPorHora: 3,
  /** Pedidos por hora somando todas as origens: acima disto é robô. */
  porHoraNoTotal: 20,
} as const;

type Executor = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0] | ReturnType<typeof db>;

async function conferirLimites(ex: Executor, pid: string, ipHash: string, agora: Date) {
  const umaHoraAtras = somarMinutos(agora, -60);
  const [porIp] = await ex.select({ n: count() }).from(contactRequest)
    .where(and(eq(contactRequest.consentIpHash, ipHash), gte(contactRequest.createdAt, umaHoraAtras)));
  if ((porIp?.n ?? 0) >= LIMITES_CONTATO_ABUSO.porIpPorHora) {
    throw new LimiteExcedidoError('Recebemos vários pedidos seus agora há pouco. Continue pelo WhatsApp.');
  }
  const [naHora] = await ex.select({ n: count() }).from(contactRequest)
    .where(and(eq(contactRequest.practitionerId, pid), gte(contactRequest.createdAt, umaHoraAtras)));
  if ((naHora?.n ?? 0) >= LIMITES_CONTATO_ABUSO.porHoraNoTotal) {
    log.aviso('contato.limite-global', { limite: LIMITES_CONTATO_ABUSO.porHoraNoTotal });
    throw new LimiteExcedidoError('Muitos pedidos agora. Continue pelo WhatsApp.');
  }
}

/** Grava um pedido já validado. Devolve só o id — nada do paciente volta. */
export async function registrarContato(c: Contato, p: { ip: string; agora?: Date }): Promise<{ id: string }> {
  const agora = p.agora ?? new Date();
  const pid = await practitionerId();
  const ipHash = hashIp(p.ip);

  await conferirLimites(db(), pid, ipHash, agora);   // caminho rápido
  return db().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${chaveDeLock(`contatos|${pid}`).toString()}::bigint)`);
    await conferirLimites(tx, pid, ipHash, agora);   // a garantia
    const [linha] = await tx.insert(contactRequest).values({
      practitionerId: pid,
      firstName: c.nome,
      lastName: c.sobrenome,
      email: c.email,
      phone: c.telefone || null,
      age: c.idade,
      preferredPeriod: c.horario || null,
      reason: c.motivo,
      consentAt: agora,
      consentVersion: VERSAO_CONSENTIMENTO_CONTATO,
      consentIpHash: ipHash,
      createdAt: agora,
    }).returning({ id: contactRequest.id });
    return { id: linha!.id };
  });
}

// ── Painel ───────────────────────────────────────────────────────────────

export type LinhaContato = typeof contactRequest.$inferSelect;

/** Mais recentes primeiro; `pendentes` = ainda não retornados. */
export async function listarContatos(filtro: { pendentes?: boolean } = {}): Promise<LinhaContato[]> {
  const pid = await practitionerId();
  return db().select().from(contactRequest)
    .where(and(eq(contactRequest.practitionerId, pid), filtro.pendentes ? isNull(contactRequest.handledAt) : undefined))
    .orderBy(desc(contactRequest.createdAt))
    .limit(200);
}

export async function contarPendentes(): Promise<number> {
  const pid = await practitionerId();
  const [r] = await db().select({ n: count() }).from(contactRequest)
    .where(and(eq(contactRequest.practitionerId, pid), isNull(contactRequest.handledAt)));
  return r?.n ?? 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ContatoInexistenteError extends Error {
  constructor() { super('Esse contato não existe mais.'); this.name = 'ContatoInexistenteError'; }
}

export async function marcarContatoAtendido(id: string, atendido: boolean, agora = new Date()): Promise<void> {
  if (!UUID.test(id)) throw new ContatoInexistenteError();
  const pid = await practitionerId();
  await db().transaction(async (tx) => {
    const r = await tx.update(contactRequest).set({ handledAt: atendido ? agora : null })
      .where(and(eq(contactRequest.id, id), eq(contactRequest.practitionerId, pid)))
      .returning({ id: contactRequest.id });
    if (!r.length) throw new ContatoInexistenteError();
    await tx.insert(auditLog).values({
      actor: 'practitioner', action: atendido ? 'contact.handled' : 'contact.reopened', subjectId: id, meta: {},
    });
  });
}

/** Apaga a linha inteira (o pedido não tem histórico a preservar). */
export async function apagarContato(id: string): Promise<void> {
  if (!UUID.test(id)) throw new ContatoInexistenteError();
  const pid = await practitionerId();
  await db().transaction(async (tx) => {
    const r = await tx.delete(contactRequest)
      .where(and(eq(contactRequest.id, id), eq(contactRequest.practitionerId, pid)))
      .returning({ id: contactRequest.id });
    if (!r.length) throw new ContatoInexistenteError();
    // Trilha da exclusão sem o conteúdo apagado.
    await tx.insert(auditLog).values({ actor: 'practitioner', action: 'contact.deleted', subjectId: id, meta: {} });
  });
}

// ── Titular (LGPD Art. 18) ───────────────────────────────────────────────

export async function contatosDoTitular(email: string): Promise<LinhaContato[]> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return [];
  const pid = await practitionerId();
  return db().select().from(contactRequest)
    .where(and(eq(contactRequest.practitionerId, pid), eq(contactRequest.email, alvo)))
    .orderBy(desc(contactRequest.createdAt));
}
