-- Rugby365 Scout Intelligence: Recruitment Index (RRI) snapshots + scout notes.

CREATE TABLE IF NOT EXISTS "player_scout_profiles" (
  "player_id" uuid PRIMARY KEY REFERENCES "players"("id") ON DELETE CASCADE,
  "model_version" text DEFAULT 'rri-v1' NOT NULL,
  "rri_score" integer DEFAULT 0 NOT NULL,
  "rri_band" text DEFAULT 'Watchlist' NOT NULL,
  "rri_grade" text DEFAULT 'C' NOT NULL,
  "recommendation" text DEFAULT 'monitor' NOT NULL,
  "recommendation_confidence" integer DEFAULT 50 NOT NULL,
  "ai_summary" text,
  "overall_rating" integer,
  "potential" integer,
  "current_ability" integer,
  "ceiling" integer,
  "physical_score" integer,
  "attack_score" integer,
  "defence_score" integer,
  "set_piece_score" integer,
  "discipline_score" integer,
  "leadership_score" integer,
  "availability_score" integer,
  "risk_injury" text DEFAULT 'medium' NOT NULL,
  "risk_contract" text DEFAULT 'medium' NOT NULL,
  "risk_adaptation" text DEFAULT 'medium' NOT NULL,
  "risk_discipline" text DEFAULT 'medium' NOT NULL,
  "factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scorecard" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "player_dna" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "physical_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "career_projection" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "market_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tactical_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scout_rating" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "cms_notes" text,
  "published" boolean DEFAULT true NOT NULL,
  "calculated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_scout_profiles_rri_idx"
  ON "player_scout_profiles" ("rri_score" DESC);

CREATE INDEX IF NOT EXISTS "player_scout_profiles_recommendation_idx"
  ON "player_scout_profiles" ("recommendation");

CREATE TABLE IF NOT EXISTS "player_scout_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "observed_on" date,
  "venue" text,
  "match_context" text,
  "notes" text NOT NULL,
  "confidence" text DEFAULT 'medium' NOT NULL,
  "recommendation" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_scout_notes_player_idx"
  ON "player_scout_notes" ("player_id");

CREATE INDEX IF NOT EXISTS "player_scout_notes_observed_idx"
  ON "player_scout_notes" ("observed_on" DESC);
