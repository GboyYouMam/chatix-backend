ALTER TABLE "users" ADD COLUMN "stimulus_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_stimulus_at" timestamp with time zone;