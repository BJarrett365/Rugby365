INSERT INTO "competitions" ("slug", "name", "competition_type", "sdms_comp_code", "planet_rugby_slug", "source_provider")
VALUES
  ('rugby-champions-cup', 'Investec Champions Cup', 'european', 'g56e3970', 'rugby-champions-cup', 'sdms')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sdms_comp_code" = EXCLUDED."sdms_comp_code",
  "planet_rugby_slug" = EXCLUDED."planet_rugby_slug",
  "competition_type" = EXCLUDED."competition_type";
