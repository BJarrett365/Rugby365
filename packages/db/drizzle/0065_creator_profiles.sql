-- Creator / Commentator Profiles: Plexa-style display fields + regional seeds.
-- Synthetic editorial labels only (e.g. "Currie Cup Lead (SA English)") — not celebrity names.

ALTER TABLE "audio_voice_profiles"
  ADD COLUMN IF NOT EXISTS "organisation_label" text,
  ADD COLUMN IF NOT EXISTS "topic_label" text,
  ADD COLUMN IF NOT EXISTS "voice_style" text DEFAULT 'journalist' NOT NULL,
  ADD COLUMN IF NOT EXISTS "delivery_style" text DEFAULT 'balanced' NOT NULL,
  ADD COLUMN IF NOT EXISTS "ai_prompt" text;

ALTER TABLE "audio_commentary_defaults"
  ADD COLUMN IF NOT EXISTS "voice_style" text DEFAULT 'journalist',
  ADD COLUMN IF NOT EXISTS "delivery_style" text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS "optimise_dual_commentary" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "emphasise_scoreboard" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "ai_prompt" text;

ALTER TABLE "audio_match_voice_settings"
  ADD COLUMN IF NOT EXISTS "lead_voice_style" text,
  ADD COLUMN IF NOT EXISTS "analyst_voice_style" text,
  ADD COLUMN IF NOT EXISTS "lead_delivery_style" text,
  ADD COLUMN IF NOT EXISTS "analyst_delivery_style" text,
  ADD COLUMN IF NOT EXISTS "optimise_dual_commentary" boolean,
  ADD COLUMN IF NOT EXISTS "emphasise_scoreboard" boolean,
  ADD COLUMN IF NOT EXISTS "ai_prompt" text;

-- Backfill existing Currie Cup profiles with Creator Profile display fields.
UPDATE "audio_voice_profiles"
SET
  "organisation_label" = 'South African English',
  "topic_label" = 'Currie Cup',
  "voice_style" = 'television',
  "delivery_style" = 'energetic',
  "updated_at" = now()
WHERE "slug" = 'currie-cup-lead-sa';

UPDATE "audio_voice_profiles"
SET
  "organisation_label" = 'South African English',
  "topic_label" = 'Currie Cup',
  "voice_style" = 'analyst',
  "delivery_style" = 'balanced',
  "updated_at" = now()
WHERE "slug" = 'currie-cup-analyst-sa';

