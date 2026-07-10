CREATE TABLE "referees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_name" text,
	"external_provider_id" text,
	"source_provider" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "referees_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "referees_external_provider_id_unique" ON "referees" USING btree ("external_provider_id") WHERE "referees"."external_provider_id" is not null;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "referee_id" uuid;
--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "player_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"from_club" text,
	"to_club" text NOT NULL,
	"effective_date" timestamp with time zone,
	"source_provider" text DEFAULT 'manual' NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
