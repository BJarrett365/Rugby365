# Comeback Table

## Table name

Comeback Table

## Route

`/admin/tables/view?type=comeback-table`

Example with filters:

`/admin/tables/view?type=comeback-table&competitionId={uuid}&season=2025-26&comebackFrom=half_time&minDeficit=7&sortBy=comeback_success_pct`

## Purpose

Rank teams by their ability to recover after falling behind.

This is different from Points Gained From Losing Positions: the Comeback Table focuses on the number and quality of successful comebacks (final wins or draws), not total table points from every match where a team trailed.

Useful for:

- Betting analysis
- In-play betting
- Team resilience
- Identifying teams that can recover from poor starts
- Measuring the scale of comebacks

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Comeback from** (`comebackFrom`): `any_time` (default), `half_time`, `after_sixty`
- **Minimum deficit** (`minDeficit`): `any` (default), `3`, `7`, `10`, `14`, `custom` with `minDeficitCustom`
- **Sort by** (`sortBy`): `comeback_wins` (default), `total_successful_comebacks`, `comeback_success_pct`, `largest_deficit_overcome`, `table_points_gained`, `final_20_comebacks`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Core rule

A successful comeback occurs when a team:

1. Is behind during the match.
2. Later recovers.
3. Finishes with a win or a draw.

Wins and draws are tracked separately. Losses after trailing count toward matches behind but not toward successful comebacks.

## Deficit rule

The largest deficit faced by the team is taken from verified score progression (for example 0–10 → 7–10 → 7–17 → 21–17 gives a largest deficit of 10 points on a comeback win).

## Required data

This table requires verified score progression. It cannot be inferred from final scores alone.

Minimum:

- Fixtures
- Final scores
- Match event timeline
- Score progression
- Home team, away team
- Competition, season
- Completed match status

Enhanced:

- Half-time score
- 60-minute score
- Tries and bonus points when present

## Columns

- Position, Team, Matches Behind, Comeback Wins, Comeback Draws, Total Successful Comebacks, Comeback Success %, Largest Deficit Overcome, Average Deficit Overcome, Table Points Gained
- Enhanced: Comebacks from 7+/10+/14+ behind, Second-half comebacks, Final 20 comebacks, Latest winning score minute

## Sorting

Default:

1. Comeback wins
2. Total successful comebacks
3. Comeback success %
4. Largest deficit overcome
5. Table points gained
6. Team name

## UI notes

The admin view shows competition, season, comeback-from filter, minimum deficit, All/Home/Away view, matches with score timeline data, data coverage, and a calculation summary.
