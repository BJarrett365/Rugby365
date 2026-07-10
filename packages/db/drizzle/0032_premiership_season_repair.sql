ALTER TABLE "competition_seasons" ADD COLUMN IF NOT EXISTS "champion_team_id" uuid;
--> statement-breakpoint
ALTER TABLE "competition_seasons" ADD COLUMN IF NOT EXISTS "wikipedia_source_url" text;
--> statement-breakpoint
ALTER TABLE "competition_seasons" ADD CONSTRAINT "competition_seasons_champion_team_id_teams_id_fk"
  FOREIGN KEY ("champion_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "season_id" uuid;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "stage" text DEFAULT 'regular' NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_season_id_competition_seasons_id_fk"
  FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixtures_competition_season_id_idx" ON "fixtures" ("competition_id", "season_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixtures_season_stage_idx" ON "fixtures" ("season_id", "stage");
--> statement-breakpoint
ALTER TABLE "standing_rows" ADD COLUMN IF NOT EXISTS "try_bonus_points" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "standing_rows" ADD COLUMN IF NOT EXISTS "losing_bonus_points" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "standing_rows" ADD COLUMN IF NOT EXISTS "points_deduction" integer DEFAULT 0 NOT NULL;
