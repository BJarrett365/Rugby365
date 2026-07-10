ALTER TABLE "competitions" ADD COLUMN "competition_type" text DEFAULT 'domestic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "sdms_comp_code" text;
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "planet_rugby_slug" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_sdms_comp_code_unique" ON "competitions" USING btree ("sdms_comp_code") WHERE "competitions"."sdms_comp_code" is not null;
--> statement-breakpoint
CREATE TABLE "competition_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"year" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"source_provider" text DEFAULT 'sdms' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_seasons" ADD CONSTRAINT "competition_seasons_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "competition_seasons_competition_label_unique" ON "competition_seasons" USING btree ("competition_id","label");
--> statement-breakpoint
CREATE TABLE "standing_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"view" text DEFAULT 'overall' NOT NULL,
	"rank" integer NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"draw" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"points_for" integer DEFAULT 0 NOT NULL,
	"points_against" integer DEFAULT 0 NOT NULL,
	"points_diff" integer DEFAULT 0 NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"form" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "standing_rows" ADD CONSTRAINT "standing_rows_season_id_competition_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standing_rows" ADD CONSTRAINT "standing_rows_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_rows_season_team_view_unique" ON "standing_rows" USING btree ("season_id","team_id","view");
--> statement-breakpoint
INSERT INTO "competitions" ("slug", "name", "competition_type", "sdms_comp_code", "planet_rugby_slug", "source_provider")
VALUES
  ('premiership', 'Premiership', 'domestic', 'm46vm6z5', 'premiership', 'sdms'),
  ('top-14', 'Top 14', 'domestic', 'x7jq191p', 'top-14', 'sdms'),
  ('united-rugby-championship', 'United Rugby Championship', 'domestic', 'vx91ejw1', 'united-rugby-championship', 'sdms'),
  ('championship', 'Championship', 'domestic', '5294zj8g', 'championship', 'sdms'),
  ('six-nations', 'Six Nations', 'international', 'krjd4j3q', 'six-nations', 'sdms'),
  ('rugby-world-cup', 'Rugby World Cup', 'world_cup', 'do6lo6yl', 'rugby-world-cup', 'sdms')
ON CONFLICT ("slug") DO UPDATE SET
  "sdms_comp_code" = EXCLUDED."sdms_comp_code",
  "planet_rugby_slug" = EXCLUDED."planet_rugby_slug",
  "competition_type" = EXCLUDED."competition_type";
