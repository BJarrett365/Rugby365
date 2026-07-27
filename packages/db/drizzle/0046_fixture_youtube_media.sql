ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "watchalong_youtube_url" text;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "highlights_youtube_url" text;
