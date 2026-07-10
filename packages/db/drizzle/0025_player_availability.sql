CREATE TABLE IF NOT EXISTS "player_injuries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "injury_type" text,
  "body_area" text,
  "injury_date" date,
  "date_reported" date,
  "expected_return_date" date,
  "actual_return_date" date,
  "status" text NOT NULL DEFAULT 'injured',
  "matches_missed" integer NOT NULL DEFAULT 0,
  "source" text,
  "source_url" text,
  "notes" text,
  "last_verified_date" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_injuries_player_idx" ON "player_injuries" ("player_id", "status");
CREATE INDEX IF NOT EXISTS "player_injuries_team_idx" ON "player_injuries" ("team_id", "status");

CREATE TABLE IF NOT EXISTS "player_suspensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "fixture_id" uuid REFERENCES "fixtures"("id") ON DELETE SET NULL,
  "incident_date" date,
  "offence" text,
  "card_type" text,
  "hearing_date" date,
  "suspension_start" date,
  "suspension_end" date,
  "matches_suspended" integer,
  "matches_served" integer NOT NULL DEFAULT 0,
  "matches_remaining" integer,
  "status" text NOT NULL DEFAULT 'suspended',
  "source" text,
  "source_url" text,
  "notes" text,
  "last_verified_date" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_suspensions_player_idx" ON "player_suspensions" ("player_id", "status");
CREATE INDEX IF NOT EXISTS "player_suspensions_team_idx" ON "player_suspensions" ("team_id", "status");
