-- Central change events + affected-entity recalculation queue.
-- Live and historical backfill both emit events; consumers mark entities STALE.

create table if not exists data_change_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  fixture_id uuid references fixtures(id) on delete set null,
  entity_type text,
  entity_id uuid,
  source text not null default 'system',
  import_method text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
--> statement-breakpoint
create index if not exists data_change_events_created_idx
  on data_change_events (created_at desc);
--> statement-breakpoint
create index if not exists data_change_events_fixture_idx
  on data_change_events (fixture_id, created_at desc)
  where fixture_id is not null;
--> statement-breakpoint
create index if not exists data_change_events_unprocessed_idx
  on data_change_events (created_at)
  where processed_at is null;
--> statement-breakpoint
create table if not exists entity_recalc_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  status text not null default 'stale',
  reason text,
  priority integer not null default 50,
  last_event_id uuid references data_change_events(id) on delete set null,
  coverage jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  calculated_at timestamptz
);
--> statement-breakpoint
create unique index if not exists entity_recalc_queue_entity_unique
  on entity_recalc_queue (entity_type, entity_id);
--> statement-breakpoint
create index if not exists entity_recalc_queue_status_priority_idx
  on entity_recalc_queue (status, priority, updated_at);
