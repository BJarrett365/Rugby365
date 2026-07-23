-- Additive data-integration foundation for Rugby Data API (P1) mapping.
-- Does not alter or drop existing external_* columns or provider tables.

CREATE TABLE IF NOT EXISTS "provider_entity_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "entity_type" text NOT NULL,
  "external_id" text NOT NULL,
  "rugby365_id" uuid,
  "external_name" text,
  "rugby365_name" text,
  "status" text NOT NULL DEFAULT 'unmapped',
  "confidence" integer NOT NULL DEFAULT 0,
  "match_reason" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "conflict_status" text,
  "notes" text,
  "extras" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "confirmed_by" text,
  "confirmed_at" timestamptz,
  "last_checked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_entity_mappings_provider_type_ext_unique"
  ON "provider_entity_mappings" ("provider", "entity_type", "external_id");
CREATE INDEX IF NOT EXISTS "provider_entity_mappings_entity_local_idx"
  ON "provider_entity_mappings" ("entity_type", "rugby365_id", "provider");
CREATE INDEX IF NOT EXISTS "provider_entity_mappings_status_idx"
  ON "provider_entity_mappings" ("status");

CREATE TABLE IF NOT EXISTS "provider_raw_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL DEFAULT 'rugby_data',
  "endpoint" text NOT NULL,
  "entity_type" text,
  "external_id" text,
  "request_params" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "response_status" integer,
  "response_time_ms" integer,
  "retrieved_at" timestamptz NOT NULL DEFAULT now(),
  "payload_hash" text,
  "import_status" text NOT NULL DEFAULT 'captured',
  "error_message" text,
  "payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_raw_responses_provider_retrieved_idx"
  ON "provider_raw_responses" ("provider", "retrieved_at");
CREATE INDEX IF NOT EXISTS "provider_raw_responses_entity_ext_idx"
  ON "provider_raw_responses" ("entity_type", "external_id");
CREATE INDEX IF NOT EXISTS "provider_raw_responses_import_status_idx"
  ON "provider_raw_responses" ("import_status");

CREATE TABLE IF NOT EXISTS "data_integration_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "job_type" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'rugby_data',
  "status" text NOT NULL DEFAULT 'queued',
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "records_found" integer NOT NULL DEFAULT 0,
  "records_created" integer NOT NULL DEFAULT 0,
  "records_updated" integer NOT NULL DEFAULT 0,
  "records_skipped" integer NOT NULL DEFAULT 0,
  "conflicts" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "started_by" text NOT NULL DEFAULT 'system',
  "preview" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "report" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "data_integration_jobs_status_idx" ON "data_integration_jobs" ("status");
CREATE INDEX IF NOT EXISTS "data_integration_jobs_type_idx" ON "data_integration_jobs" ("job_type");
CREATE INDEX IF NOT EXISTS "data_integration_jobs_created_idx" ON "data_integration_jobs" ("created_at");

CREATE TABLE IF NOT EXISTS "data_integration_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "field" text NOT NULL,
  "primary_value" jsonb,
  "secondary_value" jsonb,
  "current_value" jsonb,
  "primary_provider" text NOT NULL DEFAULT 'rugby_data',
  "secondary_provider" text NOT NULL,
  "suggested_action" text NOT NULL DEFAULT 'keep_primary',
  "status" text NOT NULL DEFAULT 'open',
  "resolution" text,
  "resolved_by" text,
  "resolved_at" timestamptz,
  "job_id" uuid REFERENCES "data_integration_jobs"("id") ON DELETE SET NULL,
  "raw_response_id" uuid REFERENCES "provider_raw_responses"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "data_integration_conflicts_status_idx"
  ON "data_integration_conflicts" ("status");
CREATE INDEX IF NOT EXISTS "data_integration_conflicts_entity_idx"
  ON "data_integration_conflicts" ("entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "data_field_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "field" text NOT NULL DEFAULT '*',
  "locked_by" text NOT NULL DEFAULT 'system',
  "locked_at" timestamptz NOT NULL DEFAULT now(),
  "reason" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "data_field_locks_entity_field_unique"
  ON "data_field_locks" ("entity_type", "entity_id", "field");
CREATE INDEX IF NOT EXISTS "data_field_locks_entity_idx"
  ON "data_field_locks" ("entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "data_integration_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "field" text,
  "old_value" jsonb,
  "new_value" jsonb,
  "source" text,
  "action" text NOT NULL,
  "user_label" text NOT NULL DEFAULT 'system',
  "reason" text,
  "job_id" uuid REFERENCES "data_integration_jobs"("id") ON DELETE SET NULL,
  "raw_response_id" uuid REFERENCES "provider_raw_responses"("id") ON DELETE SET NULL,
  "mapping_id" uuid REFERENCES "provider_entity_mappings"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "data_integration_audit_log_entity_idx"
  ON "data_integration_audit_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "data_integration_audit_log_created_idx"
  ON "data_integration_audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "data_integration_audit_log_action_idx"
  ON "data_integration_audit_log" ("action");

CREATE TABLE IF NOT EXISTS "data_integration_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL DEFAULT 'rugby_data',
  "metric_date" date NOT NULL,
  "total_requests" integer NOT NULL DEFAULT 0,
  "successful_requests" integer NOT NULL DEFAULT 0,
  "failed_requests" integer NOT NULL DEFAULT 0,
  "total_response_time_ms" integer NOT NULL DEFAULT 0,
  "last_success_at" timestamptz,
  "last_failure_at" timestamptz,
  "last_error_message" text,
  "rate_limit_status" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "data_integration_metrics_provider_date_unique"
  ON "data_integration_metrics" ("provider", "metric_date");
