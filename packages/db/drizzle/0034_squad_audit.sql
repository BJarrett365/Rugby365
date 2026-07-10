CREATE TABLE IF NOT EXISTS "squad_audit_clubs" (
  "team_id" uuid PRIMARY KEY NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "official_club_name" text NOT NULL,
  "official_squad_url" text,
  "source_type" text NOT NULL DEFAULT 'club_website',
  "backup_source_type" text,
  "import_parser" text,
  "status" text NOT NULL DEFAULT 'not_started',
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "source_checked_at" timestamptz,
  "last_successful_import_at" timestamptz,
  "last_error" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "squad_audit_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "season_id" uuid REFERENCES "competition_seasons"("id") ON DELETE SET NULL,
  "source_url" text,
  "job_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "progress" integer NOT NULL DEFAULT 0,
  "total_players" integer NOT NULL DEFAULT 0,
  "matched" integer NOT NULL DEFAULT 0,
  "unmatched" integer NOT NULL DEFAULT 0,
  "conflicts" integer NOT NULL DEFAULT 0,
  "report" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "squad_audit_jobs_team_id_idx" ON "squad_audit_jobs" ("team_id");
CREATE INDEX IF NOT EXISTS "squad_audit_jobs_status_idx" ON "squad_audit_jobs" ("status");

CREATE TABLE IF NOT EXISTS "squad_audit_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "squad_audit_jobs"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL,
  "source_player_name" text NOT NULL,
  "matched_player_name" text,
  "position" text,
  "secondary_position" text,
  "squad_number" integer,
  "rugby365_position" text,
  "rugby365_squad_number" integer,
  "rugby365_club" text,
  "official_club" text,
  "match_confidence" text,
  "review_status" text NOT NULL DEFAULT 'pending',
  "conflict_type" text,
  "group_type" text NOT NULL,
  "source_url" text,
  "source_type" text,
  "source_checked_at" timestamptz,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "squad_audit_players_job_id_idx" ON "squad_audit_players" ("job_id");
CREATE INDEX IF NOT EXISTS "squad_audit_players_team_id_idx" ON "squad_audit_players" ("team_id");
CREATE INDEX IF NOT EXISTS "squad_audit_players_player_id_idx" ON "squad_audit_players" ("player_id");
CREATE INDEX IF NOT EXISTS "squad_audit_players_review_status_idx" ON "squad_audit_players" ("review_status");
CREATE INDEX IF NOT EXISTS "squad_audit_players_source_type_idx" ON "squad_audit_players" ("source_type");
CREATE INDEX IF NOT EXISTS "squad_audit_players_source_checked_at_idx" ON "squad_audit_players" ("source_checked_at");

CREATE TABLE IF NOT EXISTS "squad_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "job_id" uuid REFERENCES "squad_audit_jobs"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "user_label" text NOT NULL DEFAULT 'system',
  "before_value" jsonb,
  "after_value" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "squad_audit_log_team_id_idx" ON "squad_audit_log" ("team_id");
CREATE INDEX IF NOT EXISTS "squad_audit_log_created_at_idx" ON "squad_audit_log" ("created_at");
