-- CMS fields required to produce public player profile analytics (contract, agent, debut, titles).

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "contract_expires_on" date,
  ADD COLUMN IF NOT EXISTS "reported_salary_gbp" integer,
  ADD COLUMN IF NOT EXISTS "salary_as_of" date,
  ADD COLUMN IF NOT EXISTS "agent_name" text,
  ADD COLUMN IF NOT EXISTS "agent_agency" text,
  ADD COLUMN IF NOT EXISTS "club_debut_on" date;

CREATE TABLE IF NOT EXISTS "player_titles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "title_type" text NOT NULL DEFAULT 'other',
  "competition_id" uuid REFERENCES "competitions"("id") ON DELETE SET NULL,
  "season_label" text,
  "year" integer,
  "title" text NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "source_url" text,
  "visibility" text DEFAULT 'public' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_titles_player_idx" ON "player_titles" ("player_id");
CREATE INDEX IF NOT EXISTS "player_titles_type_idx" ON "player_titles" ("title_type");
