-- Rugby365 Value Score history (player-value-score-v1).
-- Distinct from market value (GBP) snapshots in player_value_history.
-- Public pages read the latest is_current row — never recalculate on page load.

CREATE TABLE IF NOT EXISTS "player_value_score_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "value_score" real,
  "confidence" real NOT NULL DEFAULT 0,
  "coverage" real NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'UNDER_REVIEW',
  "model_version" text NOT NULL DEFAULT 'player-value-score-v1',
  "factor_scores" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "display" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "calculation_reason" text,
  "is_current" boolean NOT NULL DEFAULT true,
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_value_score_history_player_idx"
  ON "player_value_score_history" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_value_score_history_player_current_idx"
  ON "player_value_score_history" ("player_id", "is_current");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_value_score_history_player_calc_idx"
  ON "player_value_score_history" ("player_id", "calculated_at" DESC);
