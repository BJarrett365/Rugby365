-- Match Centre was sequential-scanning ~136k match_events rows per page load
-- because fixture_id had no index. Index for Match Centre / animation / cron.
CREATE INDEX IF NOT EXISTS match_events_fixture_id_idx ON match_events (fixture_id);
CREATE INDEX IF NOT EXISTS match_events_fixture_sequence_idx ON match_events (fixture_id, sequence_no);

-- SDMS match centre lookup by external_match_id was also unindexed.
CREATE INDEX IF NOT EXISTS fixtures_external_match_id_idx ON fixtures (external_match_id);
