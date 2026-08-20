-- Player ranking history for public Player Rankings card + /rankings/players movement.

CREATE TABLE IF NOT EXISTS "player_ranking_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "scope" text NOT NULL DEFAULT 'global',
  "metric_key" text NOT NULL,
  "position_key" text,
  "nation_key" text,
  "competition_key" text,
  "rank" integer,
  "pool" integer NOT NULL DEFAULT 0,
  "score" real,
  "status" text NOT NULL DEFAULT 'pending',
  "model_version" text NOT NULL DEFAULT 'player-ranking-v1',
  "is_current" boolean NOT NULL DEFAULT true,
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_history_player_idx"
  ON "player_ranking_history" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_history_player_current_idx"
  ON "player_ranking_history" ("player_id", "is_current");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_history_scope_metric_idx"
  ON "player_ranking_history" ("scope", "metric_key", "is_current");
