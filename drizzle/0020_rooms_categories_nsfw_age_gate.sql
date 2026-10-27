ALTER TABLE "rooms" ADD COLUMN "category" varchar(24);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_confirmed_at" timestamp with time zone;