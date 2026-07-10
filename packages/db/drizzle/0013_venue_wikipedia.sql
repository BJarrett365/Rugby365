ALTER TABLE "venues" ADD COLUMN "record_attendance" integer;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "wikipedia_url" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "wikidata_id" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "archive_synced_at" timestamp with time zone;
