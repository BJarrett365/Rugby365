# Winning Bonus Points Table

## Table name

Winning Bonus Points Table

## Route

`/admin/tables/view?type=winning-bonus-points-table`

Example with filters:

`/admin/tables/view?type=winning-bonus-points-table&competitionId={uuid}&season=2025-26&venue=home&matchRange=5&bonusType=try_bonus&sortBy=maximum_point_wins`

## Purpose

Rank teams by try bonus points, losing bonus points, total bonus points and maximum-point wins using the selected competition’s scoring rules.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Match range** (`matchRange`): `all` (default), `3`, `5`, `10`, or a custom count
- **Bonus type** (`bonusType`): `all` (default), `try_bonus`, `losing_bonus`, `maximum_point_wins`
- **Sort by** (`sortBy`): `total_bonus_points` (default), `try_bonus_points`, `losing_bonus_points`, `maximum_point_wins`, `bonus_point_rate_pct`, `bonus_points_per_match`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Calculation

Uses competition scoring rules — never hard-codes one global bonus system.

For each team with qualifying match data:

- Try Bonus Points
- Losing Bonus Points
- Total Bonus Points
- Maximum-Point Wins (win plus every bonus point available to a winner)
- Bonus Point Matches and Bonus Point Rate %

Matches missing verified try data are excluded when try bonus rules require tries. Historic seasons without bonus points show as not applicable.

## Columns

Core: Position, Team, Played, Wins, Try Bonus Points, Losing Bonus Points, Total Bonus Points, Bonus Point Matches, Bonus Point Rate %

Betting / analysis: Maximum-Point Wins, Maximum-Point Win %, Try Bonus Points Per Match, Bonus Points Per Match

Enhanced: Home Bonus Points, Away Bonus Points, Current Bonus Point Streak, Longest Bonus Point Streak

## Match range rule

Last 5 away uses each team’s last five completed away matches — the same venue-first slicing rule as the Form Table.

## Sorting

Default: Total bonus points → try bonus points → maximum-point wins → bonus point rate % → team name

## UI notes

Shows competition, season, view, match range, bonus rule used, maximum points available, matches included, data coverage, and calculation method.
