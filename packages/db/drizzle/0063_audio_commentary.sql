-- Rugby365 Live Audio Commentary — scripts, voice profiles, and forward-compat stubs.
-- Written Intelligence Engine stays on-screen; audio is a separate Lead + Analyst rewrite.

CREATE TABLE IF NOT EXISTS "audio_voice_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "role" text NOT NULL,
  "accent" text,
  "locale" text DEFAULT 'en-ZA' NOT NULL,
  "elevenlabs_voice_id" text,
  "competition_scope" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_voice_profiles_role_scope_idx"
  ON "audio_voice_profiles" ("role", "competition_scope");

-- Currie Cup defaults: South African English dual commentators (placeholders — voice IDs server-only).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'currie-cup-lead-sa',
    'Currie Cup Lead (SA English)',
    'lead',
    'south_african_english',
    'en-ZA',
    'currie_cup',
    true,
    'active',
    'Placeholder Lead voice for Currie Cup dual-commentary. Set elevenlabs_voice_id via admin/keys — never expose publicly.'
  ),
  (
    'currie-cup-analyst-sa',
    'Currie Cup Analyst (SA English)',
    'analyst',
    'south_african_english',
    'en-ZA',
    'currie_cup',
    true,
    'active',
    'Placeholder Analyst voice for Currie Cup dual-commentary. Set elevenlabs_voice_id via admin/keys — never expose publicly.'
  )
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "audio_commentary_scripts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "commentary_id" uuid REFERENCES "match_commentary"("id") ON DELETE SET NULL,
  "minute" integer NOT NULL,
  "second" integer DEFAULT 0 NOT NULL,
  "combination_type" text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "layers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "lead_script" text NOT NULL,
  "analyst_script" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "source_body" text,
  "facts" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_commentary_scripts_fixture_minute_idx"
  ON "audio_commentary_scripts" ("fixture_id", "minute", "second");

CREATE INDEX IF NOT EXISTS "audio_commentary_scripts_fixture_status_idx"
  ON "audio_commentary_scripts" ("fixture_id", "status");

CREATE INDEX IF NOT EXISTS "audio_commentary_scripts_commentary_idx"
  ON "audio_commentary_scripts" ("commentary_id");

-- Phase 3+ stubs: private TTS segments (storage paths never public-facing).
CREATE TABLE IF NOT EXISTS "audio_commentary_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "script_id" uuid REFERENCES "audio_commentary_scripts"("id") ON DELETE CASCADE,
  "speaker" text NOT NULL,
  "voice_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  "storage_path" text,
  "duration_ms" integer,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_commentary_segments_fixture_idx"
  ON "audio_commentary_segments" ("fixture_id", "status");

CREATE INDEX IF NOT EXISTS "audio_commentary_segments_script_idx"
  ON "audio_commentary_segments" ("script_id");

-- Phase 3+ stubs: TTS / mix / publish job queue.
CREATE TABLE IF NOT EXISTS "audio_commentary_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "script_id" uuid REFERENCES "audio_commentary_scripts"("id") ON DELETE SET NULL,
  "job_type" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "error" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_commentary_jobs_status_idx"
  ON "audio_commentary_jobs" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "audio_commentary_jobs_fixture_idx"
  ON "audio_commentary_jobs" ("fixture_id", "job_type");
