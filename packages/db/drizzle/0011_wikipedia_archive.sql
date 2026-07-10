-- Wikipedia / Wikimedia Enterprise archive data (read-only enrichment)

CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO integration_settings (slug, label, config)
VALUES ('wikimedia_enterprise', 'Wikimedia Enterprise', '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg integer,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS relatives text,
  ADD COLUMN IF NOT EXISTS positions jsonb,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS bio_summary text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS wikidata_id text,
  ADD COLUMN IF NOT EXISTS archive_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS players_wikidata_id_unique
  ON players (wikidata_id)
  WHERE wikidata_id IS NOT NULL;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS bio_summary text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS wikidata_id text,
  ADD COLUMN IF NOT EXISTS archive_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS teams_wikidata_id_unique
  ON teams (wikidata_id)
  WHERE wikidata_id IS NOT NULL;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS bio_summary text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS wikidata_id text,
  ADD COLUMN IF NOT EXISTS archive_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_wikidata_id_unique
  ON competitions (wikidata_id)
  WHERE wikidata_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_career_stints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  career_type text NOT NULL,
  start_year integer,
  end_year integer,
  years_label text NOT NULL,
  team_name text NOT NULL,
  team_id uuid REFERENCES teams(id),
  apps integer,
  points integer,
  sort_order integer NOT NULL DEFAULT 0,
  source_provider text NOT NULL DEFAULT 'wikipedia',
  source_url text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_career_stints_unique
  ON player_career_stints (player_id, career_type, years_label, team_name);
