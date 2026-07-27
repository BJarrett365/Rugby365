CREATE TABLE IF NOT EXISTS "fixture_tracker_settings" (
  "fixture_id" uuid PRIMARY KEY REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "tracker_activated" boolean NOT NULL DEFAULT false,
  "public_animation_enabled" boolean NOT NULL DEFAULT false,
  "public_replay_enabled" boolean NOT NULL DEFAULT false,
  "mode" text NOT NULL DEFAULT 'manual',
  "countdown_held" boolean NOT NULL DEFAULT false,
  "countdown_cancelled" boolean NOT NULL DEFAULT false,
  "kick_off_delayed" boolean NOT NULL DEFAULT false,
  "revised_kickoff_at" timestamp with time zone,
  "kick_off_confirmed_at" timestamp with time zone,
  "match_started_at" timestamp with time zone,
  "match_started_by" text,
  "preview_mode" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixture_tracker_settings_public_idx"
  ON "fixture_tracker_settings" ("public_animation_enabled");
