-- Coach Platform: identity, publish, playing career, honours, awards, medals, milestones, ratings.

ALTER TABLE "coaches"
  ADD COLUMN IF NOT EXISTS "known_as" text,
  ADD COLUMN IF NOT EXISTS "full_name" text,
  ADD COLUMN IF NOT EXISTS "place_of_birth" text,
  ADD COLUMN IF NOT EXISTS "country_of_birth" text,
  ADD COLUMN IF NOT EXISTS "second_nationality" text,
  ADD COLUMN IF NOT EXISTS "height_cm" integer,
  ADD COLUMN IF NOT EXISTS "former_playing_positions" text,
  ADD COLUMN IF NOT EXISTS "playing_career_status" text,
  ADD COLUMN IF NOT EXISTS "coaching_career_start_year" integer,
  ADD COLUMN IF NOT EXISTS "appointed_on" date,
  ADD COLUMN IF NOT EXISTS "contract_expires_on" date,
  ADD COLUMN IF NOT EXISTS "preferred_system" text,
  ADD COLUMN IF NOT EXISTS "coaching_style" text,
  ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "publish_status" text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "seo_description" text,
  ADD COLUMN IF NOT EXISTS "og_image_url" text,
  ADD COLUMN IF NOT EXISTS "profile_updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "career_record_partial" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "career_record_notes" text;

CREATE INDEX IF NOT EXISTS "coaches_publish_status_idx" ON "coaches" ("publish_status");

ALTER TABLE "team_coaching_staff"
  ADD COLUMN IF NOT EXISTS "career_type" text NOT NULL DEFAULT 'coach',
  ADD COLUMN IF NOT EXISTS "competition_level" text,
  ADD COLUMN IF NOT EXISTS "is_primary_coach" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "eligible_for_career_record" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "show_on_overview" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "country" text,
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "confidence" text NOT NULL DEFAULT 'medium';

CREATE TABLE IF NOT EXISTS "coach_playing_stints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "team_type" text NOT NULL DEFAULT 'provincial',
  "start_year" integer,
  "end_year" integer,
  "years_label" text NOT NULL,
  "team_name" text NOT NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "country" text,
  "apps" integer,
  "starts" integer,
  "points" integer,
  "tries" integer,
  "position" text,
  "captain" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "source_provider" text NOT NULL DEFAULT 'manual',
  "source_url" text,
  "verified_at" timestamptz,
  "show_on_overview" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_playing_stints_coach_idx" ON "coach_playing_stints" ("coach_id");
CREATE INDEX IF NOT EXISTS "coach_playing_stints_team_type_idx" ON "coach_playing_stints" ("team_type");

CREATE TABLE IF NOT EXISTS "coach_education" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "institution" text NOT NULL,
  "qualification" text,
  "start_year" integer,
  "end_year" integer,
  "sort_order" integer NOT NULL DEFAULT 0,
  "source_url" text,
  "verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_education_coach_idx" ON "coach_education" ("coach_id");

CREATE TABLE IF NOT EXISTS "coach_honours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "role_type" text NOT NULL DEFAULT 'coach',
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "team_name" text,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "competition_name" text,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "season_label" text,
  "year" integer,
  "achievement_type" text NOT NULL DEFAULT 'winner',
  "honour_level" text NOT NULL DEFAULT 'secondary',
  "shared" boolean NOT NULL DEFAULT false,
  "position" text,
  "final_opponent_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "final_match_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "notes" text,
  "source_url" text,
  "source_id" text,
  "verified_at" timestamptz,
  "show_on_overview" boolean NOT NULL DEFAULT false,
  "visibility" text NOT NULL DEFAULT 'public',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_honours_coach_idx" ON "coach_honours" ("coach_id");
CREATE INDEX IF NOT EXISTS "coach_honours_level_idx" ON "coach_honours" ("honour_level");
CREATE INDEX IF NOT EXISTS "coach_honours_role_idx" ON "coach_honours" ("role_type");

CREATE TABLE IF NOT EXISTS "coach_awards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "award_name" text NOT NULL,
  "awarding_body" text,
  "year" integer,
  "category" text,
  "result" text NOT NULL DEFAULT 'winner',
  "team_id_at_time" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "is_major" boolean NOT NULL DEFAULT false,
  "source_url" text,
  "verified_at" timestamptz,
  "show_on_overview" boolean NOT NULL DEFAULT false,
  "visibility" text NOT NULL DEFAULT 'public',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_awards_coach_idx" ON "coach_awards" ("coach_id");

CREATE TABLE IF NOT EXISTS "coach_medals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "role_type" text NOT NULL DEFAULT 'coach',
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "team_name" text,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "competition_name" text,
  "year" integer,
  "finish" text NOT NULL,
  "medal_type" text NOT NULL DEFAULT 'none',
  "honour_id" uuid REFERENCES "coach_honours"("id") ON DELETE SET NULL,
  "source_url" text,
  "verified_at" timestamptz,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_medals_coach_idx" ON "coach_medals" ("coach_id");

CREATE TABLE IF NOT EXISTS "coach_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "milestone_date" date,
  "milestone_year" integer,
  "milestone_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "match_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "source_url" text,
  "verified_at" timestamptz,
  "show_on_overview" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_milestones_coach_idx" ON "coach_milestones" ("coach_id");

CREATE TABLE IF NOT EXISTS "coach_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "canonical_url" text,
  "source_provider" text NOT NULL DEFAULT 'manual',
  "source_page_url" text,
  "caption" text,
  "alt_text" text,
  "credit" text,
  "image_type" text NOT NULL DEFAULT 'portrait',
  "role" text NOT NULL DEFAULT 'gallery',
  "status" text NOT NULL DEFAULT 'candidate',
  "is_public" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_images_coach_idx" ON "coach_images" ("coach_id");

CREATE TABLE IF NOT EXISTS "coach_rating_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "overall_rating" real,
  "power_index" real,
  "world_rank" integer,
  "momentum" real,
  "metrics" jsonb NOT NULL DEFAULT '{}',
  "model_version" text NOT NULL DEFAULT 'coach-rating-v1',
  "power_index_version" text NOT NULL DEFAULT 'coach-power-v1',
  "data_confidence" text NOT NULL DEFAULT 'low',
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_rating_snapshots_coach_idx" ON "coach_rating_snapshots" ("coach_id");
CREATE INDEX IF NOT EXISTS "coach_rating_snapshots_calc_idx" ON "coach_rating_snapshots" ("calculated_at");

CREATE TABLE IF NOT EXISTS "coach_rating_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL REFERENCES "coaches"("id") ON DELETE CASCADE,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "rating" real NOT NULL,
  "previous_rating" real,
  "change" real,
  "world_rank" integer,
  "model_version" text NOT NULL DEFAULT 'coach-rating-v1',
  "calculated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_rating_history_coach_idx" ON "coach_rating_history" ("coach_id");
CREATE UNIQUE INDEX IF NOT EXISTS "coach_rating_history_coach_fixture_unique"
  ON "coach_rating_history" ("coach_id", "fixture_id")
  WHERE "fixture_id" IS NOT NULL;
