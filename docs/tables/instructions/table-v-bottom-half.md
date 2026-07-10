# Table v Bottom Half

## Table name

Table v Bottom Half

## Route

`/admin/tables/view?type=table-v-bottom-half`

Example with filters:

`/admin/tables/view?type=table-v-bottom-half&competitionId={uuid}&season=2025-26&venue=away&oppositionRule=final&minMatches=3`

## Purpose

Show how teams perform against teams in the bottom half of the selected competition.

Useful for:

- Betting analysis
- Finding teams that reliably beat weaker opposition
- Identifying teams that drop points against lower-ranked sides
- Comparing title and relegation form

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

## Bottom half definition

Uses the same split as Table v Top Half. Top half receives the extra team when `n` is odd.

Bottom half = ranks **(ceil(n/2) + 1) through n**.

Examples:

- 10 teams → positions 6–10
- 11 teams → top half 1–6, bottom half 7–11
- 12 teams → positions 7–12

## Calculation

1. Build the reference full table for the selected season.
2. Define one shared bottom-half group from that table.
3. Include only completed matches against bottom-half opponents using the selected opposition position rule.
4. Build a league table from those matches.

### Opposition position rules

| Rule | Meaning |
|------|---------|
| Current position | Opponent’s current rank in the season table |
| Position at time of match | Opponent’s rank immediately before kick-off |
| Final season position | Opponent’s final season rank (provisional if season incomplete) |

### Shared group rule

One shared bottom-half group applies to the whole calculation. A team’s own position does not redefine the group per row.

## Required data

### Minimum (L1)

- Fixtures, final scores, home/away teams, competition, season, completed status, full table calculation

### Enhanced (L2/L3)

- Tries, bonus points, historic table positions when available

Missing try or bonus data is not guessed and is not treated as zero.

## Columns

### Basic

Position, Team, Played, Won, Drawn, Lost, Win %, Points For, Points Against, Points Difference, Table Points

### Enhanced

Tries For / Against, Try Bonus, Losing Bonus, Total Bonus (only when data exists)

## Table points

- Win = 4, Draw = 2, Loss = 0
- Bonus points follow competition rules when try data exists

## Sorting

1. Total table points
2. Wins
3. Points difference
4. Points for
5. Win %
6. Team name

## UI notes

The results panel shows bottom-half definition (e.g. 6th–10th), opposition position rule, view, matches included, data coverage, and a calculation summary.

## Tests

Covered in `apps/web/src/lib/table-lab/v-bottom-half-table.test.ts`.
