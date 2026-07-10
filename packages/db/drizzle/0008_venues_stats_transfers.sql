CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country_name" text,
	"capacity" integer,
	"team_id" uuid,
	"source_provider" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "home_venue_id" uuid;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "nation_code" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "club_team_id" uuid;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "international_team_id" uuid;
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_club_team_id_teams_id_fk" FOREIGN KEY ("club_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_international_team_id_teams_id_fk" FOREIGN KEY ("international_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "venue_id" uuid;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "attendance" integer;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN "from_team_id" uuid;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN "to_team_id" uuid;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN "transfer_type" text DEFAULT 'club' NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_transfers" ALTER COLUMN "to_club" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "tries" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "conversions" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "penalties" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "drop_goals" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "points" integer DEFAULT 0 NOT NULL;
