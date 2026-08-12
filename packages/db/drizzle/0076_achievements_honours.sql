-- Shared Rugby365 honours / awards / medal record system
-- Supports coaches, players, referees, teams via entity_type + entity_id

CREATE TABLE IF NOT EXISTS "award_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "short_name" text,
  "organisation" text,
  "award_type" text NOT NULL DEFAULT 'personal',
  "sport" text NOT NULL DEFAULT 'rugby_union',
  "scope" text,
  "icon_key" text NOT NULL DEFAULT 'award_coach',
  "official_url" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "achievement_type" text NOT NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "competition_name" text,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "season_label" text,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "team_name" text,
  "award_definition_id" uuid REFERENCES "award_definitions"("id") ON DELETE SET NULL,
  "year" integer,
  "start_date" date,
  "end_date" date,
  "role_type" text,
  "placing" text,
  "medal_type" text NOT NULL DEFAULT 'none',
  "honour_level" text NOT NULL DEFAULT 'cup',
  "shared" boolean NOT NULL DEFAULT false,
  "title_override" text,
  "notes" text,
  "icon_key" text,
  "show_on_overview" boolean NOT NULL DEFAULT false,
  "eligible_for_snapshot" boolean NOT NULL DEFAULT true,
  "visibility" text NOT NULL DEFAULT 'public',
  "verification_status" text NOT NULL DEFAULT 'unverified',
  "verified_at" timestamptz,
  "verified_by" text,
  "legacy_source_table" text,
  "legacy_source_id" uuid,
  "dedupe_key" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_entity_idx"
  ON "achievements" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_type_idx"
  ON "achievements" ("achievement_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_competition_idx"
  ON "achievements" ("competition_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_verification_idx"
  ON "achievements" ("verification_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_year_idx"
  ON "achievements" ("year");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_legacy_idx"
  ON "achievements" ("legacy_source_table", "legacy_source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_dedupe_unique"
  ON "achievements" ("entity_type", "entity_id", "dedupe_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievement_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "achievement_id" uuid NOT NULL REFERENCES "achievements"("id") ON DELETE CASCADE,
  "source_type" text NOT NULL,
  "source_name" text,
  "source_url" text,
  "checked_at" timestamptz,
  "verification_status" text NOT NULL DEFAULT 'unverified',
  "raw_excerpt" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievement_sources_achievement_idx"
  ON "achievement_sources" ("achievement_id");
--> statement-breakpoint
ALTER TABLE "coaches"
  ADD COLUMN IF NOT EXISTS "honours_status" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "honours_checked_at" timestamptz;
