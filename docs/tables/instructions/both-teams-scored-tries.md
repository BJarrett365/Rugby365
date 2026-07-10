# Both Teams Scored Tries

## Table name

Both Teams Scored Tries

## Route

`/admin/tables/view?type=both-teams-scored-tries`

Example with filters:

`/admin/tables/view?type=both-teams-scored-tries&competitionId={uuid}&season=2025-26&venue=away&matchRange=5&sortBy=both_teams_3_plus_pct`

## Purpose

Rank teams by how often both teams score at least one try in their matches — the rugby equivalent of football’s Both Teams To Score table.

Useful for:

- Betting analysis
- Try markets
- Finding open matches
- Comparing attacking and defensive patterns

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Match range** (`matchRange`): `all` (default), `3`, `5`, `10`, or a custom count
- **Sort by** (`sortBy`): `yes_pct` (default), `no_pct`, `both_teams_2_plus_pct`, `both_teams_3_plus_pct`, `both_teams_4_plus_pct`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Core rule

A match qualifies as **Yes** when both teams score at least one try (`triesFor ≥ 1` and `triesAgainst ≥ 1` from the team’s perspective). Examples: 3–2 = Yes, 1–1 = Yes, 4–0 = No, 0–2 = No, 0–0 = No.

Uses tries, not total match points. Missing try data is excluded rather than counted as zero.

## Calculation

For each team with verified try totals in scope:

- Matches played
- Yes / No counts
- Yes % and No %
- Both teams 2+ / 3+ / 4+ tries (count and %)

## Columns

Core: Position, Team, Played, Yes, No, Yes %, No %

Betting: Both Teams 2+ Tries, Both Teams 2+ Tries %, Both Teams 3+ Tries, Both Teams 3+ Tries %, Both Teams 4+ Tries, Both Teams 4+ Tries %

## Match range rule

Last 5 away uses each team’s last five completed away matches — the same venue-first slicing rule as the Form Table.

## Sorting

Default: Yes % → Yes matches → Both Teams 2+ Tries % → team name

## UI notes

Shows competition, season, view, match range, matches included, try data coverage, and calculation method.
