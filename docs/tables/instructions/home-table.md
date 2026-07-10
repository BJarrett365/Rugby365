# Home Table

## Table name

Home Table

## Route

`/admin/tables/view?type=home-table`

Example with filters:

`/admin/tables/view?type=home-table&competitionId={uuid}&season=2025-26&dateFrom=2025-09-01&dateTo=2026-03-31&minMatches=3`

## Purpose

Show the league table using only **home matches** for the selected competition and season.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **Date range** (`dateFrom`, `dateTo`)
- **Minimum home matches played** (`minMatches`)

### Defaults

- All completed home matches in the season
- Minimum home matches = 1 (no floor)

## Required data

- Fixtures
- Final scores
- Home team, away team
- Competition, season
- Match status = completed
- Competition scoring rules
- Standing rows (optional sync path for home view)
- Team match stats (optional — for TF / TA when SDMS data exists)

## Columns

| Column | Code | Notes |
|--------|------|--------|
| Position | # | Rank after sort |
| Team | | Team name |
| Played | P | Home matches only |
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
| Home Win % | | Wins ÷ home matches played |

TF, TA, TBP, and LBP appear only when standing rows include non-null values for those fields.

## Calculation rules

1. Load completed fixtures for the selected competition and season.
2. Apply optional **date range** filter on kickoff.
3. Keep only perspectives where the team was **home**.
4. Prefer synced `standing_rows` home view when present; otherwise aggregate from fixture perspectives.
5. Apply **competition-specific** scoring per home match (win/draw/loss, try bonus, losing bonus).
6. Calculate **Home Win %** as `won / played × 100` (one decimal place).
7. Optionally exclude teams below the **minimum home matches** threshold and re-rank.
8. Sort by: league points → wins → points difference → points for → tries for → team name.

Ignore:

- Away matches
- Postponed / abandoned fixtures without an official completed result

## UI notes

Show competition, season, date range (when set), data coverage, calculation method, last updated.

Allow export CSV and shareable URL (query string sync).

## Tests

See `apps/web/src/lib/table-lab/home-table.test.ts`:

- Home matches only
- Away matches excluded
- Bonus points and points difference
- Sort order
- Team with no home matches omitted
- Minimum home matches filter
- Home win %

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/home-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
| Results panel | `apps/web/src/components/admin/TableLabPanels.tsx` |
