ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "publish_status" text DEFAULT 'published' NOT NULL;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "seo_title" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "seo_description" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "og_image_url" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "public_intro_override" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "preferred_foot" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "status_override" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "profile_updated_at" timestamp with time zone;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "players_publish_status_idx" ON "players" ("publish_status");

ALTER TABLE "player_injuries" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
ALTER TABLE "player_injuries" ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'confirmed' NOT NULL;

ALTER TABLE "player_suspensions" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
ALTER TABLE "player_suspensions" ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'confirmed' NOT NULL;
