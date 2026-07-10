CREATE TABLE "world_ranking_feeds" (
  "category" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "source_url" text NOT NULL,
  "current_snapshot_id" uuid,
  "synced_at" timestamptz
);

CREATE TABLE "world_ranking_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "effective_date" date NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "world_ranking_snapshots_category_effective_unique"
  ON "world_ranking_snapshots" ("category", "effective_date");

CREATE TABLE "world_ranking_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "snapshot_id" uuid NOT NULL REFERENCES "world_ranking_snapshots"("id") ON DELETE CASCADE,
  "world_rugby_team_id" text NOT NULL,
  "position" integer NOT NULL,
  "previous_position" integer,
  "points" real NOT NULL,
  "previous_points" real,
  "team_name" text NOT NULL,
  "team_abbreviation" text,
  "country_code" text,
  "team_id" uuid REFERENCES "teams"("id")
);

CREATE UNIQUE INDEX "world_ranking_rows_snapshot_team_unique"
  ON "world_ranking_rows" ("snapshot_id", "world_rugby_team_id");

ALTER TABLE "world_ranking_feeds"
  ADD CONSTRAINT "world_ranking_feeds_current_snapshot_id_fk"
  FOREIGN KEY ("current_snapshot_id") REFERENCES "world_ranking_snapshots"("id") ON DELETE SET NULL;
