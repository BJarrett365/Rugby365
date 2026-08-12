-- Player form history snapshots (player-form-v1).
-- Public overview may compute live; CMS/recalc can persist is_current rows.

CREATE TABLE IF NOT EXISTS "player_form_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "form_score" real,
  "form_label" text,
  "confidence" real NOT NULL DEFAULT 0,
  "matches_used" integer NOT NULL DEFAULT 0,
  "appearances_eligible" integer NOT NULL DEFAULT 0,
  "model_version" text NOT NULL DEFAULT 'player-form-v1',
  "result_strip" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "components" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metrics" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "calculation_reason" text,
  "is_current" boolean NOT NULL DEFAULT true,
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_form_history_player_idx"
  ON "player_form_history" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_form_history_player_current_idx"
  ON "player_form_history" ("player_id", "is_current");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_form_history_player_calc_idx"
  ON "player_form_history" ("player_id", "calculated_at" DESC);
