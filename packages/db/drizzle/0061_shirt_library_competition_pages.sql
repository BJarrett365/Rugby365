-- Public Shirt Library competition/season pages (CMS-publishable).

CREATE TABLE IF NOT EXISTS shirt_library_competition_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES competition_seasons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT',
  title text,
  subtitle text,
  description text,
  map_enabled boolean NOT NULL DEFAULT true,
  flags_enabled boolean NOT NULL DEFAULT true,
  colour_legend_enabled boolean NOT NULL DEFAULT true,
  about_section_enabled boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shirt_library_competition_pages_status_check
    CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS shirt_library_competition_pages_comp_season_unique
  ON shirt_library_competition_pages (competition_id, season_id);

CREATE INDEX IF NOT EXISTS shirt_library_competition_pages_status_idx
  ON shirt_library_competition_pages (status);

CREATE TABLE IF NOT EXISTS shirt_library_competition_page_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES shirt_library_competition_pages(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_shirt_id uuid REFERENCES team_shirts(id) ON DELETE SET NULL,
  away_shirt_id uuid REFERENCES team_shirts(id) ON DELETE SET NULL,
  third_shirt_id uuid REFERENCES team_shirts(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shirt_library_competition_page_teams_page_team_unique
  ON shirt_library_competition_page_teams (page_id, team_id);

CREATE INDEX IF NOT EXISTS shirt_library_competition_page_teams_page_idx
  ON shirt_library_competition_page_teams (page_id, sort_order);
