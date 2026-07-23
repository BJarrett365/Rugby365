# Public Player Profile

Public player pages present Rugby365 player data in Planet Rugby-style public chrome.

## Routes

- `/players` — Directory of all published players (search + pagination)
- `/players/[slug]` — Domestic profile (default)
- `/players/[slug]/international` — International profile
- `/players/[slug]/scouting` — Scouting profile
- `/sitemap-players.xml` — URL sitemap for published player profiles

Shared query params: `tab`, `season` (slug | `current` | `all`), `competition` (slug | `all`), `page`, `preview=1`.

## Charts

- **Performance radar** — position-percentile radar from `player_season_stats` (per 80 / rates). Same-position cohorts only (e.g. Premiership Locks, min minutes). Types: Overall DNA, Attack, Defence, Carrying, Set piece, Physical; Kicking/Discipline wait for source metrics. Compact on Overview; full on Stats (Position analysis) and Scouting. HTML metric table + structured summary. Cache: `player_radar_caches`. CMS: Public performance radar panel. Rebuild: `npx tsx scripts/rebuild-player-radar-caches.ts --season=2025-26`.
- **Development timeline** — match ratings over time with rolling average, optional season/career averages, annotations, filters, accessible table, and written summary. Compact sparkline on Overview; full chart on Stats and Career. CMS: Public development timeline panel on player edit.

## Rollout

All published players (`is_public` + `publish_status=published`) use the same public profile stack.

Bulk data job:

```bash
npx tsx scripts/rollout-public-player-profiles.ts
```

Attaches missing fixture seasons, rebuilds `player_season_stats` from match performance, and reports transfer conflict groups for CMS review.

Optional ratings pass for squad players missing a rating:

```bash
npx tsx scripts/batch-calculate-player-ratings.ts
```

## Rules

- Public URLs use stable unique slugs. Internal UUIDs stay private.
- Public pages are read-only. No edit buttons, admin IDs, source controls or audit notes.
- Use real Rugby365 data only. Missing values show as “—” — never invent zeros, fees or claims.
- Core facts must be in readable HTML for SEO and AI search (not chart-only).
- Appearances use `fixture_players.team_id` (team at the time). Current club never rewrites historic rows.
- Current competition is resolved from the current club’s latest domestic fixtures (e.g. Top 14 for La Rochelle), not from a selected Premiership season.
- When current club differs from latest recorded season club, show both.
- Season selectors use competition-season slugs; null fixture seasons are inferred from kickoff.
- Domestic and international totals stay separate by profile view.
- International caps prefer calculated fixture appearances; Wikipedia stints remain labelled separately.
- Transfers are deduplicated publicly when the same from→to movement appears multiple times; CMS shows a conflict warning.
- Only injuries/suspensions marked public + confirmed may appear publicly.
- Manual CMS overrides (intro, SEO, publish status) must not be silently replaced by imports.
- Preview (`?preview=1`) is `noindex,nofollow`.
- Match centre and public transfers link to `/players/{slug}`, not CMS edit URLs.

## Publish

A player is publicly visible when `is_public` is true and `publish_status` is `published`.
CMS “Preview public profile” opens `/players/{slug}?preview=1`.

## Sections

Overview, Stats, Matches, Events, Transfers, Injuries and Absences, International, News (stub until article links exist), Achievements, Career — with season/competition filters and profile-type switcher.

## Phases

- Phase 2–5 foundation (shipped): season/competition filters, three views, appearance-backed stats/matches/events, transfer dedupe, pitch + rating chart, international from fixtures, CMS transfer conflicts.
- Later: news link model, contract fields, per-view SEO publish rows, teammates/coaches/opponents deep graphs, full CMS season rebuild dry-run tooling.
