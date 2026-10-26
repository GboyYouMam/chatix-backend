CREATE TABLE "profile_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"applied_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fights" ADD COLUMN "insured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "kind" varchar(12) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "theme" varchar(24) DEFAULT 'basement' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "sponsored_by_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "sponsored_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "boosted_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "spotlight_message_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "spotlight_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fight_insurance_armed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_effects" ADD CONSTRAINT "profile_effects_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_effects" ADD CONSTRAINT "profile_effects_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_effects_target_kind_expires_idx" ON "profile_effects" USING btree ("target_id","kind","expires_at");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_sponsored_by_id_users_id_fk" FOREIGN KEY ("sponsored_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;