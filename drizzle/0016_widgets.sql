CREATE TABLE "aura_history" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"aura" integer NOT NULL,
	CONSTRAINT "aura_history_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "profile_view_log" (
	"user_id" uuid NOT NULL,
	"viewer_key" varchar(80) NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "profile_view_log_user_id_viewer_key_day_pk" PRIMARY KEY("user_id","viewer_key","day")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "widget_layout" jsonb DEFAULT '["medal_rack","fight_record","debt_meter","guestbook"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_track_url" varchar(300);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_text" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "aura_history" ADD CONSTRAINT "aura_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_view_log" ADD CONSTRAINT "profile_view_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;