-- FUT-style Player Badge cutout (transparent PNG), separate from primary gallery photo.

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "badge_image_url" text,
  ADD COLUMN IF NOT EXISTS "badge_image_id" uuid;
