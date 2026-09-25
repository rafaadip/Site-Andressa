ALTER TABLE "practitioner" ALTER COLUMN "include_note_in_event" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "practitioner" ADD COLUMN "sessions_valid_after" timestamp with time zone;