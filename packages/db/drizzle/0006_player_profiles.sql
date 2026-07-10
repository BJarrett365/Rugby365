ALTER TABLE "players" ADD COLUMN "position_name" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "club_name" text;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "country_name" text;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "position_name" text;
--> statement-breakpoint
ALTER TABLE "fixture_players" ADD COLUMN "club_name" text;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "referee_name" text;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "venue_name" text;
--> statement-breakpoint
UPDATE "commentary_templates" SET "body" = '{minute}'' TRY! {player}{player_role} scores for {team}!' WHERE "template_key" = 'try_scored_alt';
--> statement-breakpoint
UPDATE "commentary_templates" SET "body" = '{minute}'' Conversion — {player}{player_role}.' WHERE "template_key" = 'conversion_good';
