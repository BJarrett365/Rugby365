ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "career_status" text DEFAULT 'active' NOT NULL;
