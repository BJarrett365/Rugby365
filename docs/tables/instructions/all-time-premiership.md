# All-Time Premiership Rugby Table

## Table name

All-Time Premiership Rugby Table

## Route

`/admin/tables/view?type=all-time-premiership`

Example:

`/admin/tables/view?type=all-time-premiership&venue=all&seasonRange=custom&seasonFrom=2010&seasonTo=2020&teamStatus=current&sortBy=league_points`

## Purpose

Cumulative Premiership Rugby standings across every imported season in Rugby365, using canonical club identity and per-season scoring rules.

## Filters

### Season range

- **All seasons** (default)
- **From season** (`seasonRange=from&seasonFrom=YYYY`)
- **To season** (`seasonRange=to&seasonTo=YYYY`)
- **Custom range** (`seasonRange=custom&seasonFrom=YYYY&seasonTo=YYYY`)

### View

- **All** · **Home** · **Away** (`venue` query param)

### Team status

- **All teams** (default)
- **Current teams** — clubs appearing in the current domestic season window
- **Former teams** — clubs not in the current season window

### Sort by

`league_points` (default), `seasons`, `played`, `won`, `win_pct`, `points_for`, `tries_for`, `team_name`

## Team identity

- Uses `PREMIERSHIP_TEAM_ALIASES` and `canonicalPremiershipTeamName()` for sponsored / historic name variants.
- Aggregates by canonical club key — does not split simple sponsor or branding renames.
- Separate clubs (e.g. London Irish, Wasps) are not auto-merged.
- Unmapped clubs are flagged for editor review in warnings.

## Required data

- Completed Premiership fixtures
- Competition seasons
- Final scores, home/away teams
- Canonical team IDs / slugs
- Team aliases (transfer import config)
- Per-season scoring rules (see `premiership-season-scoring.ts`)
- Tries and bonus breakdown when available (optional columns)

## Columns

Position, Team, Seasons, Played, W, D, L, Win %, PF, PA, PD, TF, TA, TBP, LBP, BP, League Points (TF/TA/TBP/LBP when data exists).

## Calculation

1. Load all completed Premiership fixtures from CMS.
2. Resolve kickoff → season start year.
3. Apply season range, view (all/home/away), and team status filters.
4. Map each team row to a canonical club key.
5. Score each match with **that season’s** rules (pre-1997, 1997–2000, 2001+ bonus era).
6. Apply configured points deductions per club/season.
7. Report separate **results / tries / bonus** coverage percentages.
8. Sort by selected column (default: league points → wins → PD → PF → win % → team name).

Missing tries or bonus data are **not** treated as zero in coverage or optional columns.

## UI

Shows seasons included, team/match counts, split data coverage, historic scoring notice, last updated. Export CSV and shareable URL supported.

## Tests

`apps/web/src/lib/table-lab/all-time-premiership.test.ts`

## Code

| Area | Path |
|------|------|
| Service | `all-time-premiership-service.ts` |
| Team identity | `premiership-team-identity.ts` |
| Season scoring | `premiership-season-scoring.ts` |
| Calculation | `table-calculation-service.ts` |
