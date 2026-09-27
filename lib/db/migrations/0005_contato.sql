CREATE TABLE "contact_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"age" smallint NOT NULL,
	"preferred_period" text,
	"reason" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"consent_ip_hash" text NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_request_age" CHECK ("contact_request"."age" between 1 and 120),
	CONSTRAINT "contact_request_period" CHECK ("contact_request"."preferred_period" is null or "contact_request"."preferred_period" in ('manha','tarde','noite')),
	CONSTRAINT "contact_request_reason" CHECK ("contact_request"."reason" ~ '^[a-z-]{2,30}$'),
	CONSTRAINT "contact_request_names" CHECK (char_length("contact_request"."first_name") between 1 and 60 and char_length("contact_request"."last_name") between 1 and 60),
	CONSTRAINT "contact_request_email" CHECK (char_length("contact_request"."email") between 3 and 254)
);
--> statement-breakpoint
ALTER TABLE "contact_request" ADD CONSTRAINT "contact_request_practitioner_id_practitioner_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_request_recentes_idx" ON "contact_request" USING btree ("practitioner_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_request_ip_idx" ON "contact_request" USING btree ("consent_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "contact_request_email_idx" ON "contact_request" USING btree ("email");