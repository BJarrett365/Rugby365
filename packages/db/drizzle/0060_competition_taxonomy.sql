-- Competition taxonomy tags (country, region, gender, age, format, level, season, lifecycle).

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "catalog_key" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "catalog_group" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "country_name" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "region" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "gender" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "age_group" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "format" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "level" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "season_structure" text;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "lifecycle_status" text DEFAULT 'current';

CREATE INDEX IF NOT EXISTS "competitions_catalog_key_idx"
  ON "competitions" ("catalog_key");

CREATE INDEX IF NOT EXISTS "competitions_catalog_group_idx"
  ON "competitions" ("catalog_group");

CREATE INDEX IF NOT EXISTS "competitions_region_lifecycle_idx"
  ON "competitions" ("region", "lifecycle_status");
