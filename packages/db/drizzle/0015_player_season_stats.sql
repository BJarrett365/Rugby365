ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "social_accounts" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_match_performance_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid,
	"competition_id" uuid,
	"external_match_id" text,
	"external_player_id" text,
	"minutes_played" integer DEFAULT 0 NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"carries" integer DEFAULT 0 NOT NULL,
	"metres_carried" integer DEFAULT 0 NOT NULL,
	"tackles_made" integer DEFAULT 0 NOT NULL,
	"tackles_completed" integer DEFAULT 0 NOT NULL,
	"dominant_tackles" integer DEFAULT 0 NOT NULL,
	"turnovers_won" integer DEFAULT 0 NOT NULL,
	"try_assists" integer DEFAULT 0 NOT NULL,
	"line_breaks" integer DEFAULT 0 NOT NULL,
	"defenders_beaten" integer DEFAULT 0 NOT NULL,
	"touches" integer DEFAULT 0 NOT NULL,
	"post_contact_metres" integer DEFAULT 0 NOT NULL,
	"ruck_arrival_effectiveness" integer DEFAULT 0 NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_provider" text DEFAULT 'sdms' NOT NULL,
	"import_key" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_season_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"appearances" integer DEFAULT 0 NOT NULL,
	"minutes_played" integer DEFAULT 0 NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"carries" integer DEFAULT 0 NOT NULL,
	"metres_carried" integer DEFAULT 0 NOT NULL,
	"tackles_made" integer DEFAULT 0 NOT NULL,
	"tackles_completed" integer DEFAULT 0 NOT NULL,
	"dominant_tackles" integer DEFAULT 0 NOT NULL,
	"turnovers_won" integer DEFAULT 0 NOT NULL,
	"try_assists" integer DEFAULT 0 NOT NULL,
	"line_breaks" integer DEFAULT 0 NOT NULL,
	"defenders_beaten" integer DEFAULT 0 NOT NULL,
	"touches" integer DEFAULT 0 NOT NULL,
	"post_contact_metres" integer DEFAULT 0 NOT NULL,
	"ruck_arrival_effectiveness" integer DEFAULT 0 NOT NULL,
	"attack_rank" integer,
	"defence_rank" integer,
	"source_provider" text DEFAULT 'sdms' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_match_performance_stats" ADD CONSTRAINT "player_match_performance_stats_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_match_performance_stats" ADD CONSTRAINT "player_match_performance_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_match_performance_stats" ADD CONSTRAINT "player_match_performance_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_match_performance_stats" ADD CONSTRAINT "player_match_performance_stats_season_id_competition_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_match_performance_stats" ADD CONSTRAINT "player_match_performance_stats_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_season_id_competition_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_match_performance_stats_import_key_unique" ON "player_match_performance_stats" USING btree ("import_key") WHERE "player_match_performance_stats"."import_key" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_match_performance_stats_fixture_player_unique" ON "player_match_performance_stats" USING btree ("fixture_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_season_stats_player_season_team_unique" ON "player_season_stats" USING btree ("player_id","season_id","team_id");
