# First Half Table

## Table name

First Half Table

## Route

`/admin/tables/view?type=first-half-table`

Example with filters:

`/admin/tables/view?type=first-half-table&competitionId={uuid}&season=2025-26&venue=home&minMatches=3`

## Purpose

Build a league table using only the score at half-time. Shows which teams perform best during the first half of matches.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All · Home · Away
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

### Defaults

- View = All
- Minimum matches = 1

## Required data

### Minimum (Level 1)

- Completed fixtures, half-time home/away scores (verified or calculated from events), teams, competition, season

### Enhanced (Level 2)

- First-half tries, first-half bonus point data — columns appear only when underlying data exists

## Data fallback priority

1. Verified half-time score (`half_time` match event)
2. Calculated from verified scoring events up to minute 40
3. Unavailable — **never** guessed from full-time scores

## Calculation

Treat the half-time score as the final result.

Example:

- Half-time: Northampton 17–10 Exeter
- Full-time: Northampton 31–29 Exeter
- First Half Table: Northampton win 17–10

League points use competition win/draw/loss rules (default 4/2/0). Try and losing bonus only when first-half try data exists.

## Sorting

1. Table points
2. Wins
3. First-half points difference
4. First-half points for
5. Team name

## Columns

**Basic:** Position, Team, Played, Won, Drawn, Lost, FH PF, FH PA, FH PD, Table Points

**Enhanced (when data exists):** TF, TA, TBP, LBP, Bonus Points

## UI

Shows competition, season, view, date range, data coverage label, and calculation note:

*“This table treats the half-time score as the final result.”*

Coverage example:

*“First-half data available for 82 of 90 matches — 91% coverage.”*

## Tests

See `apps/web/src/lib/table-lab/first-half-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/first-half-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
