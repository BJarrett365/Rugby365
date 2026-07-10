# Table When Conceding First

## Table name

Table When Conceding First

## Route

`/admin/tables/view?type=table-when-conceding-first`

Example with filters:

`/admin/tables/view?type=table-when-conceding-first&competitionId={uuid}&season=2025-26&firstScoreType=try&sortBy=comeback_win_pct`

## Purpose

Show how teams perform after conceding the first points of a match.

Useful for:

- Betting analysis
- Comeback strength
- Team resilience
- In-play betting
- Finding teams that recover well after falling behind

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **First score conceded type** (`firstScoreType`): `any` (default), `try`, `penalty`, `drop_goal`
- **Sort by** (`sortBy`): `league_points` (default), `comeback_wins`, `comeback_win_pct`, `points_gained_after_conceding_first`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## First conceded rule

A team qualifies when the opposition scores the first points of the match.

Qualifying opening scores:

- Try
- Penalty try
- Penalty goal
- Drop goal

Conversions do **not** count as the opening score because they follow a try.

The team that scored first is not included in this table for that match.

## Required data

This table requires verified scoring event order. It cannot be inferred from final scores alone.

Minimum:

- Fixtures
- Final scores
- Match events
- Scoring event order
- Home team, away team
- Competition, season
- Completed match status

Enhanced:

- Exact scoring minute
- Score type
- Tries and bonus points when present

## Calculation

1. Identify the first scoring event from the verified event timeline.
2. Identify the team that conceded.
3. Include the match only for that team.
4. Use the final match result for W/D/L, points and bonus.

0–0 matches are excluded. Fixtures with ambiguous opening-score order are excluded and reported in warnings.

## Columns

### Basic

- Position, Team, Matches Conceding First, Won, Drawn, Lost, Win %, Points For, Points Against, Points Difference, Table Points

### Betting / analysis

- Comeback wins
- Comeback win %
- Points gained after conceding first
- Average first conceded minute
- Matches conceding first %

### Enhanced

- Try / penalty / drop-goal first-conceded counts when available
- Try bonus, losing bonus and total bonus when try data exists

## Sorting

Default:

1. Total table points
2. Comeback win %
3. Wins
4. Points difference
5. Team name

Optional betting sorts: Comeback wins, Comeback win %, Points gained after conceding first.

## Tests

Covered in:

- `apps/web/src/lib/table-lab/first-score-utils.ts` (via `scoring-first-table.test.ts`)
- `apps/web/src/lib/table-lab/conceding-first-table.test.ts`
