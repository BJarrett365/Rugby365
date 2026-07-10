CREATE TABLE IF NOT EXISTS "player_team_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "season_id" uuid NOT NULL REFERENCES "competition_seasons"("id") ON DELETE CASCADE,
  "competition_id" uuid NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "start_date" date,
  "end_date" date,
  "status" text NOT NULL DEFAULT 'active',
  "source_provider" text NOT NULL DEFAULT 'manual',
  "source_url" text,
  "notes" text,
  "synced_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_team_memberships_player_team_season_unique"
  ON "player_team_memberships" ("player_id", "team_id", "season_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_team_memberships_team_season_idx"
  ON "player_team_memberships" ("team_id", "season_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_team_memberships_season_status_idx"
  ON "player_team_memberships" ("season_id", "status");
