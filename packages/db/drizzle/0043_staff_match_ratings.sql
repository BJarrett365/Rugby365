CREATE TABLE IF NOT EXISTS "coach_match_ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "side" text NOT NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "rating" real,
  "rating_status" text NOT NULL DEFAULT 'unavailable',
  "model_version" text NOT NULL DEFAULT 'coach-match-v1',
  "performance_band" text,
  "rating_explanation" text,
  "positive_impacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "deductions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "match_context" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "previous_fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "previous_rating" real,
  "rating_change" real,
  "performance_trend" text,
  "manual_override_rating" real,
  "manual_override_reason" text,
  "source_provider" text NOT NULL DEFAULT 'rugby365',
  "calculated_at" timestamp with time zone,
  "recalculated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coach_match_ratings_fixture_coach_unique"
  ON "coach_match_ratings" ("fixture_id", "coach_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_match_ratings_coach_idx"
  ON "coach_match_ratings" ("coach_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_match_ratings_fixture_idx"
  ON "coach_match_ratings" ("fixture_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referee_match_ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "referee_id" uuid NOT NULL REFERENCES "referees"("id") ON DELETE CASCADE,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "rating" real,
  "rating_status" text NOT NULL DEFAULT 'unavailable',
  "model_version" text NOT NULL DEFAULT 'referee-match-v1',
  "performance_band" text,
  "rating_explanation" text,
  "positive_impacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "deductions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "match_context" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "previous_fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "previous_rating" real,
  "rating_change" real,
  "performance_trend" text,
  "manual_override_rating" real,
  "manual_override_reason" text,
  "source_provider" text NOT NULL DEFAULT 'rugby365',
  "calculated_at" timestamp with time zone,
  "recalculated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referee_match_ratings_fixture_referee_unique"
  ON "referee_match_ratings" ("fixture_id", "referee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referee_match_ratings_referee_idx"
  ON "referee_match_ratings" ("referee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referee_match_ratings_fixture_idx"
  ON "referee_match_ratings" ("fixture_id");
