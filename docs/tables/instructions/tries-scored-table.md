# Tries Scored Table

## Table name

Tries Scored Table

## Route

`/admin/tables/view?type=tries-scored-table`

Example with filters:

`/admin/tables/view?type=tries-scored-table&competitionId={uuid}&season=2025-26&venue=away&matchRange=5&period=first_half&sortBy=three_plus_tries_pct`

## Purpose

Rank teams by the number of tries they score.

Useful for:

- Betting analysis
- Try markets
- Attacking form
- Comparing attacking teams
- Finding consistent try scorers

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Period** (`period`): `full_match` (default), `first_half`, `second_half`, `final_20`
- **Match range** (`matchRange`): `all` (default), `3`, `5`, `10`, or a custom count
- **Sort by** (`sortBy`): `tries_scored` (default), `tries_per_match`, `try_scoring_rate_pct`, `two_plus_tries_pct`, `three_plus_tries_pct`, `four_plus_tries_pct`, `five_plus_tries_pct`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Calculation

For each team with verified try data in scope:

- Matches played
- Total tries scored
- Tries per match
- Matches with a try / 2+ / 3+ / 4+ / 5+ tries
- Try scoring rate % = matches with a try ÷ matches played × 100

Missing try data is excluded rather than counted as zero. Full match can use team try totals; period views require timed try events.

## Columns

Core: Position, Team, Played, Tries Scored, Tries Per Match, Matches With A Try, Try Scoring Rate %

Betting: 2+ Tries, 3+ Tries, 4+ Tries, 5+ Tries

Enhanced: First-half tries, Second-half tries, Final 20 tries, Try bonus points (competition rules)

## Match range rule

Last 5 away uses each team’s last five completed away matches — the same venue-first slicing rule as the Form Table.

## Sorting

Default: Tries scored → tries per match → try scoring rate % → team name

## UI notes

Shows competition, season, view, period, match range, matches included, try data coverage, and calculation method.
