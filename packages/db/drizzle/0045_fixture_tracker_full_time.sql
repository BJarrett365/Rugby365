ALTER TABLE "fixture_tracker_settings"
  ADD COLUMN IF NOT EXISTS "full_time_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "fixture_tracker_settings"
  ADD COLUMN IF NOT EXISTS "full_time_confirmed_by" text;
