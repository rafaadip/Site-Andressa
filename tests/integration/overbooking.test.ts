/**
 * Prova que a constraint EXCLUDE USING gist impede overbooking sob
 * concorrência real — não em teoria.
 *
 * Pula automaticamente quando não há DATABASE_URL_TEST (dev sem banco).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  reservarSlot, travarSlot, SlotIndisponivelError,
  PG_EXCLUSION_VIOLATION,
} from '@/lib/db/reservas';

const URL_TESTE = process.env.DATABASE_URL_TEST;
const d = URL_TESTE ? describe : describe.skip;

const PRACTITIONER = '11111111-1111-1111-1111-111111111111';
const TIPO = '22222222-2222-2222-2222-222222222222';

d('anti-overbooking sob concorrência', () => {
  let sql: postgres.Sql;

  beforeAll(async () => {
    sql = postgres(URL_TESTE!, { max: 25, onnotice: () => {} });
    await sql`DELETE FROM appointment`;
  });

  afterAll(async () => { await sql?.end(); });

  /** Caminho REAL da API: transação + advisory lock + insert. */
  async function agendarSerializado(inicio: string, fim: string, uid: string) {
    return sql.begin(async (tx) => {
      await travarSlot(tx as never, PRACTITIONER, new Date(inicio));
      return tx`
        INSERT INTO appointment (
          practitioner_id, type_id, starts_at, ends_at, status,
          patient_name, patient_email, patient_phone,
          consent_lgpd_at, consent_ip_hash, manage_token_hash, ics_uid
        ) VALUES (
          ${PRACTITIONER}, ${TIPO}, ${inicio}, ${fim}, 'confirmed',
          ${'Paciente ' + uid}, ${uid + '@x.com'}, '11999990000',
          now(), 'hash', 'token', ${uid}
        ) RETURNING id`;
    });
  }

  async function agendar(inicio: string, fim: string, uid: string) {
    return sql`
      INSERT INTO appointment (
        practitioner_id, type_id, starts_at, ends_at, status,
        patient_name, patient_email, patient_phone,
        consent_lgpd_at, consent_ip_hash, manage_token_hash, ics_uid
      ) VALUES (
        ${PRACTITIONER}, ${TIPO}, ${inicio}, ${fim}, 'confirmed',
        ${'Paciente ' + uid}, ${uid + '@x.com'}, '11999990000',
        now(), 'hash', 'token', ${uid}
      ) RETURNING id`;
  }

  it('20 requisições simultâneas no mesmo slot → exatamente UMA vence', async () => {
    // Passa por reservarSlot(), que é o caminho real da API: traduz
    // 23P01 em 409 e reprocessa 40P01 (deadlock). Sem isso, ~15% das
    // requisições viram 500 sob concorrência — ver lib/db/reservas.ts.
    const tentativas = Array.from({ length: 20 }, (_, i) =>
      reservarSlot(() =>
        agendarSerializado('2026-10-06 17:00:00+00', '2026-10-06 17:50:00+00', `concorrente-${i}`))
        .then(() => 'ok' as const)
        .catch((e: unknown) => {
          if (e instanceof SlotIndisponivelError) return 'conflito' as const;
          return Promise.reject(e);
        }),
    );

    const r = await Promise.all(tentativas);
    expect(r.filter((x) => x === 'ok')).toHaveLength(1);
    expect(r.filter((x) => x === 'conflito')).toHaveLength(19);

    const linhas = await sql<{ count: string }[]>`
      SELECT count(*) FROM appointment
      WHERE starts_at = '2026-10-06 17:00:00+00' AND status = 'confirmed'`;
    expect(Number(linhas[0]?.count)).toBe(1);
  });

  it('slots adjacentes e não sobrepostos entram todos', async () => {
    const horarios = [
      ['2026-10-07 17:00:00+00', '2026-10-07 17:50:00+00'],
      ['2026-10-07 17:50:00+00', '2026-10-07 18:40:00+00'],
      ['2026-10-07 18:40:00+00', '2026-10-07 19:30:00+00'],
    ] as const;

    const r = await Promise.all(
      horarios.map(([i, f], n) => agendar(i, f, `adjacente-${n}`)
        .then(() => 'ok' as const).catch(() => 'conflito' as const)),
    );
    expect(r).toEqual(['ok', 'ok', 'ok']);
  });

  it('cancelar libera o horário para outro paciente', async () => {
    await agendar('2026-10-08 17:00:00+00', '2026-10-08 17:50:00+00', 'cancelavel');
    await sql`UPDATE appointment SET status='cancelled' WHERE ics_uid='cancelavel'`;
    await expect(
      agendar('2026-10-08 17:00:00+00', '2026-10-08 17:50:00+00', 'substituto'),
    ).resolves.toBeDefined();
  });

  it('reserva "held" também bloqueia — não só "confirmed"', async () => {
    await sql`
      INSERT INTO appointment (
        practitioner_id, type_id, starts_at, ends_at, status,
        patient_name, patient_email, patient_phone,
        consent_lgpd_at, consent_ip_hash, manage_token_hash, ics_uid, held_until
      ) VALUES (
        ${PRACTITIONER}, ${TIPO}, '2026-10-09 17:00:00+00', '2026-10-09 17:50:00+00',
        'held', 'Em checkout', 'h@x.com', '11999990000',
        now(), 'hash', 'token', 'reserva-temp', now() + interval '10 minutes'
      )`;
    await expect(
      agendar('2026-10-09 17:20:00+00', '2026-10-09 18:10:00+00', 'invasor'),
    ).rejects.toMatchObject({ code: PG_EXCLUSION_VIOLATION });
  });

  it('reservarSlot traduz o conflito em erro de domínio, não em 500', async () => {
    await expect(
      reservarSlot(() =>
        agendar('2026-10-09 17:20:00+00', '2026-10-09 18:10:00+00', 'invasor-2')),
    ).rejects.toBeInstanceOf(SlotIndisponivelError);
  });

  it('reserva expirada deixa de bloquear após virar "expired"', async () => {
    await sql`UPDATE appointment SET status='expired' WHERE ics_uid='reserva-temp'`;
    await expect(
      agendar('2026-10-09 17:00:00+00', '2026-10-09 17:50:00+00', 'apos-expirar'),
    ).resolves.toBeDefined();
  });
});
