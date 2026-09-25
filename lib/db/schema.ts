/**
 * Schema — docs/00-ARQUITETURA.md §6
 *
 * A constraint EXCLUDE USING gist que impede overbooking NÃO é gerada pelo
 * Drizzle; vive numa migration escrita à mão (0001_exclusion.sql).
 * Ver docs/adr/ADR-004-antioverbooking.md
 */
import {
  pgTable, uuid, text, integer, smallint, boolean, timestamp, date, time,
  jsonb, bigserial, index, unique, check, primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const practitioner = pgTable('practitioner', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  crm: text('crm').notNull(),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // ── Políticas editáveis no /admin/configuracoes (FASE-09 §3.4) ──────────
  /** Antecedência mínima para agendar, em horas. */
  leadTimeHours: smallint('lead_time_hours').notNull().default(12),
  /** Até quantos dias à frente a agenda abre. */
  horizonDays: smallint('horizon_days').notNull().default(60),
  /** Até quantas horas antes o paciente cancela sozinho pelo link. */
  cancelDeadlineHours: smallint('cancel_deadline_hours').notNull().default(24),
  /** Sala fixa de vídeo (Meet, Zoom…). Sem ela, o link vai por WhatsApp. */
  telehealthUrl: text('telehealth_url'),
  /**
   * O motivo (dado de saúde) vai na descrição do evento do Google?
   * FASE-05 §4: ela é a controladora e precisa dele para se preparar; com
   * `false`, o evento leva só o link do painel. Padrão DESLIGADO: o dado de
   * saúde só sai do banco se ela escolher (SEC-06, LGPD art. 11).
   */
  includeNoteInEvent: boolean('include_note_in_event').notNull().default(false),
  /**
   * Sessões do painel emitidas ANTES disto não valem mais ("Sair" derruba o
   * cookie em todos os aparelhos, inclusive um copiado — SEC-10).
   */
  sessionsValidAfter: timestamp('sessions_valid_after', { withTimezone: true }),
}, (t) => [
  check('lead_time_range', sql`${t.leadTimeHours} between 0 and 168`),
  check('horizon_range', sql`${t.horizonDays} between 7 and 180`),
  check('cancel_deadline_range', sql`${t.cancelDeadlineHours} between 0 and 168`),
]);

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
  /**
   * Horário CLÍNICO (o que o paciente vê), gravado no momento da reserva.
   * Não é derivado dos buffers do tipo: se a médica mudar o intervalo entre
   * consultas, os agendamentos já feitos não podem mudar de hora na tela.
   */
  visitStartsAt: timestamp('visit_starts_at', { withTimezone: true }).notNull(),
  visitEndsAt: timestamp('visit_ends_at', { withTimezone: true }).notNull(),
  /** Idempotency-Key do POST: repetir a requisição não duplica a consulta. */
  idempotencyKey: text('idempotency_key').unique(),
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
  /** Versão do texto de consentimento aceito (FASE-10 §3.3). */
  consentVersion: text('consent_version'),

  googleEventId: text('google_event_id'),
  syncState: text('sync_state').notNull().default('pending'),
  syncAttempts: smallint('sync_attempts').notNull().default(0),
  /** Código curto do erro (nunca a mensagem crua: pode carregar PII). */
  syncLastError: text('sync_last_error'),
  /** Backoff da fila: 1 → 5 → 15 → 60 → 240 min (FASE-05 §6). */
  syncNextAt: timestamp('sync_next_at', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),

  manageTokenHash: text('manage_token_hash').notNull(),
  icsUid: text('ics_uid').notNull().unique(),
  /** RFC 5545: incrementa a cada alteração, senão clientes descartam o update. */
  icsSequence: integer('ics_sequence').notNull().default(0),

  reminderD1At: timestamp('reminder_d1_at', { withTimezone: true }),
  reminderH2At: timestamp('reminder_h2_at', { withTimezone: true }),

  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  /** 'patient' (link) · 'practitioner' (painel) · 'calendar' (apagado no Google). */
  cancelledBy: text('cancelled_by'),
  /** Recado opcional da médica ao cancelar — vai no e-mail ao paciente. */
  cancelReason: text('cancel_reason'),
  /** Hard bounce/reclamação no e-mail (webhook da Resend): avisar por WhatsApp. */
  emailBouncedAt: timestamp('email_bounced_at', { withTimezone: true }),
  /** LGPD Art. 18: eliminação anonimiza a linha em vez de apagá-la. */
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),

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
  check('appointment_visit_inside', sql`${t.visitStartsAt} >= ${t.startsAt} and ${t.visitEndsAt} <= ${t.endsAt}`),
  index('appointment_ip_recente_idx').on(t.consentIpHash, t.createdAt),
  index('appointment_email_idx').on(t.patientEmail),
  check('appointment_cancelled_by', sql`${t.cancelledBy} is null or ${t.cancelledBy} in ('patient','practitioner','calendar')`),
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
  /** `resourceId` do canal push: o webhook confere, contra replay (§9). */
  channelResourceId: text('channel_resource_id'),
  channelExpiresAt: timestamp('channel_expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
}, (t) => [
  unique('calendar_connection_unica').on(t.practitionerId, t.provider, t.calendarId),
  check('provider_google', sql`${t.provider} = 'google'`),
]);

/**
 * Cache do FreeBusy, por DIA local. Serve a degradação da ADR-002: se o
 * Google falhar, o último resultado (até 15 min) continua valendo.
 * Guarda só intervalos ocupados — nenhum título, nenhum detalhe.
 */
export const busyCache = pgTable('busy_cache', {
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioner.id),
  day: date('day').notNull(),
  /** [[inicioISO, fimISO], …] */
  intervals: jsonb('intervals').$type<[string, string][]>().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.practitionerId, t.day] }),
]);

/**
 * Fila de saída (outbox) de e-mails. A linha nasce na MESMA transação do
 * fato que a motiva; o envio acontece depois e é reprocessável.
 * `dedup_key` único: rodar o cron duas vezes nunca duplica e-mail (FASE-08).
 */
export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  dedupKey: text('dedup_key').notNull().unique(),
  appointmentId: uuid('appointment_id').references(() => appointment.id),
  kind: text('kind').notNull(),
  /** 'patient' | 'practitioner' */
  recipient: text('recipient').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: smallint('attempts').notNull().default(0),
  nextAt: timestamp('next_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  /** Id da Resend — liga o webhook de bounce ao agendamento. */
  providerId: text('provider_id'),
  lastError: text('last_error'),
  /** Dados do e-mail que não moram no agendamento (ex.: alerta ao admin). */
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('notification_fila_idx').on(t.status, t.nextAt),
  index('notification_provider_idx').on(t.providerId),
  check('notification_status', sql`${t.status} in ('pending','sent','failed','skipped')`),
  check('notification_recipient', sql`${t.recipient} in ('patient','practitioner')`),
]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  subjectId: uuid('subject_id'),
  meta: jsonb('meta').notNull().default({}),
}, (t) => [
  // Retenção (FASE-10 §3.5) apaga por data.
  index('audit_log_at_idx').on(t.at),
]);
