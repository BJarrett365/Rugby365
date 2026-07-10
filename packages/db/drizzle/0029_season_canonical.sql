ALTER TABLE "competition_seasons" ADD COLUMN IF NOT EXISTS "is_deprecated" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competition_seasons_competition_year_active_unique"
  ON "competition_seasons" ("competition_id", "year")
  WHERE "is_deprecated" = false;
