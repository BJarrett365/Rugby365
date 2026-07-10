INSERT INTO "competition_seasons" ("competition_id", "slug", "label", "year", "is_active", "source_provider")
SELECT c.id, '2025-26', '2025–26', 2025, true, 'wikipedia'
FROM "competitions" c
WHERE c.slug = 'premiership'
ON CONFLICT ("competition_id", "label") DO NOTHING;

UPDATE "competition_seasons"
SET "is_active" = false
WHERE "competition_id" IN (SELECT id FROM "competitions" WHERE slug = 'premiership')
  AND "label" <> '2025–26';
