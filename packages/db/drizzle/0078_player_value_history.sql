-- Persisted player market value snapshots for VALUE TREND (24m) charts.
-- Written by player-value-history-service on material change / events / monthly schedule — never on page load.

CREATE TABLE IF NOT EXISTS "player_value_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "snapshot_date" timestamptz NOT NULL DEFAULT now(),
  "estimated_value" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'GBP',
  "confidence" real NOT NULL DEFAULT 0.5,
  "coverage" integer,
  "overall_rating" real,
  "potential_rating" real,
  "current_form_score" real,
  "club_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "contract_end_date" date,
  "contract_months_remaining" integer,
  "age_at_snapshot" integer,
  "primary_position" text,
  "value_score" real,
  "model_version" text NOT NULL DEFAULT 'player-value-v1',
  "snapshot_type" text NOT NULL DEFAULT 'LIVE',
  "status" text NOT NULL DEFAULT 'active',
  "calculation_reason" text,
  "factor_scores" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_value_history_player_idx"
  ON "player_value_history" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_value_history_player_date_idx"
  ON "player_value_history" ("player_id", "snapshot_date");
