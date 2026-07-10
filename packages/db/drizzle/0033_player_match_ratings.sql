CREATE TABLE IF NOT EXISTS "player_match_ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "external_player_id" text,
  "squad_role" text NOT NULL DEFAULT 'starter',
  "jersey_number" integer,
  "position_name" text,
  "minutes_played" integer NOT NULL DEFAULT 0,
  "rating" real,
  "rating_status" text NOT NULL DEFAULT 'unavailable',
  "performance_band" text,
  "rating_explanation" text,
  "positive_impacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "deductions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "match_context" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "attack_contribution" real,
  "defence_contribution" real,
  "previous_fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "previous_rating" real,
  "rating_change" real,
  "performance_trend" text,
  "selection_previous_role" text,
  "selection_current_role" text,
  "selection_trend" text,
  "selection_badge" text,
  "is_rugby365_potm" boolean NOT NULL DEFAULT false,
  "is_official_potm" boolean NOT NULL DEFAULT false,
  "manual_override_rating" real,
  "manual_override_reason" text,
  "source_provider" text NOT NULL DEFAULT 'rugby365',
  "calculated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_match_ratings_fixture_player_unique"
  ON "player_match_ratings" ("fixture_id", "player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_match_ratings_player_idx"
  ON "player_match_ratings" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_match_ratings_fixture_idx"
  ON "player_match_ratings" ("fixture_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_selection_trends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "previous_fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "current_role" text NOT NULL DEFAULT 'not_selected',
  "previous_role" text,
  "selection_trend" text NOT NULL DEFAULT 'unknown',
  "selection_badge" text,
  "reason" text,
  "minutes_current" integer,
  "minutes_previous" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_selection_trends_fixture_player_unique"
  ON "player_selection_trends" ("fixture_id", "player_id")
  WHERE "fixture_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "rugby365_potm_player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "official_potm_player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "official_potm_name" text;
