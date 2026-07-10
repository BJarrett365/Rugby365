# Second Half Table

## Table name

Second Half Table

## Route

`/admin/tables/view?type=second-half-table`

Example with filters:

`/admin/tables/view?type=second-half-table&competitionId={uuid}&season=2025-26&venue=away&minMatches=3`

## Purpose

Build a league table using only second-half scores. Shows which teams perform best after half-time.

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

- Completed fixtures, half-time scores, full-time scores, teams, competition, season

### Enhanced (Level 2)

- Second-half tries and bonus data — columns appear only when underlying data exists

## Calculation

Second-half score:

- Home second-half = full-time home − half-time home
- Away second-half = full-time away − half-time away

Treat the second-half score as the final result.

Example: HT 17–10, FT 31–29 → Northampton 14, Exeter 19 (Exeter win the second half).

## Data fallback

1. Derived from full-time minus verified/calculated half-time
2. Calculated from scoring events after minute 40
3. Unavailable — **never** guessed from full-time score alone

## Sorting

1. Table points
2. Wins
3. Second-half points difference
4. Second-half points for
5. Team name

## Columns

**Basic:** Position, Team, Played, Won, Drawn, Lost, SH PF, SH PA, SH PD, Table Points

**Enhanced (when data exists):** TF, TA, TBP, LBP, Bonus Points

## UI note

*“This table treats second-half scores as the result.”*

## Tests

See `apps/web/src/lib/table-lab/second-half-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/second-half-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
