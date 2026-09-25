CREATE TABLE "busy_cache" (
	"practitioner_id" uuid NOT NULL,
	"day" date NOT NULL,
	"intervals" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "busy_cache_practitioner_id_day_pk" PRIMARY KEY("practitioner_id","day")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" text NOT NULL,
	"appointment_id" uuid,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_id" text,
	"last_error" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_dedup_key_unique" UNIQUE("dedup_key"),
	CONSTRAINT "notification_status" CHECK ("notification"."status" in ('pending','sent','failed','skipped')),
	CONSTRAINT "notification_recipient" CHECK ("notification"."recipient" in ('patient','practitioner'))
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "sync_next_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "email_bounced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD COLUMN "channel_resource_id" text;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD COLUMN "connected_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD COLUMN "last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "lead_time_hours" smallint DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "horizon_days" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "cancel_deadline_hours" smallint DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "telehealth_url" text;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "include_note_in_event" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "busy_cache" ADD CONSTRAINT "busy_cache_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_fila_idx" ON "notification" USING btree ("status","next_at");--> statement-breakpoint
CREATE INDEX "notification_provider_idx" ON "notification" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "appointment_email_idx" ON "appointment" USING btree ("patient_email");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_cancelled_by" CHECK ("appointment"."cancelled_by" is null or "appointment"."cancelled_by" in ('patient','practitioner','calendar'));--> statement-breakpoint
ALTER TABLE "practitioner" ADD CONSTRAINT "lead_time_range" CHECK ("practitioner"."lead_time_hours" between 0 and 168);--> statement-breakpoint
ALTER TABLE "practitioner" ADD CONSTRAINT "horizon_range" CHECK ("practitioner"."horizon_days" between 7 and 180);--> statement-breakpoint
ALTER TABLE "practitioner" ADD CONSTRAINT "cancel_deadline_range" CHECK ("practitioner"."cancel_deadline_hours" between 0 and 168);