CREATE TABLE "player_ratings" (
  "player_id" uuid PRIMARY KEY NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "player_rating" real,
  "current_ability" real,
  "form_score" real,
  "team_importance" real,
  "potential" real,
  "reputation" real,
  "attack_rating" real,
  "defence_rating" real,
  "discipline_rating" real,
  "age_profile" text,
  "rating_confidence" real,
  "rating_explanation" text,
  "season_rating" real,
  "career_high" real,
  "career_low" real,
  "form_movement" real,
  "rating_movement" real,
  "last_five_match_ratings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "manual_override_rating" real,
  "manual_override_reason" text,
  "calculated_at" timestamp with time zone,
  "data_points" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "player_bio_profiles" (
  "player_id" uuid PRIMARY KEY NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "primary_bio_type" text DEFAULT 'domestic' NOT NULL,
  "short_intro" text,
  "full_bio" text,
  "playing_style" text,
  "strengths" text,
  "areas_to_improve" text,
  "career_summary" text,
  "international_summary" text,
  "current_season_summary" text,
  "scouting_summary" text,
  "rating_explanation" text,
  "legend_summary" text,
  "approved_suggestion_id" uuid,
  "approved_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "player_bio_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "bio_type" text NOT NULL,
  "trigger_reason" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "suggested_sections" jsonb NOT NULL,
  "approved_sections" jsonb,
  "source_data_snapshot" jsonb NOT NULL,
  "verification_report" jsonb,
  "prompt_version" text NOT NULL,
  "model" text NOT NULL,
  "confidence_score" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  "rejected_at" timestamp with time zone,
  "rejected_by" text
);

CREATE INDEX "player_bio_suggestions_player_idx"
  ON "player_bio_suggestions" ("player_id", "created_at");

CREATE TABLE "player_bio_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "suggestion_id" uuid REFERENCES "player_bio_suggestions"("id") ON DELETE SET NULL,
  "bio_type" text NOT NULL,
  "sections" jsonb NOT NULL,
  "change_summary" text,
  "trigger_reason" text,
  "approved_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "player_bio_history_player_idx"
  ON "player_bio_history" ("player_id", "created_at");

CREATE TABLE "player_profile_verification_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "suggestion_id" uuid REFERENCES "player_bio_suggestions"("id") ON DELETE SET NULL,
  "source_fields_used" jsonb NOT NULL,
  "source_urls" jsonb NOT NULL,
  "missing_fields" jsonb NOT NULL,
  "conflicting_fields" jsonb NOT NULL,
  "confidence_score" real,
  "suggested_editor_action" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "player_profile_verification_reports_player_idx"
  ON "player_profile_verification_reports" ("player_id", "created_at");
