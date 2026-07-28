-- Per-fixture TV / streaming broadcasters (CMS + future EPG providers).
CREATE TABLE IF NOT EXISTS "fixture_broadcasters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "broadcaster_name" text NOT NULL,
  "channel_name" text,
  "region" text,
  "platform" text DEFAULT 'tv' NOT NULL,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "url" text,
  "source_provider" text DEFAULT 'manual' NOT NULL,
  "external_id" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fixture_broadcasters_fixture_id_idx"
  ON "fixture_broadcasters" ("fixture_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fixture_broadcasters_fixture_external_unique"
  ON "fixture_broadcasters" ("fixture_id", "source_provider", "external_id")
  WHERE "external_id" IS NOT NULL;
