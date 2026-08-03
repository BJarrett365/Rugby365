-- Multi-presenter (1–4) voice settings + match voice overrides + script slots.
-- Default remains 2 (Lead + Analyst). Roles: lead, analyst, sideline, guest.

ALTER TABLE "audio_commentary_defaults"
  ADD COLUMN IF NOT EXISTS "presenter_count" integer DEFAULT 2 NOT NULL,
  ADD COLUMN IF NOT EXISTS "sideline_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "guest_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL;

ALTER TABLE "audio_match_voice_settings"
  ADD COLUMN IF NOT EXISTS "presenter_count" integer,
  ADD COLUMN IF NOT EXISTS "sideline_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "guest_profile_id" uuid REFERENCES "audio_voice_profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "sideline_speed" real,
  ADD COLUMN IF NOT EXISTS "guest_speed" real,
  ADD COLUMN IF NOT EXISTS "sideline_tone" text,
  ADD COLUMN IF NOT EXISTS "guest_tone" text,
  ADD COLUMN IF NOT EXISTS "sideline_voice_style" text,
  ADD COLUMN IF NOT EXISTS "guest_voice_style" text,
  ADD COLUMN IF NOT EXISTS "sideline_delivery_style" text,
  ADD COLUMN IF NOT EXISTS "guest_delivery_style" text,
  -- Per-role provider + voice IDs for this match only (admin-only; never public).
  -- Shape: { lead?: { provider?, elevenlabsVoiceId?, openaiVoice? }, analyst?: …, sideline?: …, guest?: … }
  ADD COLUMN IF NOT EXISTS "voice_overrides" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "audio_commentary_scripts"
  ADD COLUMN IF NOT EXISTS "sideline_script" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "guest_script" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "presenter_count" integer DEFAULT 2 NOT NULL;

-- Allow provider auto on profiles (text already; document convention: auto | elevenlabs | openai).
COMMENT ON COLUMN "audio_voice_profiles"."provider" IS 'auto | elevenlabs | openai';

-- Currie Cup Sideline + Guest synthetic profiles (editorial labels only).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'currie-cup-sideline-sa',
    'Currie Cup Sideline (SA)',
    'sideline',
    'south_african_english',
    'en-ZA',
    'South African English',
    'Currie Cup',
    'former_player',
    'energetic',
    'auto',
    'echo',
    1.02,
    'energetic',
    'currie_cup',
    true,
    'active',
    'Touchline / colour commentator — synthetic editorial label only.'
  ),
  (
    'currie-cup-guest-sa',
    'Currie Cup Guest (SA)',
    'guest',
    'south_african_english',
    'en-ZA',
    'South African English',
    'Currie Cup',
    'storyteller',
    'calm',
    'auto',
    'fable',
    0.98,
    'broadcast',
    'currie_cup',
    true,
    'active',
    'Fourth / guest voice — synthetic editorial label only.'
  )
ON CONFLICT ("slug") DO NOTHING;

-- Wire sideline/guest onto Currie Cup defaults (presenter_count stays 2 until editors opt in).
UPDATE "audio_commentary_defaults" d
SET
  "sideline_profile_id" = s.id,
  "guest_profile_id" = g.id,
  "updated_at" = now()
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-sideline-sa' LIMIT 1) AS s,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'currie-cup-guest-sa' LIMIT 1) AS g
WHERE d."competition_scope" IN ('currie_cup', 'global');

-- Prefer Auto provider on existing Currie Cup duo so TTS can fall back to OpenAI.
UPDATE "audio_voice_profiles"
SET
  "provider" = 'auto',
  "updated_at" = now()
WHERE "slug" IN ('currie-cup-lead-sa', 'currie-cup-analyst-sa')
  AND ("provider" IS NULL OR "provider" = 'elevenlabs');
