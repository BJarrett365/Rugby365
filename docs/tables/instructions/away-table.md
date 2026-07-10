# Away Table

## Table name

Away Table

## Route

`/admin/tables/view?type=away-table`

Example with filters:

`/admin/tables/view?type=away-table&competitionId={uuid}&season=2025-26&dateFrom=2025-09-01&dateTo=2026-03-31&minMatches=3`

## Purpose

Show the league table using only **away matches** for the selected competition and season.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **Date range** (`dateFrom`, `dateTo`)
- **Minimum away matches played** (`minMatches`)

### Defaults

- All completed away matches in the season
- Minimum away matches = 1 (no floor)
- Neutral-venue away matches **excluded**

## Required data

- Fixtures
- Final scores
- Home team, away team
- Competition, season
- Match status = completed
- Competition scoring rules
- Standing rows (optional sync path for away view)
- Team match stats (optional — for TF / TA when SDMS data exists)

## Columns

| Column | Code | Notes |
|--------|------|--------|
| Position | # | Rank after sort |
| Team | | Team name |
| Played | P | Away matches only |
| Won | W | |
| Drawn | D | |
| Lost | L | |
| Points For | PF | |
| Points Against | PA | |
| Points Difference | PD | PF − PA |
| Tries For | TF | When try data available |
| Tries Against | TA | When try data available |
| Try Bonus Points | TBP | When try data and rules support |
| Losing Bonus Points | LBP | When rules/data support |
| Bonus Points | BP | TBP + LBP |
| League Points | Pts | Competition table points |
| Away Win % | | Wins ÷ away matches played |

TF, TA, TBP, and LBP appear only when standing rows include non-null values for those fields.

## Calculation rules

1. Load completed fixtures for the selected competition and season.
2. Apply optional **date range** filter on kickoff.
3. Keep only perspectives where the team was **away**.
4. **Exclude neutral-venue away matches** by default (`isNeutralVenue === true`). A future competition rule may set `includeNeutralVenueForAwayTable` to include them.
5. Prefer synced `standing_rows` away view when present; otherwise aggregate from fixture perspectives.
6. Apply **competition-specific** scoring per away match.
7. Calculate **Away Win %** as `won / played × 100` (one decimal place).
8. Optionally exclude teams below the **minimum away matches** threshold and re-rank.
9. Sort by: league points → wins → points difference → points for → tries for → team name.

Ignore:

- Home matches
- Postponed / abandoned fixtures without an official completed result

## UI notes

Show competition, season, date range (when set), data coverage, calculation method, last updated.

Allow export CSV and shareable URL (query string sync).

## Tests

See `apps/web/src/lib/table-lab/away-table.test.ts`:

- Away matches only
- Home matches excluded
- Neutral venue handling (excluded by default, optional include)
- Bonus points and points difference
- Sort order
- Team with no away matches omitted
- Minimum away matches filter
- Away win %

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/away-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
| Results panel | `apps/web/src/components/admin/TableLabPanels.tsx` |