-- Default broadcast (global / Neutral) — Lead + Analyst.
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'default-broadcast-lead',
    'Default broadcast Lead',
    'lead',
    'neutral',
    'en',
    'Neutral',
    'Global',
    'journalist',
    'balanced',
    'openai',
    'onyx',
    1.0,
    'broadcast',
    'global',
    false,
    'active',
    'Synthetic Neutral Lead — editorial label only.'
  ),
  (
    'default-broadcast-analyst',
    'Default broadcast Analyst',
    'analyst',
    'neutral',
    'en',
    'Neutral',
    'Global',
    'analyst',
    'calm',
    'openai',
    'nova',
    0.98,
    'analytical',
    'global',
    false,
    'active',
    'Synthetic Neutral Analyst — editorial label only.'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "organisation_label" = EXCLUDED."organisation_label",
  "topic_label" = EXCLUDED."topic_label",
  "voice_style" = EXCLUDED."voice_style",
  "delivery_style" = EXCLUDED."delivery_style",
  "updated_at" = now();

-- Premiership (South of England / British English).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "stability", "similarity_boost", "style_exaggeration",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'premiership-lead-se',
    'Premiership Lead',
    'lead',
    'southern_english',
    'en-GB',
    'Southern English',
    'Premiership',
    'television',
    'energetic',
    'openai',
    'echo',
    1.04,
    'energetic',
    0.4,
    0.75,
    0.4,
    'premiership',
    true,
    'active',
    'Synthetic Premiership Lead — Southern English editorial label.'
  ),
  (
    'premiership-analyst-uk',
    'Premiership Analyst',
    'analyst',
    'british_english',
    'en-GB',
    'British English',
    'Premiership',
    'analyst',
    'balanced',
    'openai',
    'sage',
    0.97,
    'analytical',
    0.55,
    0.7,
    0.2,
    'premiership',
    true,
    'active',
    'Synthetic Premiership Analyst — British English editorial label.'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "organisation_label" = EXCLUDED."organisation_label",
  "topic_label" = EXCLUDED."topic_label",
  "voice_style" = EXCLUDED."voice_style",
  "delivery_style" = EXCLUDED."delivery_style",
  "openai_voice" = COALESCE("audio_voice_profiles"."openai_voice", EXCLUDED."openai_voice"),
  "speed" = EXCLUDED."speed",
  "tone" = EXCLUDED."tone",
  "updated_at" = now();

-- Major League Rugby (American English).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "stability", "similarity_boost", "style_exaggeration",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'mlr-lead-us',
    'MLR Lead',
    'lead',
    'american_english',
    'en-US',
    'American English',
    'Major League Rugby',
    'television',
    'energetic',
    'openai',
    'alloy',
    1.06,
    'energetic',
    0.38,
    0.75,
    0.45,
    'mlr',
    true,
    'active',
    'Synthetic MLR Lead — American English editorial label.'
  ),
  (
    'mlr-analyst-us',
    'MLR Analyst',
    'analyst',
    'american_english',
    'en-US',
    'American English',
    'Major League Rugby',
    'analyst',
    'balanced',
    'openai',
    'coral',
    0.98,
    'analytical',
    0.55,
    0.7,
    0.2,
    'mlr',
    true,
    'active',
    'Synthetic MLR Analyst — American English editorial label.'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "organisation_label" = EXCLUDED."organisation_label",
  "topic_label" = EXCLUDED."topic_label",
  "voice_style" = EXCLUDED."voice_style",
  "delivery_style" = EXCLUDED."delivery_style",
  "openai_voice" = COALESCE("audio_voice_profiles"."openai_voice", EXCLUDED."openai_voice"),
  "speed" = EXCLUDED."speed",
  "tone" = EXCLUDED."tone",
  "updated_at" = now();

-- NPC (New Zealand English).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "stability", "similarity_boost", "style_exaggeration",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'npc-lead-nz',
    'NPC Lead',
    'lead',
    'new_zealand_english',
    'en-NZ',
    'New Zealand English',
    'NPC',
    'television',
    'energetic',
    'openai',
    'onyx',
    1.05,
    'energetic',
    0.4,
    0.75,
    0.42,
    'npc',
    true,
    'active',
    'Synthetic NPC Lead — New Zealand English editorial label.'
  ),
  (
    'npc-analyst-nz',
    'NPC Analyst',
    'analyst',
    'new_zealand_english',
    'en-NZ',
    'New Zealand English',
    'NPC',
    'analyst',
    'balanced',
    'openai',
    'nova',
    0.97,
    'analytical',
    0.55,
    0.7,
    0.2,
    'npc',
    true,
    'active',
    'Synthetic NPC Analyst — New Zealand English editorial label.'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "organisation_label" = EXCLUDED."organisation_label",
  "topic_label" = EXCLUDED."topic_label",
  "voice_style" = EXCLUDED."voice_style",
  "delivery_style" = EXCLUDED."delivery_style",
  "openai_voice" = COALESCE("audio_voice_profiles"."openai_voice", EXCLUDED."openai_voice"),
  "speed" = EXCLUDED."speed",
  "tone" = EXCLUDED."tone",
  "updated_at" = now();

-- Top 14 Lead (French / English with FR accent label — config only).
INSERT INTO "audio_voice_profiles" (
  "slug", "display_name", "role", "accent", "locale",
  "organisation_label", "topic_label", "voice_style", "delivery_style",
  "provider", "openai_voice", "speed", "tone",
  "stability", "similarity_boost", "style_exaggeration",
  "competition_scope", "is_default", "status", "notes"
)
VALUES
  (
    'top14-lead-fr',
    'Top 14 Lead',
    'lead',
    'french_english',
    'en-FR',
    'French-accented English',
    'Top 14',
    'television',
    'balanced',
    'openai',
    'fable',
    1.02,
    'broadcast',
    0.45,
    0.72,
    0.35,
    'top14',
    true,
    'active',
    'Synthetic Top 14 Lead — French-accented English label (config only).'
  ),
  (
    'top14-analyst-fr',
    'Top 14 Analyst',
    'analyst',
    'french_english',
    'en-FR',
    'French-accented English',
    'Top 14',
    'analyst',
    'calm',
    'openai',
    'shimmer',
    0.96,
    'analytical',
    0.55,
    0.7,
    0.18,
    'top14',
    true,
    'active',
    'Synthetic Top 14 Analyst — French-accented English label (config only).'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "organisation_label" = EXCLUDED."organisation_label",
  "topic_label" = EXCLUDED."topic_label",
  "voice_style" = EXCLUDED."voice_style",
  "delivery_style" = EXCLUDED."delivery_style",
  "openai_voice" = COALESCE("audio_voice_profiles"."openai_voice", EXCLUDED."openai_voice"),
  "speed" = EXCLUDED."speed",
  "tone" = EXCLUDED."tone",
  "updated_at" = now();

-- Competition defaults rows (Lead + Analyst duo per scope).
INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "voice_style",
  "delivery_style",
  "optimise_dual_commentary",
  "emphasise_scoreboard",
  "notes"
)
SELECT
  'premiership',
  'Premiership SE Duo',
  'Southern English / British',
  'en-GB',
  'stadium_uk_generic',
  lead.id,
  analyst.id,
  'television',
  'balanced',
  true,
  true,
  'Default Lead + Analyst for English Premiership. Voice IDs stay server-side.'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'premiership-lead-se' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'premiership-analyst-uk' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO UPDATE SET
  "label" = EXCLUDED."label",
  "accent_label" = EXCLUDED."accent_label",
  "locale" = EXCLUDED."locale",
  "stadium_ambience_key" = COALESCE("audio_commentary_defaults"."stadium_ambience_key", EXCLUDED."stadium_ambience_key"),
  "lead_profile_id" = COALESCE("audio_commentary_defaults"."lead_profile_id", EXCLUDED."lead_profile_id"),
  "analyst_profile_id" = COALESCE("audio_commentary_defaults"."analyst_profile_id", EXCLUDED."analyst_profile_id"),
  "voice_style" = COALESCE("audio_commentary_defaults"."voice_style", EXCLUDED."voice_style"),
  "delivery_style" = COALESCE("audio_commentary_defaults"."delivery_style", EXCLUDED."delivery_style"),
  "updated_at" = now();

INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "voice_style",
  "delivery_style",
  "optimise_dual_commentary",
  "emphasise_scoreboard",
  "notes"
)
SELECT
  'mlr',
  'MLR US Duo',
  'American English',
  'en-US',
  'stadium_us_generic',
  lead.id,
  analyst.id,
  'television',
  'energetic',
  true,
  true,
  'Default Lead + Analyst for Major League Rugby.'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'mlr-lead-us' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'mlr-analyst-us' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO UPDATE SET
  "label" = EXCLUDED."label",
  "accent_label" = EXCLUDED."accent_label",
  "locale" = EXCLUDED."locale",
  "stadium_ambience_key" = COALESCE("audio_commentary_defaults"."stadium_ambience_key", EXCLUDED."stadium_ambience_key"),
  "lead_profile_id" = COALESCE("audio_commentary_defaults"."lead_profile_id", EXCLUDED."lead_profile_id"),
  "analyst_profile_id" = COALESCE("audio_commentary_defaults"."analyst_profile_id", EXCLUDED."analyst_profile_id"),
  "voice_style" = COALESCE("audio_commentary_defaults"."voice_style", EXCLUDED."voice_style"),
  "delivery_style" = COALESCE("audio_commentary_defaults"."delivery_style", EXCLUDED."delivery_style"),
  "updated_at" = now();

INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "voice_style",
  "delivery_style",
  "optimise_dual_commentary",
  "emphasise_scoreboard",
  "notes"
)
SELECT
  'npc',
  'NPC NZ Duo',
  'New Zealand English',
  'en-NZ',
  'stadium_nz_generic',
  lead.id,
  analyst.id,
  'television',
  'balanced',
  true,
  true,
  'Default Lead + Analyst for New Zealand NPC.'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'npc-lead-nz' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'npc-analyst-nz' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO UPDATE SET
  "label" = EXCLUDED."label",
  "accent_label" = EXCLUDED."accent_label",
  "locale" = EXCLUDED."locale",
  "stadium_ambience_key" = COALESCE("audio_commentary_defaults"."stadium_ambience_key", EXCLUDED."stadium_ambience_key"),
  "lead_profile_id" = COALESCE("audio_commentary_defaults"."lead_profile_id", EXCLUDED."lead_profile_id"),
  "analyst_profile_id" = COALESCE("audio_commentary_defaults"."analyst_profile_id", EXCLUDED."analyst_profile_id"),
  "voice_style" = COALESCE("audio_commentary_defaults"."voice_style", EXCLUDED."voice_style"),
  "delivery_style" = COALESCE("audio_commentary_defaults"."delivery_style", EXCLUDED."delivery_style"),
  "updated_at" = now();

