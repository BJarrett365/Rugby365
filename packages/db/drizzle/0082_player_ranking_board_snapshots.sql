-- Board-level player ranking snapshots (CURRENT / ALL-TIME filter boards).
-- Public /rankings/players serves from is_current rows; rebuild jobs write new snapshots.

ALTER TABLE "player_ranking_history"
  ADD COLUMN IF NOT EXISTS "club_key" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "player_ranking_board_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mode" text NOT NULL DEFAULT 'current',
  "filter_key" text NOT NULL,
  "position_key" text,
  "nation_key" text,
  "club_key" text,
  "competition_key" text,
  "era_key" text,
  "top_n" integer NOT NULL DEFAULT 10,
  "model_version" text NOT NULL DEFAULT 'player-rank-current-v1',
  "pool" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL DEFAULT 'WORLD TOP 10 PLAYERS',
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "eligibility_note" text,
  "status" text NOT NULL DEFAULT 'ready',
  "is_current" boolean NOT NULL DEFAULT true,
  "calculated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_board_snapshots_filter_current_idx"
  ON "player_ranking_board_snapshots" ("filter_key", "is_current");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_board_snapshots_mode_current_idx"
  ON "player_ranking_board_snapshots" ("mode", "is_current", "calculated_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_ranking_history_club_key_idx"
  ON "player_ranking_history" ("club_key");
