-- Planet Rugby Legends: collections, members, and Legend Score snapshots.

CREATE TABLE IF NOT EXISTS "legend_collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "description" text,
  "entity_kind" text DEFAULT 'player' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "legend_collections_kind_idx" ON "legend_collections" ("entity_kind");

CREATE TABLE IF NOT EXISTS "legend_collection_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_id" uuid NOT NULL REFERENCES "legend_collections"("id") ON DELETE CASCADE,
  "player_id" uuid REFERENCES "players"("id") ON DELETE CASCADE,
  "coach_id" uuid REFERENCES "coaches"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "legend_collection_members_player_unique"
  ON "legend_collection_members" ("collection_id", "player_id")
  WHERE "player_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "legend_collection_members_coach_unique"
  ON "legend_collection_members" ("collection_id", "coach_id")
  WHERE "coach_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "legend_collection_members_player_idx"
  ON "legend_collection_members" ("player_id");

CREATE INDEX IF NOT EXISTS "legend_collection_members_coach_idx"
  ON "legend_collection_members" ("coach_id");

CREATE TABLE IF NOT EXISTS "player_legend_scores" (
  "player_id" uuid PRIMARY KEY REFERENCES "players"("id") ON DELETE CASCADE,
  "model_version" text DEFAULT 'legend-score-v1' NOT NULL,
  "overall_score" integer DEFAULT 0 NOT NULL,
  "career_rating" integer,
  "peak_rating" integer,
  "legacy_rating" integer,
  "influence_rating" integer,
  "leadership_rating" integer,
  "trophy_score" integer,
  "international_score" integer,
  "club_score" integer,
  "hall_of_fame_status" text DEFAULT 'none' NOT NULL,
  "era_rank" integer,
  "all_time_rank" integer,
  "components" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "calculated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
