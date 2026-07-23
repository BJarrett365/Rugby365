-- Planet Rugby player image enrichment: gallery, roles, confidence, history.
CREATE TABLE IF NOT EXISTS "player_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "canonical_url" text,
  "source_provider" text NOT NULL DEFAULT 'planet_rugby',
  "source_page_url" text,
  "source_article_title" text,
  "caption" text,
  "alt_text" text,
  "credit" text,
  "image_type" text NOT NULL DEFAULT 'action',
  "role" text NOT NULL DEFAULT 'gallery',
  "confidence" text NOT NULL DEFAULT 'low',
  "confidence_score" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'candidate',
  "is_public" boolean NOT NULL DEFAULT false,
  "match_context" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "discovered_at" timestamp with time zone NOT NULL DEFAULT now(),
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "rejected_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_images_player_canonical_unique"
  ON "player_images" ("player_id", "canonical_url")
  WHERE "canonical_url" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_images_player_url_unique"
  ON "player_images" ("player_id", "image_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_images_player_status_idx"
  ON "player_images" ("player_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_images_player_role_idx"
  ON "player_images" ("player_id", "role");
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "primary_image_approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "primary_image_id" uuid REFERENCES "player_images"("id") ON DELETE SET NULL;
