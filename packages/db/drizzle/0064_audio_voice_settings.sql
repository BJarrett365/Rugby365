-- Audio Commentary admin: voice speed/tone/provider + competition defaults + match overrides.

ALTER TABLE "audio_voice_profiles"
  ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'elevenlabs' NOT NULL,
  ADD COLUMN IF NOT EXISTS "openai_voice" text,
  ADD COLUMN IF NOT EXISTS "speed" real DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "tone" text DEFAULT 'broadcast' NOT NULL,
  ADD COLUMN IF NOT EXISTS "pitch" text,
  ADD COLUMN IF NOT EXISTS "stability" real,
  ADD COLUMN IF NOT EXISTS "similarity_boost" real,
  ADD COLUMN IF NOT EXISTS "style_exaggeration" real;

-- Sensible Currie Cup SA duo defaults (speed / tone / OpenAI fallback voices).
UPDATE "audio_voice_profiles"
SET
  "provider" = 'elevenlabs',
  "openai_voice" = 'onyx',
  "speed" = 1.05,
  "tone" = 'energetic',
  "stability" = 0.4,
  "similarity_boost" = 0.75,
  "style_exaggeration" = 0.45,
  "updated_at" = now()
WHERE "slug" = 'currie-cup-lead-sa';

UPDATE "audio_voice_profiles"
SET
  "provider" = 'elevenlabs',
  "openai_voice" = 'nova',
  "speed" = 0.98,
  "tone" = 'analytical',
  "stability" = 0.55,
  "similarity_boost" = 0.7,
  "style_exaggeration" = 0.2,
  "updated_at" = now()
WHERE "slug" = 'currie-cup-analyst-sa';

CREATE TABLE IF NOT EXISTS "audio_commentary_defaults" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "competition_scope" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "accent_label" text,
  "locale" text DEFAULT 'en-ZA' NOT NULL,
  "stadium_ambience_key" text,
  "lead_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  "analyst_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_commentary_defaults_scope_idx"
  ON "audio_commentary_defaults" ("competition_scope");

INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "notes"
)
SELECT
  'currie_cup',
  'Currie Cup SA Duo',
  'South African English',
  'en-ZA',
  'stadium_sa_generic',
  lead.id,
  analyst.id,
  'Default Lead + Analyst for Currie Cup. Voice IDs stay server-side.'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-lead-sa' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-analyst-sa' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO NOTHING;

INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "notes"
)
SELECT
  'global',
  'Site default (Currie Cup SA)',
  'South African English',
  'en-ZA',
  'stadium_sa_generic',
  lead.id,
  analyst.id,
  'Fallback when competition has no dedicated duo yet.'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-lead-sa' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-analyst-sa' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO NOTHING;

CREATE TABLE IF NOT EXISTS "audio_match_voice_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fixture_id" uuid NOT NULL UNIQUE REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "lead_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  "analyst_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  "lead_speed" real,
  "analyst_speed" real,
  "lead_tone" text,
  "analyst_tone" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audio_match_voice_settings_fixture_idx"
  ON "audio_match_voice_settings" ("fixture_id");
