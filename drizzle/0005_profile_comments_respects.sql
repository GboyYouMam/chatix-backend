DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'users'
			AND column_name = 'respect_count'
	) THEN
		ALTER TABLE "users" ADD COLUMN "respect_count" integer DEFAULT 0 NOT NULL;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'users'
			AND column_name = 'respect_count'
			AND data_type <> 'integer'
	) THEN
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET DATA TYPE integer USING 0;
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET DEFAULT 0;
		UPDATE "users" SET "respect_count" = 0 WHERE "respect_count" IS NULL;
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET NOT NULL;
	ELSE
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET DEFAULT 0;
		UPDATE "users" SET "respect_count" = 0 WHERE "respect_count" IS NULL;
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET NOT NULL;
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "profile_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_user_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_respects" (
	"profile_user_id" uuid NOT NULL,
	"admirer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_respects_profile_user_id_admirer_id_pk" PRIMARY KEY("profile_user_id","admirer_id")
);
--> statement-breakpoint
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_respects" ADD CONSTRAINT "profile_respects_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_respects" ADD CONSTRAINT "profile_respects_admirer_id_users_id_fk" FOREIGN KEY ("admirer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "profile_comments_profile_created_at_idx" ON "profile_comments" USING btree ("profile_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "profile_comments_author_created_at_idx" ON "profile_comments" USING btree ("author_id","created_at");
--> statement-breakpoint
CREATE INDEX "profile_respects_admirer_created_at_idx" ON "profile_respects" USING btree ("admirer_id","created_at");
