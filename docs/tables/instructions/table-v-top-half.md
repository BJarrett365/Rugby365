# Table v Top Half

## Table name

Table v Top Half

## Route

`/admin/tables/view?type=table-v-top-half`

Example with filters:

`/admin/tables/view?type=table-v-top-half&competitionId={uuid}&season=2025-26&venue=home&oppositionRule=at_match&minMatches=3`

## Purpose

Show how teams perform against the strongest teams in the selected competition.

Useful for:

- Betting analysis
- Measuring performance against strong opposition
- Comparing title contenders
- Identifying teams that struggle against better sides

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Opposition position rule** (`oppositionRule`): `current` (default), `at_match`, `final`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

### Defaults

- View = All
- Opposition position rule = Current position
- Minimum matches = 1

## Top half definition

Top half uses ranks **1 through ceil(n / 2)** from one shared full-season reference table.

Examples:

- 10 teams → positions 1–5
- 11 teams → positions 1–6
- 12 teams → positions 1–6

## Calculation

1. Build the reference full table for the selected season.
2. Define one shared top-half group from that table (same for every team row).
3. Include only completed matches against top-half opponents using the selected opposition position rule.
4. Build a league table from those matches.

### Opposition position rules

| Rule | Meaning |
|------|---------|
| Current position | Opponent’s current rank in the season table |
| Position at time of match | Opponent’s rank immediately before kick-off |
| Final season position | Opponent’s final season rank (provisional if season incomplete) |

### Self-exclusion rule

A team’s own position does **not** change the top-half definition per row. One shared reference table and one shared top-half cutoff apply to the whole calculation.

## Required data

### Minimum (L1)

- Fixtures
- Final scores
- Home team, away team
- Competition, season
- Completed match status
- Full table calculation

### Enhanced (L2/L3)

- Tries and bonus points when present in SDMS
- Historic table positions for position-at-match rule

Missing try or bonus data is not guessed and is not treated as zero.

## Columns

### Basic

- Position, Team, Played, Won, Drawn, Lost, Win %, Points For, Points Against, Points Difference, Table Points

### Enhanced

- Tries For / Against, Try Bonus, Losing Bonus, Total Bonus (only when data exists)

## Table points

Standard rugby union scoring:

- Win = 4
- Draw = 2
- Loss = 0

Bonus points follow competition-specific rules when try data is available.

## Sorting

1. Total table points
2. Wins
3. Points difference
4. Points for
5. Win %
6. Team name

## UI notes

The results panel shows:

- Competition and season context
- Top half definition (e.g. 1st–5th)
- Opposition position rule
- View (All / Home / Away)
- Matches included
- Data coverage tier
- Calculation summary (e.g. “matches played against teams currently ranked 1st–5th”)

## Tests

Covered in `apps/web/src/lib/table-lab/v-top-half-table.test.ts`:

- Even and odd team counts
- Current, at-match, and final-season position rules
- Home and away views
- Shared top-half group (self-exclusion)
- Incomplete season provisional final positions
- Basic-only data fallback
- Bonus points when available
- Sort order and minimum matches filter
