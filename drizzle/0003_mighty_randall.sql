CREATE TYPE "public"."room_publicity" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TYPE "public"."room_state" ADD VALUE 'quarantined';--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "room_publicity" "room_publicity" DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "quarantine_reason" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "quarantined_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "warns_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_change_profile" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "forced_title" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "yap_cooldown" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "aura" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_mogged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_clown" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_glaze_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "debt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;