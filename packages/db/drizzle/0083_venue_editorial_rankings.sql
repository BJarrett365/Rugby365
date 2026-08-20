-- Venue editorial rankings (separate from data-derived scores).
-- Editorial picks are stored per category; data ranks computed at read time.

ALTER TABLE "venues"
  ADD COLUMN IF NOT EXISTS "venue_type" text,
  ADD COLUMN IF NOT EXISTS "r365_venue_rating" real,
  ADD COLUMN IF NOT EXISTS "rugby_capacity" integer,
  ADD COLUMN IF NOT EXISTS "opened_year" integer,
  ADD COLUMN IF NOT EXISTS "surface" text,
  ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "venue_editorial_rankings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "editorial_rank" integer NOT NULL,
  "editorial_reason" text,
  "editorial_updated_at" timestamptz NOT NULL DEFAULT now(),
  "is_published" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "venue_editorial_rankings_venue_category_unique"
  ON "venue_editorial_rankings" ("venue_id", "category");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "venue_editorial_rankings_category_rank_unique"
  ON "venue_editorial_rankings" ("category", "editorial_rank")
  WHERE "is_published" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "venue_editorial_rankings_category_idx"
  ON "venue_editorial_rankings" ("category");
--> statement-breakpoint

-- Launch editorial: Eden Park #1 BEST OVERALL (lookup by slug — no hardcoded UUID).
INSERT INTO "venue_editorial_rankings" (
  "venue_id",
  "category",
  "editorial_rank",
  "editorial_reason",
  "editorial_updated_at"
)
SELECT
  v.id,
  'best',
  1,
  'Spiritual home of All Blacks rugby and host of two Rugby World Cup finals — our editorial #1 overall.',
  now()
FROM "venues" v
WHERE v.slug = 'eden-park'
ON CONFLICT ("venue_id", "category") DO UPDATE SET
  "editorial_rank" = EXCLUDED."editorial_rank",
  "editorial_reason" = EXCLUDED."editorial_reason",
  "editorial_updated_at" = EXCLUDED."editorial_updated_at",
  "is_published" = true;
