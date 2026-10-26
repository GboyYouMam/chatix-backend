CREATE TYPE "public"."fight_outcome" AS ENUM('ko', 'rage_quit', 'cancelled');--> statement-breakpoint
CREATE TABLE "fights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player1_id" uuid NOT NULL,
	"player2_id" uuid,
	"winner_id" uuid,
	"stake_type" varchar(20) NOT NULL,
	"stake_amount" integer NOT NULL,
	"outcome" "fight_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"key" varchar(40) NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "featured_achievements" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "messages_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "aura_farm_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fights_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fights_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "win_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loss_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fight_title" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fight_title_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "debt_paid_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_player1_id_users_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_player2_id_users_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fights_player1_created_at_idx" ON "fights" USING btree ("player1_id","created_at");--> statement-breakpoint
CREATE INDEX "fights_player2_created_at_idx" ON "fights" USING btree ("player2_id","created_at");--> statement-breakpoint
CREATE INDEX "fights_winner_created_at_idx" ON "fights" USING btree ("winner_id","created_at");--> statement-breakpoint
CREATE INDEX "user_achievements_key_idx" ON "user_achievements" USING btree ("key");--> statement-breakpoint
UPDATE users SET fight_title = forced_title, fight_title_until = now() + interval '24 hours' WHERE forced_title IN ('true adam', 'sub5');--> statement-breakpoint
UPDATE users SET forced_title = NULL WHERE forced_title IN ('true adam', 'sub5');
