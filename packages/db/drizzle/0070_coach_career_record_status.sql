-- Coach career record status + overview/display fields
ALTER TABLE "team_coaching_staff"
  ADD COLUMN IF NOT EXISTS "record_status" text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS "overview_label" text,
  ADD COLUMN IF NOT EXISTS "team_display_name" text,
  ADD COLUMN IF NOT EXISTS "editor_notes" text;
--> statement-breakpoint
ALTER TABLE "coach_playing_stints"
  ADD COLUMN IF NOT EXISTS "record_status" text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS "career_type" text NOT NULL DEFAULT 'provincial_player',
  ADD COLUMN IF NOT EXISTS "overview_label" text,
  ADD COLUMN IF NOT EXISTS "team_display_name" text,
  ADD COLUMN IF NOT EXISTS "competition_level" text,
  ADD COLUMN IF NOT EXISTS "exact_start_date" date,
  ADD COLUMN IF NOT EXISTS "exact_end_date" date,
  ADD COLUMN IF NOT EXISTS "editor_notes" text,
  ADD COLUMN IF NOT EXISTS "confidence" text NOT NULL DEFAULT 'medium';
--> statement-breakpoint
-- Existing verified timestamps → verified status
UPDATE "team_coaching_staff"
SET "record_status" = 'verified'
WHERE "verified_at" IS NOT NULL AND "record_status" = 'needs_review';
--> statement-breakpoint
UPDATE "coach_playing_stints"
SET "record_status" = 'verified'
WHERE "verified_at" IS NOT NULL AND "record_status" = 'needs_review';
--> statement-breakpoint
-- Map playing team_type → career_type where still default
UPDATE "coach_playing_stints"
SET "career_type" = CASE
  WHEN "team_type" = 'international' THEN 'international_player'
  WHEN "team_type" = 'franchise' THEN 'super_rugby_player'
  WHEN "team_type" = 'club' THEN 'club_player'
  ELSE 'provincial_player'
END
WHERE "career_type" = 'provincial_player';
