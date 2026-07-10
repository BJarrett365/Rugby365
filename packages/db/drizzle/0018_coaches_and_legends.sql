CREATE TABLE IF NOT EXISTS "coaches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "external_provider_id" text,
  "source_provider" text DEFAULT 'manual' NOT NULL,
  "birth_date" date,
  "nationality" text,
  "image_url" text,
  "bio_summary" text,
  "wikipedia_url" text,
  "wikidata_id" text,
  "source_url" text,
  "notes" text,
  "social_accounts" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "coaches_slug_unique" ON "coaches" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "coaches_external_provider_id_unique"
  ON "coaches" USING btree ("external_provider_id")
  WHERE "external_provider_id" is not null;

CREATE TABLE IF NOT EXISTS "team_coaching_staff" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "season_id" uuid,
  "role" text NOT NULL,
  "start_date" date,
  "end_date" date,
  "is_current" boolean DEFAULT false NOT NULL,
  "bio_summary" text,
  "notes" text,
  "source_url" text,
  "import_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "team_coaching_staff"
  ADD CONSTRAINT "team_coaching_staff_coach_id_coaches_id_fk"
  FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "team_coaching_staff"
  ADD CONSTRAINT "team_coaching_staff_team_id_teams_id_fk"
  FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "team_coaching_staff"
  ADD CONSTRAINT "team_coaching_staff_season_id_competition_seasons_id_fk"
  FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "team_coaching_staff_import_key_unique"
  ON "team_coaching_staff" USING btree ("import_key")
  WHERE "import_key" is not null;

CREATE TABLE IF NOT EXISTS "player_legends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "legend_status" text DEFAULT 'active' NOT NULL,
  "legend_level" text NOT NULL,
  "team_id" uuid,
  "competition_id" uuid,
  "country_name" text,
  "international_team_id" uuid,
  "era" text,
  "reason" text,
  "career_summary" text,
  "key_achievements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notable_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "editor_notes" text,
  "source_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "player_legends"
  ADD CONSTRAINT "player_legends_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "player_legends"
  ADD CONSTRAINT "player_legends_team_id_teams_id_fk"
  FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "player_legends"
  ADD CONSTRAINT "player_legends_competition_id_competitions_id_fk"
  FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "player_legends"
  ADD CONSTRAINT "player_legends_international_team_id_teams_id_fk"
  FOREIGN KEY ("international_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "player_legends_player_team_level_unique"
  ON "player_legends" USING btree ("player_id", "team_id", "legend_level")
  WHERE "team_id" is not null;
