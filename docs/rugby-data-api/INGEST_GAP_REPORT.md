# Rugby Data API — ingest gap report

Generated: 2026-07-28T09:41:57.757Z

## Pull vs ingest

| Layer | Count |
|-------|-------|
| Raw API responses in DB | 955 |
| Confirmed provider mappings | 24 |
| Fixtures with external match id | 690 |
| Fixture players | 0 |
| Rugby Data team match stats | 0 |
| Rugby Data player match stats | 0 |
| Rugby Data match events | 72 |

## Endpoints not fully ingested

### GET /countries/list
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Discovery reference only; countries are not CMS entities. Stored in provider_raw_responses for audit.

### GET /country/leagues
- **Disposition:** partial
- **Target tables:** data_integration_jobs
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. League catalog extracted to job preview; individual country rows are not persisted as entities.

### GET /news/leagues
- **Disposition:** partial
- **Target tables:** data_integration_jobs
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. League ids merged into discovery catalog only.

### GET /search
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Lookup helper; entity resolution uses league/team lists instead.

### GET /teams
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Global team directory is captured raw; structured import uses per-league /teams only.

### GET /matches
- **Disposition:** partial
- **Target tables:** fixtures, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Fixture rows created on date sweep; league metadata on each group is snapshot-only.

### GET /matches/count
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Operational counter; no CMS table for match counts by date.

### GET /league/:id/header
- **Disposition:** partial
- **Target tables:** competitions, competition_seasons, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Name and season label ingested; lid/category_id/slug/tabs stored only in raw payload.

### GET /league/:id/teams
- **Disposition:** partial
- **Target tables:** teams, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Team id and name ingested; slug and group label are raw-only.

### GET /league/:id/matches?match_type=finished
- **Disposition:** partial
- **Target tables:** fixtures, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Core fixture fields ingested; period scores and competitor form arrays are not.

### GET /league/:id/matches?match_type=fixtures
- **Disposition:** partial
- **Target tables:** fixtures, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Upcoming fixtures ingested; live minute/score refresh relies on day sync.

### GET /league/:id/table
- **Disposition:** partial
- **Target tables:** standing_rows
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Overall view only; PF/PA/bonus/home-away splits and pool groups are not ingested.

### GET /league/:id/news
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. News/articles are editorial content; no CMS news ingest pipeline for Rugby Data.

### GET /team/:id/header
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Team cn/gender/fid metadata captured raw; teams table filled from league lists.

### GET /team/:id/matches
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Redundant with league/date fixture sources; captured for audit only.

### GET /team/:id/news
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. No CMS news ingest from Rugby Data.

### GET /match/:id/detail
- **Disposition:** partial
- **Target tables:** fixtures
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. FT score/status/kickoff ingested; HT/ET/PS period scores not stored in dedicated columns.

### GET /match/:id/info
- **Disposition:** partial
- **Target tables:** match_events
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Scoring events ingested; SUB in/out player ids not linked; skipped when SDMS timeline exists.

### GET /match/:id/lineup
- **Disposition:** partial
- **Target tables:** fixture_players, players, provider_entity_mappings
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Squad list ingested; substitutions array and rugby_goals on lineup rows are not.

### GET /match/:id/stat
- **Disposition:** partial
- **Target tables:** team_match_stats
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Summary + sections jsonb ingested; turnovers_won not mapped from API.

### GET /match/:id/player-stat
- **Disposition:** partial
- **Target tables:** player_match_performance_stats, players
- **Why:** Some fields ingested; others remain in raw payload or extras jsonb only. Core columns + extras jsonb; several stat types remain in extras only.

### GET /match/:id/table
- **Disposition:** raw_only
- **Target tables:** none
- **Why:** Pulled into provider_raw_responses but no structured importer writes to CMS tables. Pool standings in match context not wired to standing_rows (league table used instead).

