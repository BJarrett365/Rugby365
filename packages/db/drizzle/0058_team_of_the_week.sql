-- Team of the Week editions (round-scoped, publishable snapshots).

CREATE TABLE IF NOT EXISTS "team_of_week_editions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "competition_id" uuid NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "season_id" uuid NOT NULL REFERENCES "competition_seasons"("id") ON DELETE CASCADE,
  "round_key" text NOT NULL,
  "round_number" integer,
  "round_name" text NOT NULL,
  "round_start_date" timestamptz,
  "round_end_date" timestamptz,
  "status" text DEFAULT 'draft' NOT NULL,
  "is_provisional" boolean DEFAULT false NOT NULL,
  "fixture_count" integer DEFAULT 0 NOT NULL,
  "completed_fixture_count" integer DEFAULT 0 NOT NULL,
  "postponed_policy" text DEFAULT 'exclude' NOT NULL,
  "method_version" text DEFAULT 'totw-v1' NOT NULL,
  "previous_edition_id" uuid,
  "round_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "editorial_intro" text,
  "generated_at" timestamptz,
  "approved_at" timestamptz,
  "published_at" timestamptz,
  "locked_at" timestamptz,
  "created_by" text,
  "approved_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_of_week_editions_comp_season_round_unique"
  ON "team_of_week_editions" ("competition_id", "season_id", "round_key");

CREATE INDEX IF NOT EXISTS "team_of_week_editions_status_idx"
  ON "team_of_week_editions" ("status");

CREATE INDEX IF NOT EXISTS "team_of_week_editions_competition_idx"
  ON "team_of_week_editions" ("competition_id", "season_id");

CREATE TABLE IF NOT EXISTS "team_of_week_edition_fixtures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "team_of_week_editions"("id") ON DELETE CASCADE,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "fixture_status" text,
  "included" boolean DEFAULT true NOT NULL,
  "included_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_of_week_edition_fixtures_unique"
  ON "team_of_week_edition_fixtures" ("edition_id", "fixture_id");

CREATE TABLE IF NOT EXISTS "team_of_week_selections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "team_of_week_editions"("id") ON DELETE CASCADE,
  "player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "selection_type" text NOT NULL,
  "position_code" text,
  "shirt_number" integer,
  "match_rating" real,
  "selection_score" real,
  "confidence_pct" integer,
  "rank_at_position" integer,
  "short_reason" text,
  "full_reason" text,
  "is_automated" boolean DEFAULT true NOT NULL,
  "is_manual_override" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_of_week_selections_edition_idx"
  ON "team_of_week_selections" ("edition_id", "selection_type");

CREATE TABLE IF NOT EXISTS "team_of_week_awards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "team_of_week_editions"("id") ON DELETE CASCADE,
  "award_type" text NOT NULL,
  "player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "coach_id" uuid REFERENCES "coaches"("id") ON DELETE SET NULL,
  "referee_id" uuid REFERENCES "referees"("id") ON DELETE SET NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "rating" real,
  "score" real,
  "short_reason" text,
  "full_reason" text,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_of_week_awards_edition_type_unique"
  ON "team_of_week_awards" ("edition_id", "award_type");

CREATE TABLE IF NOT EXISTS "team_of_week_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "team_of_week_editions"("id") ON DELETE CASCADE,
  "selection_id" uuid REFERENCES "team_of_week_selections"("id") ON DELETE SET NULL,
  "slot_shirt_number" integer,
  "selection_type" text,
  "original_player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "replacement_player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "reason" text NOT NULL,
  "editor_label" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_of_week_overrides_edition_idx"
  ON "team_of_week_overrides" ("edition_id");
