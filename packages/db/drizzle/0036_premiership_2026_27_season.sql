INSERT INTO "competition_seasons" ("competition_id", "slug", "label", "year", "is_active", "is_deprecated", "source_provider")
SELECT c.id, '2026-27', '2026–27', 2026, true, false, 'wikipedia'
FROM "competitions" c
WHERE c.slug = 'premiership'
ON CONFLICT ("competition_id", "label") DO UPDATE
SET
  "slug" = EXCLUDED."slug",
  "year" = EXCLUDED."year",
  "is_active" = true,
  "is_deprecated" = false;

-- Prefer 2026–27 as the active Premiership season
UPDATE "competition_seasons"
SET "is_active" = false
WHERE "competition_id" IN (SELECT id FROM "competitions" WHERE slug = 'premiership')
  AND "year" <> 2026;

UPDATE "competition_seasons"
SET "is_active" = true, "is_deprecated" = false
WHERE "competition_id" IN (SELECT id FROM "competitions" WHERE slug = 'premiership')
  AND ("year" = 2026 OR "label" IN ('2026–27', '2026-27'));
