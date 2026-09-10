/**
 * Inserção de agendamento com tratamento dos DOIS erros de concorrência.
 *
 * A constraint EXCLUDE USING gist (ADR-004) impede overbooking, mas sob
 * concorrência ela se manifesta de duas formas diferentes:
 *
 *   23P01  exclusion_violation — o conflito foi detectado direto.
 *          Alguém já tem o horário. Resposta: 409, definitivo.
 *
 *   40P01  deadlock_detected — várias transações esperando umas pelas
 *          outras no mesmo intervalo formaram um ciclo, e o Postgres
 *          matou uma delas. O "morto" NÃO é necessariamente um perdedor:
 *          se a vencedora tiver abortado, ele conseguiria inserir.
 *          Resposta: tentar de novo, poucas vezes, com espera curta.
 *
 * Sem este tratamento, ~15% das requisições sob alta concorrência
 * retornariam 500 em vez de 409 — verificado empiricamente com 20
 * inserções simultâneas (tests/integration/overbooking.test.ts).
 *
 * ── Por que existe também um advisory lock ──────────────────────────────
 * Medido: numa rajada de 20 inserções no mesmo slot, o ciclo de espera no
 * índice GiST dispara o detector de deadlock do Postgres, cujo
 * `deadlock_timeout` é de 1 SEGUNDO por padrão. O resultado é uma latência
 * de 7s para o paciente — inaceitável, e invisível em teste sequencial.
 *
 * `chaveDoSlot()` + `pg_advisory_xact_lock` fazem os concorrentes do MESMO
 * horário formarem uma FILA (lock barato, liberado no commit) em vez de um
 * ciclo. Slots diferentes não se bloqueiam. A exclusion constraint continua
 * sendo a garantia final — o advisory lock é otimização de latência, não
 * de correção.
 */

export const PG_EXCLUSION_VIOLATION = '23P01';
export const PG_DEADLOCK_DETECTED = '40P01';

export class SlotIndisponivelError extends Error {
  readonly codigo = 'SLOT_INDISPONIVEL';
  constructor() {
    super('Este horário acabou de ser reservado. Escolha outro.');
    this.name = 'SlotIndisponivelError';
  }
}

function codigoPg(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined;
}

/**
 * Chave de 64 bits estável para o par (profissional, início do slot).
 * Colisão entre slots distintos só custa uma serialização desnecessária,
 * nunca correção — a exclusion constraint permanece.
 */
export function chaveDoSlot(practitionerId: string, inicio: Date): bigint {
  const texto = `${practitionerId}|${inicio.toISOString()}`;
  // FNV-1a de 64 bits — determinístico e sem dependência.
  let h = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(texto, 'utf8')) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  // Postgres usa bigint COM sinal.
  return h > 0x7fffffffffffffffn ? h - 0x10000000000000000n : h;
}

/** Espera curta com jitter, para desfazer o ciclo em vez de recriá-lo. */
function esperar(tentativa: number): Promise<void> {
  const base = 15 * 2 ** tentativa;              // 15ms, 30ms, 60ms
  const jitter = Math.random() * base * 0.5;
  return new Promise((r) => setTimeout(r, base + jitter));
}

/**
 * Executa a inserção, traduzindo conflito de concorrência em
 * `SlotIndisponivelError` (→ HTTP 409) e reprocessando deadlock.
 *
 * @param inserir  a operação; deve ser idempotente até o commit
 */
export async function reservarSlot<T>(
  inserir: () => Promise<T>,
  maxTentativas = 3,
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await inserir();
    } catch (e) {
      const code = codigoPg(e);

      // Conflito definitivo: alguém tem o horário.
      if (code === PG_EXCLUSION_VIOLATION) throw new SlotIndisponivelError();

      // Vítima de deadlock: pode ou não ser perdedora. Tenta de novo.
      if (code === PG_DEADLOCK_DETECTED && tentativa < maxTentativas - 1) {
        await esperar(tentativa);
        continue;
      }

      // Esgotou as tentativas de deadlock → o horário é de outro.
      if (code === PG_DEADLOCK_DETECTED) throw new SlotIndisponivelError();

      throw e;
    }
  }
}

/**
 * Contrato mínimo de transação que `reservarSlotSerializado` precisa.
 * Compatível com o cliente `postgres` e com o Drizzle.
 */
export type ExecutorSql = {
  <T = unknown>(strings: TemplateStringsArray, ...valores: unknown[]): Promise<T>;
};

/**
 * Reserva um slot enfileirando os concorrentes do MESMO horário.
 *
 * Uso: dentro de uma transação, ANTES do INSERT.
 *   await sql.begin(async (tx) => {
 *     await travarSlot(tx, practitionerId, inicio);
 *     return tx`INSERT INTO appointment ...`;
 *   });
 */
export async function travarSlot(
  tx: ExecutorSql,
  practitionerId: string,
  inicio: Date,
): Promise<void> {
  const chave = chaveDoSlot(practitionerId, inicio);
  // xact: liberado automaticamente no commit/rollback — sem risco de vazar lock.
  await tx`SELECT pg_advisory_xact_lock(${chave}::bigint)`;
}
