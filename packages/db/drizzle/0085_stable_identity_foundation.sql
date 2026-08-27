-- Stable identity foundation: Sport CC as default provider mapping, aliases, CMS review queue.
-- Builds on provider_entity_mappings (0035) — does not replace internal UUID primary keys.

ALTER TABLE "provider_entity_mappings"
  ADD COLUMN IF NOT EXISTS "is_default_provider" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "provider_entity_mappings"
  ADD COLUMN IF NOT EXISTS "first_seen_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "provider_entity_mappings"
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

-- At most one default mapping per (entity_type, rugby365_id, provider).
CREATE UNIQUE INDEX IF NOT EXISTS "provider_entity_mappings_default_provider_unique"
  ON "provider_entity_mappings" ("entity_type", "rugby365_id", "provider")
  WHERE "is_default_provider" = true AND "rugby365_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "entity_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "rugby365_id" uuid NOT NULL,
  "alias" text NOT NULL,
  "normalized_alias" text NOT NULL,
  "alias_kind" text NOT NULL DEFAULT 'name',
  "is_approved" boolean NOT NULL DEFAULT true,
  "source_provider" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_aliases_type_normalized_unique"
  ON "entity_aliases" ("entity_type", "normalized_alias");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_aliases_entity_idx"
  ON "entity_aliases" ("entity_type", "rugby365_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "identity_review_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "provider" text NOT NULL,
  "provider_key" text NOT NULL,
  "incoming_name" text,
  "suggested_rugby365_id" uuid,
  "suggested_name" text,
  "confidence" integer NOT NULL DEFAULT 0,
  "match_reason" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'open',
  "resolution" text,
  "resolved_by" text,
  "resolved_at" timestamptz,
  "conflict_fields" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "existing_aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "existing_provider_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes" text,
  "mapping_id" uuid REFERENCES "provider_entity_mappings"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_review_queue_open_provider_unique"
  ON "identity_review_queue" ("provider", "entity_type", "provider_key")
  WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_review_queue_status_idx"
  ON "identity_review_queue" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_review_queue_entity_idx"
  ON "identity_review_queue" ("entity_type", "suggested_rugby365_id");
