# Calendar Year Table

## Table name

Calendar Year Table

## Route

`/admin/tables/view?type=calendar-year-table`

Example with filters:

`/admin/tables/view?type=calendar-year-table&competitionId={uuid}&year=2026&venue=home&minMatches=3`

## Purpose

Show a league table based only on **completed matches** with kickoff between 1 January and 31 December of the selected calendar year.

## Filters

### Required

- **Competition**
- **Calendar year** (`year`)

### Optional

- **Season** — narrows the fixture pool before the calendar-year filter; leave empty to include all competition fixtures that fall in the year (can cross two rugby seasons)
- **View** (`venue`): All · Home · Away
- **Minimum matches played** (`minMatches`)

### Defaults

- Current calendar year
- View = All
- Minimum matches = 1

## Required data

### Minimum (Level 1)

- Fixtures, final scores, match date, home/away teams, competition, completed status

### Enhanced (Level 2)

- Competition scoring rules, tries for/against, bonus points — columns appear only when underlying data exists

## Columns

Basic: Position, Team, Played, Won, Drawn, Lost, PF, PA, PD, League Points

Enhanced (when data exists): TF, TA, TBP, LBP, Bonus Points

## Calculation rules

1. Load completed fixtures for the competition (optionally one season).
2. Keep matches with kickoff from **1 January [year] 00:00 UTC** through **31 December [year] 23:59 UTC**.
3. Apply **All / Home / Away** view.
4. Aggregate league standings with competition-specific scoring.
5. Optionally exclude teams below the minimum matches threshold and re-rank.
6. Sort: league points → wins → points difference → points for → tries for → team name.

## UI

Shows calendar year, competition, seasons included, match count, data coverage note, and calculation note:

*“This table uses matches played between 1 January 2026 and 31 December 2026.”*

## Tests

See `apps/web/src/lib/table-lab/calendar-year-table.test.ts`:

- Single calendar year filter
- Year crossing two rugby seasons
- Home and away views
- Enhanced column fallback
- Sort order

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/calendar-year-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
