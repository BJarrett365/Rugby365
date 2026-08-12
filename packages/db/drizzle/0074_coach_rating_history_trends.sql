ALTER TABLE coach_rating_history
  ADD COLUMN IF NOT EXISTS snapshot_type text NOT NULL DEFAULT 'recalculated',
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS opponent_id uuid,
  ADD COLUMN IF NOT EXISTS competition_id uuid,
  ADD COLUMN IF NOT EXISTS match_date timestamptz,
  ADD COLUMN IF NOT EXISTS home_away_neutral text,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS score_for integer,
  ADD COLUMN IF NOT EXISTS score_against integer,
  ADD COLUMN IF NOT EXISTS power_index real,
  ADD COLUMN IF NOT EXISTS power_index_change real,
  ADD COLUMN IF NOT EXISTS opponent_rating real,
  ADD COLUMN IF NOT EXISTS opponent_rank integer,
  ADD COLUMN IF NOT EXISTS confidence integer,
  ADD COLUMN IF NOT EXISTS coverage integer,
  ADD COLUMN IF NOT EXISTS data_confidence text,
  ADD COLUMN IF NOT EXISTS power_index_version text,
  ADD COLUMN IF NOT EXISTS intelligence_model_version text,
  ADD COLUMN IF NOT EXISTS contributions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS intelligence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS major_match_label text,
  ADD COLUMN IF NOT EXISTS competition_name text,
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS opponent_name text,
  ADD COLUMN IF NOT EXISTS fixture_slug text;
--> statement-breakpoint
-- Existing rows are same-day recalc jobs with no fixture — mark clearly.
UPDATE coach_rating_history
SET snapshot_type = 'recalculated'
WHERE fixture_id IS NULL AND snapshot_type = 'recalculated';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS coach_rating_history_match_date_idx
  ON coach_rating_history (coach_id, match_date DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS coach_rating_history_snapshot_type_idx
  ON coach_rating_history (coach_id, snapshot_type);
