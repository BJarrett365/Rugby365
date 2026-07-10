INSERT INTO "competitions" ("slug", "name", "competition_type", "planet_rugby_slug", "source_provider")
VALUES ('nations-championship', 'Nations Championship', 'international', 'nations-championship', 'manual')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "competition_type" = EXCLUDED."competition_type",
  "planet_rugby_slug" = EXCLUDED."planet_rugby_slug";
--> statement-breakpoint
INSERT INTO "competition_seasons" ("competition_id", "slug", "label", "year", "is_active", "source_provider")
SELECT c.id, '2026', '2026', 2026, true, 'manual'
FROM "competitions" c
WHERE c.slug = 'nations-championship'
ON CONFLICT ("competition_id", "label") DO UPDATE SET
  "is_active" = EXCLUDED."is_active";
