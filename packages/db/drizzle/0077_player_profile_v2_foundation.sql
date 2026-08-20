-- Player Profile V2 foundation: identity provenance, verified caps, rating history,
-- fly-half intelligence columns, career memberships without forced season.

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "known_as" text,
  ADD COLUMN IF NOT EXISTS "second_nationality" text,
  ADD COLUMN IF NOT EXISTS "birth_date_source" text,
  ADD COLUMN IF NOT EXISTS "birth_date_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "verified_international_caps" integer,
  ADD COLUMN IF NOT EXISTS "verified_international_points" integer,
  ADD COLUMN IF NOT EXISTS "contract_start_on" date,
  ADD COLUMN IF NOT EXISTS "contract_source" text,
  ADD COLUMN IF NOT EXISTS "contract_verified_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "player_team_memberships"
  ALTER COLUMN "season_id" DROP NOT NULL,
  ALTER COLUMN "competition_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_team_memberships"
  ADD COLUMN IF NOT EXISTS "membership_type" text NOT NULL DEFAULT 'club',
  ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "start_year" integer,
  ADD COLUMN IF NOT EXISTS "end_year" integer,
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "kicking_rating" real,
  ADD COLUMN IF NOT EXISTS "playmaking_rating" real,
  ADD COLUMN IF NOT EXISTS "game_management_rating" real,
  ADD COLUMN IF NOT EXISTS "physical_rating" real,
  ADD COLUMN IF NOT EXISTS "intelligence_model_version" text,
  ADD COLUMN IF NOT EXISTS "intelligence_confidence" integer,
  ADD COLUMN IF NOT EXISTS "intelligence_coverage" integer,
  ADD COLUMN IF NOT EXISTS "intelligence" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_rating_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "match_date" timestamptz,
  "snapshot_type" text NOT NULL DEFAULT 'recalculated',
  "overall_rating" real NOT NULL,
  "previous_rating" real,
  "rating_change" real,
  "attack" real,
  "defence" real,
  "kicking" real,
  "playmaking" real,
  "game_management" real,
  "physical" real,
  "form" real,
  "confidence" integer,
  "coverage" integer,
  "model_version" text NOT NULL DEFAULT 'player-fly-half-v1',
  "intelligence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metrics" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "major_match_label" text,
  "competition_name" text,
  "team_name" text,
  "opponent_name" text,
  "fixture_slug" text,
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_rating_history_player_idx"
  ON "player_rating_history" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_rating_history_match_date_idx"
  ON "player_rating_history" ("player_id", "match_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_rating_history_player_fixture_unique"
  ON "player_rating_history" ("player_id", "fixture_id")
  WHERE "fixture_id" IS NOT NULL;
