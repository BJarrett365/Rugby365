ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "squad_number" integer;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rugbypass_slug" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rugbypass_url" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rugbypass_player_id" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rugbypass_synced_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "players_rugbypass_slug_unique"
  ON "players" USING btree ("rugbypass_slug")
  WHERE "rugbypass_slug" is not null;

CREATE UNIQUE INDEX IF NOT EXISTS "players_rugbypass_player_id_unique"
  ON "players" USING btree ("rugbypass_player_id")
  WHERE "rugbypass_player_id" is not null;

CREATE TABLE IF NOT EXISTS "player_external_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "source_provider" text DEFAULT 'rugbypass' NOT NULL,
  "import_key" text NOT NULL,
  "fixture_id" uuid,
  "competition_name" text,
  "season_label" text,
  "team_name" text,
  "opponent_name" text,
  "match_title" text,
  "kickoff_at" timestamp with time zone,
  "squad_role" text,
  "minutes_played" integer DEFAULT 0 NOT NULL,
  "tries" integer DEFAULT 0 NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "conversions" integer DEFAULT 0 NOT NULL,
  "stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_url" text,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "player_external_matches"
  ADD CONSTRAINT "player_external_matches_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "player_external_matches"
  ADD CONSTRAINT "player_external_matches_fixture_id_fixtures_id_fk"
  FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "player_external_matches_import_key_unique"
  ON "player_external_matches" USING btree ("import_key");
