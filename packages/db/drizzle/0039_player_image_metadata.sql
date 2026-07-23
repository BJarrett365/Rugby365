ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "photographer" text;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "agency" text;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "copyright" text;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "licence" text DEFAULT 'planet_rugby';
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "focal_x" integer;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "focal_y" integer;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "width_px" integer;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "height_px" integer;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "is_ai_generated" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "player_images" ADD COLUMN IF NOT EXISTS "updated_by" text;
