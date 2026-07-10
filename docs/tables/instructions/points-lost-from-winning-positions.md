# Points Lost From Winning Positions

## Table name

Points Lost From Winning Positions

## Route

`/admin/tables/view?type=points-lost-from-winning-positions`

Example with filters:

`/admin/tables/view?type=points-lost-from-winning-positions&competitionId={uuid}&season=2025-26&winningPosition=after_sixty&sortBy=lead_protection_pct`

## Purpose

Show how many table points teams lose after being ahead at any stage of a match.

Useful for:

- Betting analysis
- In-play betting
- Measuring lead protection
- Finding teams that struggle to close out matches
- Identifying late collapses

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Winning position** (`winningPosition`): `any_time` (default), `half_time`, `after_sixty`
- **Sort by** (`sortBy`): `points_lost` (default), `fewest_points_lost`, `losses_after_leading`, `draws_after_leading`, `lead_protection_pct`, `most_wins_after_leading`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Core rule

A team enters a winning position whenever its score is higher than the opposition score. The team only needs to lead once to qualify.

Expected baseline when ahead is the win base (`4` in standard rugby union rules). Points lost compares that baseline with the final competition table points actually earned. Wins after leading score `0` points lost. The table never invents an expected try bonus.

Each match is counted once even if the team leads several times.

## Required data

This table requires verified score progression. It cannot be inferred from final scores alone.

## Columns

- Position, Team, Matches Led, Wins, Draws After Leading, Losses After Leading, Points Lost, Average Points Lost Per Match, Lead Protection %, Matches Won After Leading %
- Enhanced: Losing bonus recovered, average minute first ahead, average minute lead lost, latest lead lost, largest lead lost

## Sorting

Default:

1. Points lost (highest first)
2. Losses after leading
3. Draws after leading
4. Lowest lead protection %
5. Team name

## Tests

Covered in:

- `apps/web/src/lib/table-lab/losing-position-utils.ts` (via `points-lost-winning-table.test.ts`)
- `apps/web/src/lib/table-lab/points-lost-winning-table.test.ts`
