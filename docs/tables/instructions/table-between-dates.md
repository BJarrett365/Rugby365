# Table Between Two Dates

## Table name

Table Between Two Dates

## Route

`/admin/tables/view?type=table-between-dates`

Example:

`/admin/tables/view?type=table-between-dates&competitionId={uuid}&dateFrom=2026-01-01&dateTo=2026-03-31&venue=all`

## Purpose

Build a competition table using only **completed matches** played between two selected dates (inclusive).

## Filters

### Required

- **Competition**
- **Start date** (`dateFrom`)
- **End date** (`dateTo`)

### Optional

- **Season** — narrows fixtures before the date filter
- **View** (`venue`): All · Home · Away
- **Minimum matches played** (`minMatches`)

### Defaults

- View = All
- Start/end default to 1 January – today when the table type is first selected

## Calculation rules

1. Load completed fixtures for the competition (optionally one season).
2. Keep matches with completion date **on or after** start date and **on or before** end date (kickoff used when completion timestamp is unavailable).
3. Apply All / Home / Away view.
4. Apply competition scoring rules (season-specific for Premiership when a season is selected).
5. Optionally filter teams below minimum matches and re-rank.
6. Sort: league points → wins → points difference → points for → tries for → team name.

Start date must not be after end date.

## Data fallback

Basic table always when results exist; try/bonus columns only when underlying data is present.

## UI

Shows date range, optional seasons included, match count, data coverage note, and calculation note. Export CSV and shareable URL supported.

## Tests

See `apps/web/src/lib/table-lab/between-dates-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/between-dates-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
