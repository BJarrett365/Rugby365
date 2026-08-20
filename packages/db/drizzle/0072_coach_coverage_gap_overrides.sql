-- Coach CMS coverage gap editorial overrides (ignore / mark unavailable).
alter table coaches
  add column if not exists coverage_gap_overrides jsonb not null default '{}'::jsonb;
