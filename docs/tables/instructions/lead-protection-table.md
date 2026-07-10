# Lead Protection Table

## Table name

Lead Protection Table

## Route

`/admin/tables/view?type=lead-protection-table`

Example with filters:

`/admin/tables/view?type=lead-protection-table&competitionId={uuid}&season=2025-26&leadPosition=half_time&minLead=7&sortBy=most_wins_after_leading`

## Purpose

Rank teams by how well they protect a lead and close out matches.

This is the positive partner to Points Lost From Winning Positions and the Comeback Table.

Useful for:

- Betting analysis
- In-play betting
- Game management
- Identifying strong front-runners
- Measuring late-match control

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View** (`venue`): All, Home, Away
- **Lead position** (`leadPosition`): `any_time` (default), `half_time`, `after_sixty`
- **Minimum lead** (`minLead`): `any` (default), `3`, `7`, `10`, `14`, `custom` with `minLeadCustom`
- **Sort by** (`sortBy`): `lead_protection_pct` (default), `most_wins_after_leading`, `fewest_points_lost`, `fewest_losses_after_leading`, `largest_lead_lost`, `sixty_minute_lead_protection_pct`
- **Date range** (`dateFrom`, `dateTo`)
- **Minimum matches played** (`minMatches`)

## Core rule

A team qualifies when it holds a lead during the selected match period.

A lead is successfully protected when the team goes on to win the match.

Wins, draws and losses after leading are tracked separately.

## Lead Protection %

`Matches Won After Leading ÷ Matches Led × 100`

Example: 8 wins from 10 matches led = 80%.

## Minimum lead filter

Uses the largest lead held in the match (`maxLeadMargin`). A match with peaks of 3–0, 10–0 and 10–7 qualifies for 3+, 7+ and 10+ filters but not 14+.

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

- Position, Team, Matches Led, Wins After Leading, Draws After Leading, Losses After Leading, Lead Protection %, Points Lost, Average Largest Lead, Largest Lead Lost, Table Points Earned
- Enhanced: Half-time leads protected, 60-minute leads protected, Final 20 leads protected, Average minute first ahead, Average minute lead lost

## Sorting

Default:

1. Lead Protection %
2. Wins After Leading
3. Fewest Points Lost
4. Fewest Losses After Leading
5. Team name

## UI notes

The admin view shows competition, season, lead position, minimum lead, All/Home/Away view, matches with score timeline data, data coverage, and a calculation summary.
