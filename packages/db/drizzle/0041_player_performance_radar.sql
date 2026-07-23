-- Player Performance Radar: percentile cache + CMS controls
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "radar_settings" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "radar_summary_override" text;
ALTER TABLE "player_ratings"
  ADD COLUMN IF NOT EXISTS "radar_summary_approved" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "player_radar_caches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE CASCADE,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "scope" text NOT NULL DEFAULT 'all',
  "position_family" text NOT NULL,
  "min_minutes" integer NOT NULL DEFAULT 400,
  "title" text NOT NULL,
  "cohort_size" integer NOT NULL DEFAULT 0,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "computed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_radar_caches_lookup_unique"
  ON "player_radar_caches" (
    "player_id",
    coalesce("season_id", '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce("competition_id", '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
    "scope",
    "min_minutes"
  );

CREATE INDEX IF NOT EXISTS "player_radar_caches_player_idx"
  ON "player_radar_caches" ("player_id");

CREATE INDEX IF NOT EXISTS "player_radar_caches_season_idx"
  ON "player_radar_caches" ("season_id");
