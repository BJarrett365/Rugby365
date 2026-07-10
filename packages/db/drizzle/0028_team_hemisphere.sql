ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "hemisphere" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "region" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "team_type" text;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "is_neutral_venue" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "teams" SET "hemisphere" = 'northern', "team_type" = 'international'
WHERE lower(trim("name")) IN ('england', 'france', 'ireland', 'italy', 'scotland', 'wales')
  AND ("hemisphere" IS NULL OR "hemisphere" = '');
--> statement-breakpoint
UPDATE "teams" SET "hemisphere" = 'southern', "team_type" = 'international'
WHERE lower(trim("name")) IN ('argentina', 'australia', 'fiji', 'japan', 'new zealand', 'south africa')
  AND ("hemisphere" IS NULL OR "hemisphere" = '');
