-- Rugby365 Shirt Library — approved kits for pitch overlays.

CREATE TABLE IF NOT EXISTS "competition_shirt_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "competition_id" uuid NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "home_required" boolean DEFAULT true NOT NULL,
  "away_required" boolean DEFAULT true NOT NULL,
  "third_required" boolean DEFAULT false NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_shirt_requirements_comp_unique"
  ON "competition_shirt_requirements" ("competition_id");

CREATE TABLE IF NOT EXISTS "team_shirts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "competition_id" uuid NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "season_id" uuid NOT NULL REFERENCES "competition_seasons"("id") ON DELETE CASCADE,
  "kit_type" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  "is_historic" boolean DEFAULT false NOT NULL,
  "valid_from" timestamptz,
  "valid_to" timestamptz,
  "approved_version_id" uuid,
  "approved_for_pitch_use" boolean DEFAULT false NOT NULL,
  "use_on_lineups" boolean DEFAULT true NOT NULL,
  "use_on_team_of_week" boolean DEFAULT true NOT NULL,
  "use_on_match_animations" boolean DEFAULT true NOT NULL,
  "use_on_social_graphics" boolean DEFAULT true NOT NULL,
  "use_on_betting_graphics" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "approved_by" text,
  "approved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_shirts_team_season_kit_unique"
  ON "team_shirts" ("team_id", "season_id", "kit_type")
  WHERE "status" <> 'ARCHIVED';

CREATE INDEX IF NOT EXISTS "team_shirts_competition_season_idx"
  ON "team_shirts" ("competition_id", "season_id");

CREATE INDEX IF NOT EXISTS "team_shirts_team_status_idx"
  ON "team_shirts" ("team_id", "status");

CREATE TABLE IF NOT EXISTS "team_shirt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shirt_id" uuid NOT NULL REFERENCES "team_shirts"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "body_colour" text NOT NULL,
  "secondary_colour" text,
  "sleeve_colour" text,
  "collar_colour" text,
  "cuff_colour" text,
  "side_panel_colour" text,
  "pattern_type" text DEFAULT 'PLAIN' NOT NULL,
  "pattern_colour" text,
  "pattern_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "number_colour" text DEFAULT '#FFFFFF' NOT NULL,
  "number_border_colour" text,
  "crest_enabled" boolean DEFAULT true NOT NULL,
  "svg_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_shirt_versions_shirt_version_unique"
  ON "team_shirt_versions" ("shirt_id", "version_number");

CREATE INDEX IF NOT EXISTS "team_shirt_versions_shirt_idx"
  ON "team_shirt_versions" ("shirt_id");

ALTER TABLE "team_shirts"
  ADD CONSTRAINT "team_shirts_approved_version_fk"
  FOREIGN KEY ("approved_version_id")
  REFERENCES "team_shirt_versions"("id")
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "team_shirt_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shirt_id" uuid NOT NULL REFERENCES "team_shirts"("id") ON DELETE CASCADE,
  "version_id" uuid REFERENCES "team_shirt_versions"("id") ON DELETE SET NULL,
  "status" text NOT NULL,
  "review_notes" text,
  "reviewed_by" text,
  "reviewed_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_shirt_reviews_shirt_idx"
  ON "team_shirt_reviews" ("shirt_id", "created_at");

CREATE TABLE IF NOT EXISTS "team_shirt_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shirt_id" uuid NOT NULL REFERENCES "team_shirts"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "image_type" text DEFAULT 'front' NOT NULL,
  "source_url" text,
  "source_name" text,
  "notes" text,
  "season_label" text,
  "uploaded_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_shirt_references_shirt_idx"
  ON "team_shirt_references" ("shirt_id");

-- Match kit selection (do not assume home team wears home kit).
ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "home_team_kit_id" uuid REFERENCES "team_shirts"("id") ON DELETE SET NULL;

ALTER TABLE "fixtures"
  ADD COLUMN IF NOT EXISTS "away_team_kit_id" uuid REFERENCES "team_shirts"("id") ON DELETE SET NULL;

-- Snapshot exact shirt version on Team of the Week selections.
ALTER TABLE "team_of_week_selections"
  ADD COLUMN IF NOT EXISTS "shirt_id" uuid REFERENCES "team_shirts"("id") ON DELETE SET NULL;

ALTER TABLE "team_of_week_selections"
  ADD COLUMN IF NOT EXISTS "shirt_version_id" uuid REFERENCES "team_shirt_versions"("id") ON DELETE SET NULL;

ALTER TABLE "team_of_week_selections"
  ADD COLUMN IF NOT EXISTS "kit_type" text;

ALTER TABLE "team_of_week_selections"
  ADD COLUMN IF NOT EXISTS "shirt_selection_method" text;
