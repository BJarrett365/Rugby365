# Final 20 Minutes Table

## Table name

Final 20 Minutes Table

## Route

`/admin/tables/view?type=final-20-minutes-table`

Example:

`/admin/tables/view?type=final-20-minutes-table&competitionId={uuid}&season=2025-26&venue=all&extraTime=no`

## Purpose

Build a league table using only performance from minute 60 to the end of the match (including added time; extra time excluded by default).

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All · Home · Away
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)
- **Include extra time** (`extraTime`): Yes · No (default No)

## Calculation

Score from **60:00 until full-time** is treated as the match result.

Example: score at 60 = 20–17, full-time 31–29 → final 20 = 11–12 (Exeter win).

### Data fallback priority

1. Verified scoring events from minute 60 onward
2. Verified score at 60 minutes plus full-time score (derived)
3. Unavailable — never estimate the 60-minute score from full-time alone

## Sorting

1. Table points
2. Wins
3. Points difference
4. Points for
5. Team name

## Columns

**Basic:** Position, Team, Played, Won, Drawn, Lost, F20 PF, F20 PA, F20 PD, Table Points

**Enhanced (when data exists):** TF, TA, TBP, LBP, Bonus Points

## UI note

*“This table treats points scored from 60 minutes to full-time as the result.”*

## Tests

See `apps/web/src/lib/table-lab/final-twenty-minutes-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/final-twenty-minutes-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
