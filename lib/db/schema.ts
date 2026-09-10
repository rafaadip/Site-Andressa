/**
 * Schema — docs/00-ARQUITETURA.md §6
 *
 * A constraint EXCLUDE USING gist que impede overbooking NÃO é gerada pelo
 * Drizzle; vive numa migration escrita à mão (0002_exclusion.sql).
 * Ver docs/adr/ADR-004-antioverbooking.md
 */
import {
  pgTable, uuid, text, integer, smallint, boolean, timestamp, date, time,
  jsonb, bigserial, index, unique, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const practitioner = pgTable('practitioner', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  crm: text('crm').notNull(),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentType = pgTable('appointment_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  durationMin: integer('duration_min').notNull(),
  bufferBeforeMin: integer('buffer_before_min').notNull().default(0),
  bufferAfterMin: integer('buffer_after_min').notNull().default(10),
  locationKind: text('location_kind').notNull(),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [
  unique('appointment_type_slug').on(t.practitionerId, t.slug),
  check('duration_range', sql`${t.durationMin} between 10 and 240`),
  check('location_kind_valid', sql`${t.locationKind} in ('in_person','telehealth')`),
]);

export const availabilityRule = pgTable('availability_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  /** 0=domingo … 6=sábado */
  weekday: smallint('weekday').notNull(),
  /** Hora LOCAL da clínica — "toda terça às 14h" é sobre o relógio de parede. */
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  locationKind: text('location_kind').notNull(),
  validFrom: date('valid_from'),
  validUntil: date('valid_until'),
}, (t) => [
  check('weekday_range', sql`${t.weekday} between 0 and 6`),
  check('time_order', sql`${t.startTime} < ${t.endTime}`),
]);

export const availabilityException = pgTable('availability_exception', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  kind: text('kind').notNull(),
  note: text('note'),
}, (t) => [
  check('exception_kind', sql`${t.kind} in ('block','extra')`),
  check('exception_order', sql`${t.startsAt} < ${t.endsAt}`),
]);

export const appointment = pgTable('appointment', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  typeId: uuid('type_id').notNull().references(() => appointmentType.id),

  /** Intervalo BLOQUEADO (inclui buffers) — é o que a exclusion protege. */
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('held'),

  patientName: text('patient_name').notNull(),
  patientEmail: text('patient_email').notNull(),
  patientPhone: text('patient_phone').notNull(),
  /** DADO SENSÍVEL (LGPD Art. 5º II): opcional, consentido, purgado em 90d. */
  patientNote: text('patient_note'),

  consentLgpdAt: timestamp('consent_lgpd_at', { withTimezone: true }).notNull(),
  consentHealthAt: timestamp('consent_health_at', { withTimezone: true }),
  /** SHA-256(ip + salt): prova de consentimento sem armazenar o IP. */
  consentIpHash: text('consent_ip_hash').notNull(),

  googleEventId: text('google_event_id'),
  syncState: text('sync_state').notNull().default('pending'),
  syncAttempts: smallint('sync_attempts').notNull().default(0),
  syncLastError: text('sync_last_error'),

  manageTokenHash: text('manage_token_hash').notNull(),
  icsUid: text('ics_uid').notNull().unique(),
  /** RFC 5545: incrementa a cada alteração, senão clientes descartam o update. */
  icsSequence: integer('ics_sequence').notNull().default(0),

  reminderD1At: timestamp('reminder_d1_at', { withTimezone: true }),
  reminderH2At: timestamp('reminder_h2_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** Reserva temporária durante o checkout. */
  heldUntil: timestamp('held_until', { withTimezone: true }),
}, (t) => [
  index('appointment_agenda_idx').on(t.practitionerId, t.startsAt),
  index('appointment_sync_idx').on(t.syncState),
  check('appointment_status', sql`${t.status} in ('held','confirmed','cancelled','expired','no_show','completed')`),
  check('appointment_sync_state', sql`${t.syncState} in ('pending','synced','failed','skipped')`),
  check('appointment_order', sql`${t.startsAt} < ${t.endsAt}`),
]);

export const calendarConnection = pgTable('calendar_connection', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  /** Só 'google': CalDAV/iCloud fora de escopo (ADR-003). */
  provider: text('provider').notNull(),
  accountEmail: text('account_email').notNull(),
  calendarId: text('calendar_id').notNull(),
  /** AES-256-GCM. Nunca em texto claro. */
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  syncToken: text('sync_token'),
  channelId: text('channel_id'),
  channelExpiresAt: timestamp('channel_expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  unique('calendar_connection_unica').on(t.practitionerId, t.provider, t.calendarId),
  check('provider_google', sql`${t.provider} = 'google'`),
]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  subjectId: uuid('subject_id'),
  meta: jsonb('meta').notNull().default({}),
});
