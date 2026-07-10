# Points Gained From Losing Positions

## Table name

Points Gained From Losing Positions

## Route

`/admin/tables/view?type=points-gained-from-losing-positions`

Example with filters:

`/admin/tables/view?type=points-gained-from-losing-positions&competitionId={uuid}&season=2025-26&losingPosition=half_time&sortBy=comeback_win_pct`

## Purpose

Show how many table points teams recover after being behind at any stage of a match.

Useful for:

- Betting analysis
- In-play betting
- Measuring comeback ability
- Team resilience
- Identifying teams that recover from losing positions

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Losing position** (`losingPosition`): `any_time` (default), `half_time`, `after_sixty`
- **Sort by** (`sortBy`): `points_gained` (default), `comeback_wins`, `comeback_win_pct`, `avg_points_gained`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Core rule

A team enters a losing position whenever its score is lower than the opposition score. The team only needs to be behind once to qualify.

Baseline when behind is **0 table points**. Points gained equals the final competition table points earned from that match, including try and losing bonus where applicable.

Each match is counted once even if the team falls behind several times.

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

- Position, Team, Matches Behind, Comeback Wins, Comeback Draws, Comeback Losses With Bonus, Points Gained, Average Points Gained Per Match, Comeback Win %, Best Comeback Margin
- Enhanced: Try bonus points gained, Losing bonus points gained, Average minute first behind

## Sorting

Default:

1. Points gained
2. Comeback wins
3. Comeback win %
4. Average points gained per match
5. Team name

## Tests

Covered in:

- `apps/web/src/lib/table-lab/losing-position-utils.ts` (via `points-gained-losing-table.test.ts`)
- `apps/web/src/lib/table-lab/points-gained-losing-table.test.ts`