### POST /favourite
- **Disposition:** out_of_scope
- **Target tables:** none
- **Why:** Explicitly excluded from project scope (e.g. FCM favourites). FCM favourites are out of project scope.

### GET /get-favourites
- **Disposition:** out_of_scope
- **Target tables:** none
- **Why:** Explicitly excluded from project scope (e.g. FCM favourites). FCM favourites are out of project scope.

### GET /favourite/count
- **Disposition:** out_of_scope
- **Target tables:** none
- **Why:** Explicitly excluded from project scope (e.g. FCM favourites). FCM favourites are out of project scope.

### GET /my-matches
- **Disposition:** out_of_scope
- **Target tables:** none
- **Why:** Explicitly excluded from project scope (e.g. FCM favourites). Personal match lists require FCM token; out of scope.

## Fields not fully ingested

- **league-header** `lid, category_id, fid, lso, sg, tabs` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. No competition columns for provider secondary ids/slugs; kept in raw payload only.
- **league-teams** `teams[].sg, group label` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. Import uses name + external id; slug from API not written to teams.slug.
- **league-matches-finished** `ht, et, ps, aimId, competitors.htf/atf` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. No period-score columns on fixtures; form arrays have no target table.
- **league-table** `nrr, prem[], bonus points, home/away views` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. Importer writes overall view only; bonus columns often absent in API.
- **match-detail** `ht, et, ps` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. Period scores not modelled on fixtures table.
- **match-info** `SUB piId/poId/piNm/poNm` (partial)
  - Some fields ingested; others remain in raw payload or extras jsonb only. Substitution events created but in/out players not stored in payload or player_id FK.
- **match-info** `events[].sc` (partial)
  - Some fields ingested; others remain in raw payload or extras jsonb only. Score string stored in payload only, not parsed into fixture state.
- **match-lineup** `substitutions[], rugby_goals[], cards[]` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. Lineup importer reads lineup[] only; scoring on lineup rows not copied to fixture_players stats.
- **match-lineup** `pos` (partial)
  - Some fields ingested; others remain in raw payload or extras jsonb only. Often blank in API; position_name not derived from shirt number.
- **match-stat** `turnovers_won` (partial)
  - Some fields ingested; others remain in raw payload or extras jsonb only. Mapper hardcodes turnoversWon to 0.
- **match-player-stat** `Penalty goals, Missed goals, Passes, Offloads, Missed tackles, Kick fromhand metres, cards` (partial)
  - Some fields ingested; others remain in raw payload or extras jsonb only. Stored in extras jsonb; not all map to typed performance columns.
- **match-table** `pool table sc/cc/df/ded/wo_aet` (raw_only)
  - Pulled into provider_raw_responses but no structured importer writes to CMS tables. Match-level pool tables not imported (league /table used instead).
- **any** `venue, referee, coaches, attendance` (not_in_feed)
  - Data does not exist in Rugby Data API responses. Not present in Rugby Data API payloads; requires SDMS/Wikipedia/CMS.
- **any** `player DOB, nationality, height, weight, image, bio` (not_in_feed)
  - Data does not exist in Rugby Data API responses. Not in Rugby Data API; requires Wikipedia/RugbyPass/CMS.
- **any** `commentary, transfers, rankings, youtube` (not_in_feed)
  - Data does not exist in Rugby Data API responses. Outside Rugby Data API scope entirely.

## Disposition legend

- **ingested:** Fully mapped into CMS tables by the import/enrich pipeline.
- **partial:** Some fields ingested; others remain in raw payload or extras jsonb only.
- **raw_only:** Pulled into provider_raw_responses but no structured importer writes to CMS tables.
- **not_pulled:** Endpoint not yet called by pull/import jobs.
- **not_in_feed:** Data does not exist in Rugby Data API responses.
- **out_of_scope:** Explicitly excluded from project scope (e.g. FCM favourites).
- **blocked_by_policy:** Ingest blocked by mapping rules, field locks, or SDMS-primary policy.