INSERT INTO "audio_commentary_defaults" (
  "competition_scope",
  "label",
  "accent_label",
  "locale",
  "stadium_ambience_key",
  "lead_profile_id",
  "analyst_profile_id",
  "voice_style",
  "delivery_style",
  "optimise_dual_commentary",
  "emphasise_scoreboard",
  "notes"
)
SELECT
  'top14',
  'Top 14 FR Duo',
  'French-accented English',
  'en-FR',
  'stadium_fr_generic',
  lead.id,
  analyst.id,
  'television',
  'balanced',
  true,
  true,
  'Default Lead + Analyst for Top 14 (config / accent label only).'
FROM
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'top14-lead-fr' LIMIT 1) AS lead,
  (SELECT "id" FROM "audio_voice_profiles" WHERE "slug" = 'top14-analyst-fr' LIMIT 1) AS analyst
ON CONFLICT ("competition_scope") DO UPDATE SET
  "label" = EXCLUDED."label",
  "accent_label" = EXCLUDED."accent_label",
  "locale" = EXCLUDED."locale",
  "stadium_ambience_key" = COALESCE("audio_commentary_defaults"."stadium_ambience_key", EXCLUDED."stadium_ambience_key"),
  "lead_profile_id" = COALESCE("audio_commentary_defaults"."lead_profile_id", EXCLUDED."lead_profile_id"),
  "analyst_profile_id" = COALESCE("audio_commentary_defaults"."analyst_profile_id", EXCLUDED."analyst_profile_id"),
  "voice_style" = COALESCE("audio_commentary_defaults"."voice_style", EXCLUDED."voice_style"),
  "delivery_style" = COALESCE("audio_commentary_defaults"."delivery_style", EXCLUDED."delivery_style"),
  "updated_at" = now();

-- Enrich existing Currie Cup / global defaults with style flags.
UPDATE "audio_commentary_defaults"
SET
  "voice_style" = COALESCE("voice_style", 'television'),
  "delivery_style" = COALESCE("delivery_style", 'balanced'),
  "optimise_dual_commentary" = COALESCE("optimise_dual_commentary", true),
  "emphasise_scoreboard" = COALESCE("emphasise_scoreboard", true),
  "updated_at" = now()
WHERE "competition_scope" IN ('currie_cup', 'global');
