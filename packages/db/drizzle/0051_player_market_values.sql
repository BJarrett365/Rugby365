-- Rugby365 Player Value snapshots (profile-only market worth model).
CREATE TABLE IF NOT EXISTS "player_market_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "as_of_year" integer NOT NULL,
  "is_current" boolean DEFAULT true NOT NULL,
  "model_version" text DEFAULT 'player-value-v1' NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "market_value_gbp" integer NOT NULL,
  "transfer_value_gbp" integer NOT NULL,
  "contract_value_gbp" integer NOT NULL,
  "future_value_gbp" integer NOT NULL,
  "peak_career_value_gbp" integer NOT NULL,
  "risk_score" integer DEFAULT 0 NOT NULL,
  "confidence" real DEFAULT 0.5 NOT NULL,
  "trend_pct" real,
  "trend_label" text,
  "rating_band_label" text,
  "base_value_gbp" integer,
  "factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "recommendations" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "media_check" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "calculated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_market_values_player_idx"
  ON "player_market_values" ("player_id");

CREATE UNIQUE INDEX IF NOT EXISTS "player_market_values_player_year_unique"
  ON "player_market_values" ("player_id", "as_of_year");
