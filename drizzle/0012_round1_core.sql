ALTER TYPE "public"."room_state" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "rooms" RENAME COLUMN "quarantine_reason" TO "status_reason";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX "messages_room_created_idx" ON "messages" USING btree ("room_id","created_at" desc,"id" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_title_lower_unique" ON "rooms" USING btree (lower("title"));--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "quarantined_until";
