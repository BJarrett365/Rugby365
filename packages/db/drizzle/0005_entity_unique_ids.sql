CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"external_provider_id" text,
	"source_provider" text DEFAULT 'manual' NOT NULL,
	"stage_external_id" text,
	"stage_name" text,
	CONSTRAINT "competitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_external_provider_id_unique" ON "competitions" ("external_provider_id") WHERE "external_provider_id" is not null;
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"external_provider_id" text,
	"source_provider" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "players_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "players_external_provider_id_unique" ON "players" ("external_provider_id") WHERE "external_provider_id" is not null;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "external_provider_id" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "source_provider" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "teams_external_provider_id_unique" ON "teams" ("external_provider_id") WHERE "external_provider_id" is not null;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "competition_id" uuid;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "fixture_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"jersey_number" integer,
	"squad_role" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD CONSTRAINT "fixture_players_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD CONSTRAINT "fixture_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD CONSTRAINT "fixture_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "fixture_players_fixture_player_unique" ON "fixture_players" ("fixture_id","player_id");
--> statement-breakpoint
ALTER TABLE "match_events" ADD COLUMN "player_id" uuid;
--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
