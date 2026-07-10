-- Extend referees to match coach profile richness
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "birth_date" date;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "nationality" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "bio_summary" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "wikipedia_url" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "wikidata_id" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "social_accounts" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE "referees" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();

CREATE TABLE "people" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role_type" text NOT NULL,
  "role_entity_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "birth_date" date,
  "nationality" text,
  "birth_place" text,
  "image_url" text,
  "bio_summary" text,
  "social_accounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "wikipedia_url" text,
  "wikidata_id" text,
  "source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_role" text,
  "current_organisation" text,
  "verification_status" text DEFAULT 'unverified' NOT NULL,
  "confidence_score" real,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "people_role_entity_unique" ON "people" ("role_type", "role_entity_id");

CREATE TABLE "referee_appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referee_id" uuid NOT NULL REFERENCES "referees"("id") ON DELETE CASCADE,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "appointment_level" text,
  "is_international" boolean DEFAULT false NOT NULL,
  "is_test_match" boolean DEFAULT false NOT NULL,
  "kickoff_at" timestamptz,
  "home_team" text,
  "away_team" text,
  "competition_name" text,
  "source_provider" text DEFAULT 'rugby365' NOT NULL,
  "synced_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "referee_appointments_fixture_unique"
  ON "referee_appointments" ("referee_id", "fixture_id")
  WHERE "fixture_id" IS NOT NULL;

CREATE TABLE "person_intelligence_score_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "role_type" text NOT NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "rating_type" text NOT NULL,
  "overall_score" real,
  "supporting_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "explanation" text,
  "calculation_inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "formula_version" text NOT NULL,
  "calculated_at" timestamptz DEFAULT now() NOT NULL,
  "confidence_score" real,
  "manual_override_rating" real,
  "override_notes" text,
  "overridden_by" text,
  "overridden_at" timestamptz
);

CREATE INDEX "person_intelligence_score_history_person_idx"
  ON "person_intelligence_score_history" ("person_id", "rating_type", "calculated_at");

CREATE TABLE "person_bio_profiles" (
  "person_id" uuid PRIMARY KEY NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "primary_bio_type" text DEFAULT 'short_bio' NOT NULL,
  "short_intro" text,
  "full_bio" text,
  "career_summary" text,
  "rating_explanation" text,
  "appointment_summary" text,
  "experience_profile" text,
  "approved_suggestion_id" uuid,
  "approved_by" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "person_bio_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "bio_type" text NOT NULL,
  "trigger_reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "suggested_sections" jsonb NOT NULL,
  "approved_sections" jsonb,
  "source_data_snapshot" jsonb NOT NULL,
  "verification_report" jsonb,
  "prompt_version" text NOT NULL,
  "model" text NOT NULL,
  "confidence_score" real,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "approved_at" timestamptz,
  "approved_by" text,
  "rejected_at" timestamptz,
  "rejected_by" text
);

CREATE INDEX "person_bio_suggestions_person_idx"
  ON "person_bio_suggestions" ("person_id", "created_at");

CREATE TABLE "person_bio_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "suggestion_id" uuid REFERENCES "person_bio_suggestions"("id") ON DELETE SET NULL,
  "bio_type" text NOT NULL,
  "sections" jsonb NOT NULL,
  "change_summary" text,
  "trigger_reason" text,
  "approved_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "person_bio_history_person_idx"
  ON "person_bio_history" ("person_id", "created_at");

CREATE TABLE "person_verification_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "suggestion_id" uuid REFERENCES "person_bio_suggestions"("id") ON DELETE SET NULL,
  "source_fields_used" jsonb NOT NULL,
  "source_urls" jsonb NOT NULL,
  "missing_fields" jsonb NOT NULL,
  "conflicting_fields" jsonb NOT NULL,
  "confidence_score" real,
  "suggested_editor_action" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "person_verification_reports_person_idx"
  ON "person_verification_reports" ("person_id", "created_at");
