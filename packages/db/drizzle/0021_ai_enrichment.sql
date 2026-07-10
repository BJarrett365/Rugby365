CREATE TABLE "ai_enrichment_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "task" text NOT NULL,
  "status" "suggestion_status" DEFAULT 'pending' NOT NULL,
  "model" text NOT NULL,
  "prompt_system" text NOT NULL,
  "prompt_user" text NOT NULL,
  "source_snapshot" jsonb NOT NULL,
  "suggestions" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  "rejected_at" timestamp with time zone,
  "rejected_by" text,
  "applied_patch" jsonb
);

CREATE INDEX "ai_enrichment_suggestions_entity_idx"
  ON "ai_enrichment_suggestions" ("entity_type", "entity_id", "created_at");

CREATE TABLE "ai_verification_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "status" "suggestion_status" DEFAULT 'pending' NOT NULL,
  "model" text NOT NULL,
  "prompt_system" text NOT NULL,
  "prompt_user" text NOT NULL,
  "source_snapshot" jsonb NOT NULL,
  "report" jsonb NOT NULL,
  "confidence_score" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text
);

CREATE INDEX "ai_verification_reports_entity_idx"
  ON "ai_verification_reports" ("entity_type", "entity_id", "created_at");
