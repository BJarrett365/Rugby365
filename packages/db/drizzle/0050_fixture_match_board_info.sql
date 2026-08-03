-- Match board CMS fields (SportCC-style Match Info extras for public fixtures).
ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "half_time_home" integer,
  ADD COLUMN IF NOT EXISTS "half_time_away" integer,
  ADD COLUMN IF NOT EXISTS "additional_info" text,
  ADD COLUMN IF NOT EXISTS "weather_note" text;
