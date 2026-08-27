-- Ultimate Rugby (and other) scraped player news / article links.
ALTER TABLE "player_career_stints"
  ADD COLUMN IF NOT EXISTS "tries" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_source_news" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "source_provider" text NOT NULL DEFAULT 'ultimate_rugby',
  "import_key" text NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "published_label" text,
  "view_count" integer,
  "synced_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_source_news_import_key_unique"
  ON "player_source_news" ("import_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_source_news_player_idx"
  ON "player_source_news" ("player_id");
