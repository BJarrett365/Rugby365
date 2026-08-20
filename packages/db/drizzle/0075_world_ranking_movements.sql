-- Multi-source world rankings + Wikipedia movements / milestones

ALTER TABLE "world_ranking_snapshots"
  ADD COLUMN IF NOT EXISTS "source_provider" text NOT NULL DEFAULT 'world_rugby',
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
DROP INDEX IF EXISTS "world_ranking_snapshots_category_effective_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "world_ranking_snapshots_category_effective_source_unique"
  ON "world_ranking_snapshots" ("category", "effective_date", "source_provider");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_ranking_leader_spans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "team_name" text NOT NULL,
  "team_code" text,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "weeks" integer,
  "total_weeks" integer,
  "reign_index" integer,
  "source_provider" text NOT NULL DEFAULT 'wikipedia',
  "source_url" text,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "world_ranking_leader_spans_cat_start_team_unique"
  ON "world_ranking_leader_spans" ("category", "start_date", "team_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_ranking_leader_spans_category_idx"
  ON "world_ranking_leader_spans" ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_ranking_team_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "team_name" text NOT NULL,
  "team_code" text,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "milestone_type" text NOT NULL,
  "rank" integer,
  "points" real,
  "year_label" text,
  "achieved_on" date,
  "source_provider" text NOT NULL DEFAULT 'wikipedia',
  "source_url" text,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "world_ranking_team_milestones_cat_team_type_unique"
  ON "world_ranking_team_milestones" ("category", "team_name", "milestone_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_ranking_team_milestones_category_idx"
  ON "world_ranking_team_milestones" ("category");
