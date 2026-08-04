-- Rugby365 Crest Library — official / replica club crests linked to teams (& shirts).

CREATE TABLE IF NOT EXISTS "team_crests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  "is_historic" boolean DEFAULT false NOT NULL,
  "approved_version_id" uuid,
  "approved_for_pitch_use" boolean DEFAULT false NOT NULL,
  "use_on_shirts" boolean DEFAULT true NOT NULL,
  "use_on_match_centre" boolean DEFAULT true NOT NULL,
  "use_on_social_graphics" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "approved_by" text,
  "approved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_crests_team_current_unique"
  ON "team_crests" ("team_id")
  WHERE "is_current" = true AND "status" <> 'ARCHIVED';

CREATE INDEX IF NOT EXISTS "team_crests_team_status_idx"
  ON "team_crests" ("team_id", "status");

CREATE INDEX IF NOT EXISTS "team_crests_competition_season_idx"
  ON "team_crests" ("competition_id", "season_id");

CREATE TABLE IF NOT EXISTS "team_crest_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "crest_id" uuid NOT NULL REFERENCES "team_crests"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "title" text,
  "description" text,
  "about_crest" text,
  "primary_colour" text,
  "secondary_colour" text,
  "accent_colour" text,
  "colours" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "official_image_url" text,
  "replica_image_url" text,
  "source_url" text,
  "source_name" text,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_crest_versions_crest_version_unique"
  ON "team_crest_versions" ("crest_id", "version_number");

CREATE INDEX IF NOT EXISTS "team_crest_versions_crest_idx"
  ON "team_crest_versions" ("crest_id");

ALTER TABLE "team_crests"
  ADD CONSTRAINT "team_crests_approved_version_fk"
  FOREIGN KEY ("approved_version_id")
  REFERENCES "team_crest_versions"("id")
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "team_crest_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "crest_id" uuid NOT NULL REFERENCES "team_crests"("id") ON DELETE CASCADE,
  "version_id" uuid REFERENCES "team_crest_versions"("id") ON DELETE SET NULL,
  "status" text NOT NULL,
  "review_notes" text,
  "reviewed_by" text,
  "reviewed_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_crest_reviews_crest_idx"
  ON "team_crest_reviews" ("crest_id", "created_at");

-- Link Shirt Library kits to an approved crest asset for the same team.
ALTER TABLE "team_shirts"
  ADD COLUMN IF NOT EXISTS "crest_id" uuid REFERENCES "team_crests"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "team_shirts_crest_idx"
  ON "team_shirts" ("crest_id");
