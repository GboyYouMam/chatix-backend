ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "upper_banner_url" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "left_banner_url" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "right_banner_url" varchar(255);
