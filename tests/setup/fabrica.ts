/**
 * Utilidades dos testes de integração: limpar o banco e criar consultas
 * direto no SQL (para horários que as regras fictícias não ofertariam —
 * ex.: "amanhã" quando amanhã é sábado).
 */
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { hashToken, tokenGestaoPara } from '@/lib/seguranca';

export const PRACTITIONER = '00000000-0000-4000-8000-000000000001';
export const TIPO_PRESENCIAL = '00000000-0000-4000-8000-000000000011';
export const TIPO_TELE = '00000000-0000-4000-8000-000000000012';

/** ISO, não Date: o Drizzle troca o serializador de data do cliente compartilhado. */
const iso = (d: Date) => d.toISOString();

export async function limparBanco(sql: postgres.Sql) {
  await sql`DELETE FROM notification`;
  await sql`DELETE FROM audit_log`;
  await sql`DELETE FROM appointment`;
  await sql`DELETE FROM busy_cache`;
  await sql`DELETE FROM calendar_connection`;
  await sql`DELETE FROM availability_exception`;
  await sql`UPDATE practitioner SET lead_time_hours = 12, horizon_days = 60, cancel_deadline_hours = 24,
                                    telehealth_url = NULL, include_note_in_event = true`;
}

/** Cria uma consulta confirmada de 40 min (+10 de buffer) direto no banco. */
export async function inserirConsulta(sql: postgres.Sql, p: {
  inicio: Date; email?: string; nome?: string; motivo?: string | null; criadaEm?: Date; tipo?: string; status?: string;
}): Promise<{ id: string; token: string }> {
  const id = randomUUID();
  const chave = randomUUID();
  const token = tokenGestaoPara(id, chave);
  const fim = new Date(p.inicio.getTime() + 40 * 60_000);
  const fimBloqueio = new Date(fim.getTime() + 10 * 60_000);
  await sql`
    INSERT INTO appointment (id, practitioner_id, type_id, starts_at, ends_at, visit_starts_at, visit_ends_at,
      status, patient_name, patient_email, patient_phone, patient_note, consent_lgpd_at, consent_health_at,
      consent_ip_hash, manage_token_hash, ics_uid, idempotency_key, created_at, sync_state)
    VALUES (${id}, ${PRACTITIONER}, ${p.tipo ?? TIPO_PRESENCIAL}, ${iso(p.inicio)}, ${iso(fimBloqueio)}, ${iso(p.inicio)}, ${iso(fim)},
      ${p.status ?? 'confirmed'}, ${p.nome ?? 'Bia Lima'}, ${p.email ?? `bia.${id.slice(0, 6)}@exemplo.com`}, '+5511912345678',
      ${p.motivo ?? null}, now(), ${p.motivo ? iso(new Date()) : null}, 'hash', ${hashToken(token)}, ${`${id}@teste`},
      ${chave}, ${iso(p.criadaEm ?? new Date())}, 'synced')`;
  return { id, token };
}
