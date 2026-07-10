CREATE TABLE IF NOT EXISTS "team_match_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid,
	"competition_id" uuid,
	"side" text NOT NULL,
	"external_match_id" text,
	"tries" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"penalties" integer DEFAULT 0 NOT NULL,
	"drop_goals" integer DEFAULT 0 NOT NULL,
	"carries" integer DEFAULT 0 NOT NULL,
	"metres" integer DEFAULT 0 NOT NULL,
	"tackles" integer DEFAULT 0 NOT NULL,
	"turnovers_won" integer DEFAULT 0 NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_provider" text DEFAULT 'sdms' NOT NULL,
	"import_key" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_season_id_competition_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "team_match_stats_import_key_unique" ON "team_match_stats" USING btree ("import_key") WHERE "team_match_stats"."import_key" is not null;
CREATE UNIQUE INDEX IF NOT EXISTS "team_match_stats_fixture_team_source_unique" ON "team_match_stats" USING btree ("fixture_id","team_id","source_provider");
