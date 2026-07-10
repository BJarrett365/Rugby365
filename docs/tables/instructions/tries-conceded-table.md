# Tries Conceded Table

## Table name

Tries Conceded Table

## Route

`/admin/tables/view?type=tries-conceded-table`

Example with filters:

`/admin/tables/view?type=tries-conceded-table&competitionId={uuid}&season=2025-26&venue=away&matchRange=5&period=first_half&sortBy=three_plus_conceded_pct`

## Purpose

Rank teams by the number of tries they concede.

Useful for:

- Betting analysis
- Opposition try markets
- Defensive form
- Finding teams vulnerable to multiple tries
- Comparing defensive strength

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Period** (`period`): `full_match` (default), `first_half`, `second_half`, `final_20`
- **Match range** (`matchRange`): `all` (default), `3`, `5`, `10`, or a custom count
- **Sort by** (`sortBy`): `fewest_tries_conceded` (default), `lowest_tries_conceded_per_match`, `lowest_try_conceding_rate_pct`, `two_plus_conceded_pct`, `three_plus_conceded_pct`, `four_plus_conceded_pct`, `five_plus_conceded_pct`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Calculation

For each team with verified try data in scope:

- Matches played
- Total tries conceded
- Tries conceded per match
- Matches conceding a try / 2+ / 3+ / 4+ / 5+ tries
- Try conceding rate % = matches conceding a try ÷ matches played × 100

Missing try data is excluded rather than counted as zero. Full match can use team try totals; period views require timed try events.

## Columns

Core: Position, Team, Played, Tries Conceded, Tries Conceded Per Match, Matches Conceding A Try, Try Conceding Rate %

Betting: Conceded 2+ Tries, Conceded 3+ Tries, Conceded 4+ Tries, Conceded 5+ Tries

Enhanced: First-half tries conceded, Second-half tries conceded, Final 20 tries conceded

## Match range rule

Last 5 away uses each team’s last five completed away matches — the same venue-first slicing rule as the Form Table.

## Sorting

Default: Fewest tries conceded → tries conceded per match → try conceding rate % → team name

Betting sorts rank by highest 2+/3+/4+/5+ conceded %.

## UI notes

Shows competition, season, view, period, match range, matches included, try data coverage, and calculation method.
