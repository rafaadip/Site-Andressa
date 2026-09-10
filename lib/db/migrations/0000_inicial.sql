-- Extensões exigidas pelo schema.
-- btree_gist: permite `practitioner_id WITH =` dentro de um índice GiST,
-- que é o que a constraint anti-overbooking (0001) precisa.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"patient_name" text NOT NULL,
	"patient_email" text NOT NULL,
	"patient_phone" text NOT NULL,
	"patient_note" text,
	"consent_lgpd_at" timestamp with time zone NOT NULL,
	"consent_health_at" timestamp with time zone,
	"consent_ip_hash" text NOT NULL,
	"google_event_id" text,
	"sync_state" text DEFAULT 'pending' NOT NULL,
	"sync_attempts" smallint DEFAULT 0 NOT NULL,
	"sync_last_error" text,
	"manage_token_hash" text NOT NULL,
	"ics_uid" text NOT NULL,
	"ics_sequence" integer DEFAULT 0 NOT NULL,
	"reminder_d1_at" timestamp with time zone,
	"reminder_h2_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"held_until" timestamp with time zone,
	CONSTRAINT "appointment_ics_uid_unique" UNIQUE("ics_uid"),
	CONSTRAINT "appointment_status" CHECK ("appointment"."status" in ('held','confirmed','cancelled','expired','no_show','completed')),
	CONSTRAINT "appointment_sync_state" CHECK ("appointment"."sync_state" in ('pending','synced','failed','skipped')),
	CONSTRAINT "appointment_order" CHECK ("appointment"."starts_at" < "appointment"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "appointment_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"duration_min" integer NOT NULL,
	"buffer_before_min" integer DEFAULT 0 NOT NULL,
	"buffer_after_min" integer DEFAULT 10 NOT NULL,
	"location_kind" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "appointment_type_slug" UNIQUE("practitioner_id","slug"),
	CONSTRAINT "duration_range" CHECK ("appointment_type"."duration_min" between 10 and 240),
	CONSTRAINT "location_kind_valid" CHECK ("appointment_type"."location_kind" in ('in_person','telehealth'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	CONSTRAINT "exception_kind" CHECK ("availability_exception"."kind" in ('block','extra')),
	CONSTRAINT "exception_order" CHECK ("availability_exception"."starts_at" < "availability_exception"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "availability_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"location_kind" text NOT NULL,
	"valid_from" date,
	"valid_until" date,
	CONSTRAINT "weekday_range" CHECK ("availability_rule"."weekday" between 0 and 6),
	CONSTRAINT "time_order" CHECK ("availability_rule"."start_time" < "availability_rule"."end_time")
);
--> statement-breakpoint
CREATE TABLE "calendar_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_email" text NOT NULL,
	"calendar_id" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"sync_token" text,
	"channel_id" text,
	"channel_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "calendar_connection_unica" UNIQUE("practitioner_id","provider","calendar_id"),
	CONSTRAINT "provider_google" CHECK ("calendar_connection"."provider" = 'google')
);
--> statement-breakpoint
CREATE TABLE "practitioner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"crm" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_type_id_appointment_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."appointment_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_type" ADD CONSTRAINT "appointment_type_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exception" ADD CONSTRAINT "availability_exception_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_agenda_idx" ON "appointment" USING btree ("practitioner_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointment_sync_idx" ON "appointment" USING btree ("sync_state");