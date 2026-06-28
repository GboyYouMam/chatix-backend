CREATE TYPE "public"."room_state" AS ENUM('active', 'checkout', 'banned');--> statement-breakpoint
ALTER TABLE "rooms" RENAME COLUMN "status" TO "room_state";