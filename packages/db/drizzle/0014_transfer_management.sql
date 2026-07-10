ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "movement_type" text DEFAULT 'permanent' NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "season_id" uuid;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "competition_id" uuid;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "position_name" text;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "import_key" text;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "source_url" text;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_season_id_competition_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."competition_seasons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_transfers_import_key_unique" ON "player_transfers" USING btree ("import_key") WHERE "player_transfers"."import_key" is not null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_import_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_provider" text DEFAULT 'wikipedia' NOT NULL,
	"source_url" text NOT NULL,
	"season_label" text,
	"competition_id" uuid,
	"status" text DEFAULT 'completed' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "transfer_import_logs" ADD CONSTRAINT "transfer_import_logs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "competition_seasons" ("competition_id", "slug", "label", "year", "is_active", "source_provider")
SELECT c.id, '2026-27', '2026–27', 2026, true, 'manual'
FROM "competitions" c
WHERE c.slug = 'premiership'
ON CONFLICT ("competition_id", "label") DO NOTHING;
