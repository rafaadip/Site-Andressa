-- Horário clínico gravado (não derivado dos buffers) + chave de idempotência.
-- Três passos para funcionar também em tabela com linhas:
-- adiciona nulo → preenche → exige NOT NULL.
ALTER TABLE "appointment" ADD COLUMN "visit_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "visit_ends_at" timestamp with time zone;--> statement-breakpoint
UPDATE "appointment" SET "visit_starts_at" = "starts_at", "visit_ends_at" = "ends_at" WHERE "visit_starts_at" IS NULL;--> statement-breakpoint
ALTER TABLE "appointment" ALTER COLUMN "visit_starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ALTER COLUMN "visit_ends_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE INDEX "appointment_ip_recente_idx" ON "appointment" USING btree ("consent_ip_hash","created_at");--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_visit_inside" CHECK ("appointment"."visit_starts_at" >= "appointment"."starts_at" and "appointment"."visit_ends_at" <= "appointment"."ends_at");
