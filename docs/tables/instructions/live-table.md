# Live Table

Standard table type.

## Table name

Live Table

## Route

`/admin/tables/view?type=live-table`

Example with filters:

`/admin/tables/view?type=live-table&competitionId={uuid}&season=2025-26&venue=home&live=yes&scheduled=no&movement=yes`

## Purpose

Show the competition table as it stands right now, including live in-play matches. The table updates as scores change during matches.

## Core rule

At kick-off, every live match starts at **0–0** (treated as a draw until one team leads). As the score changes, standings update from the current scoreline.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All · Home · Away (default All)
- **Include live matches** (`live`): Yes · No (default Yes)
- **Include scheduled matches** (`scheduled`): Yes · No (default No)
- **Show movement** (`movement`): Yes · No (default Yes)

## Required data

### Minimum (Level 1)

- Fixtures, final scores for completed matches, current score for live matches, match status, home/away teams, competition, season, competition scoring rules

### Enhanced (Level 2+)

- Live tries, live bonus point status, match clock, match events — columns and bonus points appear only when underlying data exists (no guessing)

## Match status rules

| Status | Treatment |
|--------|-----------|
| Completed | Final score |
| Live | Current score (0–0 = draw) |
| Scheduled | Ignored by default |
| Postponed | Ignored |
| Abandoned | Ignored unless official result awarded |

## Movement

Compares live position with the **pre-match table** (completed fixtures only). Labels: Up · Down · Same (e.g. `3rd ↑ from 5th`).

## Columns

**Basic:** Live position, movement, team, played, won, drawn, lost, PF, PA, PD, league points

**Enhanced (when data exists):** TF, TA, TBP, LBP, bonus points

**Live-specific:** Live match, current score, match clock, live status

## Refresh

- SSE stream: `/api/admin/tables/live-table/stream?competitionId=…&seasonId=…`
- View page falls back to polling if SSE is unavailable

## UI note

*“Live table is calculated from completed matches plus current in-play scores.”*

## Tests

See `apps/web/src/lib/table-lab/live-table.test.ts`.

## Code

| Area | Path |
|------|------|
| Service | `apps/web/src/lib/table-lab/live-table-service.ts` |
| Calculation | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| SSE | `apps/web/src/app/api/admin/tables/live-table/stream/route.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
