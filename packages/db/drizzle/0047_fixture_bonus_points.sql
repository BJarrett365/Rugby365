-- Persist per-side try / losing bonus points on fixtures (competition rules).
ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "home_try_bonus_points" integer DEFAULT 0 NOT NULL;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "away_try_bonus_points" integer DEFAULT 0 NOT NULL;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "home_losing_bonus_points" integer DEFAULT 0 NOT NULL;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "away_losing_bonus_points" integer DEFAULT 0 NOT NULL;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "bonus_points_computed_at" timestamp with time zone;
