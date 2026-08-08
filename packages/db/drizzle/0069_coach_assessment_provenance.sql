ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "preferred_system_provenance" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "coaching_style_provenance" text DEFAULT 'unverified' NOT NULL;
