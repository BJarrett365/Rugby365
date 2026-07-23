-- Player development timeline: model version + public chart settings
ALTER TABLE "player_match_ratings"
  ADD COLUMN IF NOT EXISTS "model_version" text NOT NULL DEFAULT 'match-v1';
ALTER TABLE "player_match_ratings"
  ADD COLUMN IF NOT EXISTS "recalculated_at" timestamp with time zone;

ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "model_version" text NOT NULL DEFAULT 'career-v1';
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "development_chart_settings" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "development_summary_override" text;
