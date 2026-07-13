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
		ALTER TABLE "users" ADD COLUMN "respect_count_fixed" integer DEFAULT 0 NOT NULL;

		UPDATE "users"
		SET "respect_count_fixed" = "respect_totals"."total"
		FROM (
			SELECT "profile_user_id", count(*)::integer AS "total"
			FROM "profile_respects"
			GROUP BY "profile_user_id"
		) AS "respect_totals"
		WHERE "users"."id" = "respect_totals"."profile_user_id";

		ALTER TABLE "users" DROP COLUMN "respect_count";
		ALTER TABLE "users" RENAME COLUMN "respect_count_fixed" TO "respect_count";
	ELSE
		UPDATE "users"
		SET "respect_count" = "respect_totals"."total"
		FROM (
			SELECT "profile_user_id", count(*)::integer AS "total"
			FROM "profile_respects"
			GROUP BY "profile_user_id"
		) AS "respect_totals"
		WHERE "users"."id" = "respect_totals"."profile_user_id";

		UPDATE "users"
		SET "respect_count" = 0
		WHERE "respect_count" IS NULL;

		ALTER TABLE "users" ALTER COLUMN "respect_count" SET DEFAULT 0;
		ALTER TABLE "users" ALTER COLUMN "respect_count" SET NOT NULL;
	END IF;
END $$;
