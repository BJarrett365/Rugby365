# Table On This Date

## Table name

Table On This Date

## Route

`/admin/tables/view?type=table-on-this-date`

Example:

`/admin/tables/view?type=table-on-this-date&competitionId={uuid}&season=2025-26&date=2026-01-07&venue=all`

## Purpose

Rebuild the competition table exactly as it stood on a selected date.

## Filters

### Required

- **Competition**
- **Season**
- **Date** (`date`, ISO `YYYY-MM-DD`)

### Optional

- **View** (`venue`): All · Home · Away

### Defaults

- View = All
- Date = today

## Required data

### Minimum (Level 1)

Fixtures, final scores, match date, teams, competition, season, completed status

### Enhanced (Level 2)

Competition scoring rules, tries, bonus points, Premiership points deductions (when effective dates are configured)

## Calculation rules

1. Load completed fixtures for the selected competition and season.
2. Keep matches with completion on or before the selected date (end of day UTC). Kickoff date is used when no completion timestamp exists in SDMS.
3. Apply All / Home / Away view.
4. Apply **season-specific** scoring rules (Premiership historic rules by season start year).
5. Apply Premiership deductions only when `effectiveFrom` is on or before the as-of date.
6. Sort: league points → wins → points difference → points for → tries for → team name.

Postponed and future fixtures are excluded (only completed matches are loaded).

## Historical accuracy

- Tables are always labelled **Calculated** (built from match results).
- Deductions without a confirmed effective date are flagged in warnings.
- Do not apply later deductions to earlier as-of dates when `effectiveFrom` is set.

## UI

Shows competition, season, as-of date, matches included, data coverage, calculation note, and Calculated/Official status.

Navigation: date picker, Previous day, Today, Next day, Export CSV, shareable URL.

## Tests

See `apps/web/src/lib/table-lab/on-this-date-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/on-this-date-table-service.ts` |
| Deductions | `apps/web/src/lib/table-lab/premiership-season-scoring.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
