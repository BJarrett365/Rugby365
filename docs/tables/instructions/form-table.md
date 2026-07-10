# Form Table

## Table name

Form Table

## Route

`/admin/tables/view?type=form-table`

Example:

`/admin/tables/view?type=form-table&season=2026-27&matches=5&venue=all`

## Purpose

Show the league table based only on each team’s **most recent completed matches** — a form-weighted standings view for momentum analysis.

## Filters

### Required

- **Competition**
- **Season**

### Match count

- Last 3
- Last 5
- Last 6
- Last 10
- Custom number (1–50)

### View

- All
- Home
- Away

### Defaults

- **Last 5** matches
- **View** = All

## Required data

- Fixtures
- Final scores
- Match date (kickoff)
- Home team, away team
- Competition
- Season
- Match status = completed
- Competition scoring rules
- Team match stats (optional — for TF / TA)

## Columns

| Column | Notes |
|--------|--------|
| Position | |
| Team | |
| Form | W / D / L sequence; **most recent result highlighted** |
| Played | Matches used in window (may be less than requested — show `*` when short) |
| Won | |
| Drawn | |
| Lost | |
| Points For | |
| Points Against | |
| Points Difference | |
| Tries For | TF — when data available |
| Tries Against | TA — when data available |
| Try Bonus Points | TBP — when rules/data support |
| Losing Bonus Points | LBP — when rules/data support |
| Bonus Points | |
| League Points | |

## Calculation rules

Build a new table using **only** the selected number of recent matches **per team**.

### Critical filter order

**Venue filter is applied before taking the last N matches.**

Example: Last 5 + Away → each team’s last five completed **away** matches.  
Do **not** take the last five overall matches and then remove home matches.

### Per team

1. Filter perspectives by view (All / Home / Away).
2. Sort by kickoff desc, then fixture ID desc.
3. Take the last N matches (or all available if fewer).
4. Aggregate stats and apply competition scoring rules to that subset only.

### Scoring

- Win, draw, try bonus and losing bonus use **competition-specific rules** (same as Full Table).
- Do not hard-code Premiership rules globally.

### Teams with fewer matches

- Include the team in the table.
- Show actual **matches used** vs **matches requested** (played column `*` + warning).

### Date handling

- Order by kickoff, then fixture ID.
- Postponed: ignore until completed.
- Abandoned: ignore unless official result awarded.

## Sorting

Same as Full Table:

1. League points
2. Wins
3. Points difference
4. Points for
5. Tries for
6. Team name

## UI notes

Show:

- Competition, season, last X matches, All / Home / Away
- Date range covered (from selected matches)
- Data coverage, last updated, calculation method
- Form column with most recent result first and visually distinct
- Export CSV
- Shareable URL (`type`, `season`, `matches`, `venue`, `competitionId`)

## Data confidence rules

| Level | When |
|-------|------|
| **High** | All teams have ≥ requested matches; tries and scores complete |
| **Medium** | Some teams short of requested window; partial try data |
| **Low** | Very few fixtures or many teams under-represented |
| **Unavailable** | No calculable rows |

Warn when one or more teams have fewer than the requested match count.

## Tests

File: `apps/web/src/lib/table-lab/form-table.test.ts`

- Route param `type=form-table`
- Custom match count parsing and bounds
- Last 3, 5, 6, 10 and custom counts
- All, home, away — venue filter **before** slice
- Away filter does not use overall-last-N then filter (regression)
- Match ordering: kickoff then fixture ID
- Form sequence most-recent-first (W/D/L)
- Teams with fewer matches than requested included with correct `matchesUsed`
- Competition-specific bonus points
- Sort order
- Date range label from selected matches
