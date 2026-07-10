-- Separate domestic, international and scouting bio variants per player
ALTER TABLE "player_bio_profiles"
  ADD COLUMN IF NOT EXISTS "domestic_sections" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "international_sections" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "scouting_sections" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "domestic_updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "international_updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "scouting_updated_at" timestamptz;
