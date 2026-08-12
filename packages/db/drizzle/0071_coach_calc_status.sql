-- Coach calculated-data status for auto backfill / recalculation pipeline.
ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS calc_status text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS calc_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS calc_stale_reason text,
  ADD COLUMN IF NOT EXISTS calc_error text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS coaches_calc_status_idx ON coaches (calc_status);
