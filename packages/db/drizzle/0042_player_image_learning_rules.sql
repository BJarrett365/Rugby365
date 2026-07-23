-- Learning proposals derived from editor-rejected Planet Rugby images.
-- Never auto-apply: status must be approved before scoring uses the rule.
CREATE TABLE IF NOT EXISTS "player_image_learning_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_key" text NOT NULL,
  "kind" text NOT NULL,
  "pattern" text NOT NULL,
  "penalty" integer NOT NULL DEFAULT 25,
  "scope" text NOT NULL DEFAULT 'global',
  "player_id" uuid REFERENCES "players"("id") ON DELETE CASCADE,
  "source_image_id" uuid REFERENCES "player_images"("id") ON DELETE SET NULL,
  "rationale" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "source_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "reviewed_at" timestamptz,
  "reviewed_by" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_image_learning_rules_rule_key_unique"
  ON "player_image_learning_rules" ("rule_key");

CREATE INDEX IF NOT EXISTS "player_image_learning_rules_status_idx"
  ON "player_image_learning_rules" ("status");
