# Table When Scoring First

## Table name

Table When Scoring First

## Route

`/admin/tables/view?type=table-when-scoring-first`

Example with filters:

`/admin/tables/view?type=table-when-scoring-first&competitionId={uuid}&season=2025-26&firstScoreType=try&sortBy=win_pct`

## Purpose

Show how teams perform in matches where they score the first points.

Useful for:

- Betting analysis
- Lead protection
- Match control
- Identifying strong front-runners
- Finding teams that often convert an early lead into a win

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **First score type** (`firstScoreType`): `any` (default), `try`, `penalty`, `drop_goal`
- **Sort by** (`sortBy`): `league_points` (default), `win_pct`, `lead_converted_win_pct`, `matches_scoring_first_pct`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## First score rule

A team qualifies when it scores the first points of the match.

Qualifying opening scores:

- Try
- Penalty try
- Penalty goal
- Drop goal

Conversions do **not** count as the opening score because they follow a try.

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
2. Identify the team that scored.
3. Include the match only for that team.
4. Use the final match result for W/D/L, points and bonus.

0–0 matches are excluded. Fixtures with ambiguous opening-score order are excluded and reported in warnings.

## Columns

### Basic

- Position, Team, Matches Scoring First, Won, Drawn, Lost, Win %, Points For, Points Against, Points Difference, Table Points

### Betting / analysis

- Average first score minute
- Lead converted into win %
- Matches scoring first %
- Average winning margin

### Enhanced

- Try / penalty / drop-goal first-score counts when available
- Try bonus, losing bonus and total bonus when try data exists

## Sorting

Default:

1. Total table points
2. Win %
3. Wins
4. Points difference
5. Team name

Optional betting sorts: Win %, Lead converted into win %, Matches scoring first %.

## Tests

Covered in:

- `apps/web/src/lib/table-lab/first-score-utils.ts` (via `scoring-first-table.test.ts`)
- `apps/web/src/lib/table-lab/scoring-first-table.test.ts`
