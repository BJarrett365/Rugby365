# Hemisphere Table

## Table name

Hemisphere Table

## Route

`/admin/tables/view?type=hemisphere-table`

Example:

`/admin/tables/view?type=hemisphere-table&mode=summary&matchType=international&venue=all`

## Purpose

Compare **Northern Hemisphere** teams against **Southern Hemisphere** teams for cross-hemisphere rugby analysis:

- Club v club
- Nation v nation
- European teams v southern teams
- International tours, World Cup-style competitions
- Champions Cup / invitational data where relevant

## Hemisphere rule

Every team must have an explicit **hemisphere** value in team admin.

| Value | Meaning |
|-------|---------|
| Northern Hemisphere | `northern` |
| Southern Hemisphere | `southern` |
| Unknown | `unknown` or not set |

**Do not guess silently.** Missing DB values are treated as Unknown and excluded unless **Include Unknown** is enabled.

Examples (editorial reference — set in admin, not inferred at runtime):

- **Northern:** England, France, Ireland, Scotland, Wales, Italy, Japan, USA, Canada, Georgia, Spain, Portugal, Premiership / Top 14 / URC European clubs
- **Southern:** New Zealand, South Africa, Australia, Argentina, Fiji, Samoa, Tonga, Super Rugby / Currie Cup / NPC teams

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **Date range** (`dateFrom`, `dateTo`)
- **Match type:** Club · International · All
- **View:** All · Home · Away · Neutral
- **Include Unknown:** Yes · No
- **Table mode:** Hemisphere summary · Team breakdown

### Defaults

- **View** = All
- **Include Unknown** = No
- **Table mode** = Hemisphere summary
- **Match type** = All

## Table modes

### 1. Hemisphere summary

**Rows:** Northern Hemisphere · Southern Hemisphere · Unknown (if enabled)

**Columns:** Played, Won, Drawn, Lost, PF, PA, PD, TF, TA, Win %, TBP, LBP, BP, League Points (TF/TA/TBP/LBP when data/rules support)

### 2. Team breakdown

**Rows:** One per team

**Columns:** Hemisphere, Played, Won, Drawn, Lost, PF, PA, PD, TF, TA, Win %, TBP, LBP, BP, League Points

## Required data

- Fixtures
- Final scores
- Home team, away team
- Match status = completed
- Competition, season
- **Team hemisphere value** (DB: `teams.hemisphere`)
- Neutral venue flag (`fixtures.is_neutral_venue` or provider snapshot), where available
- Tries for/against (SDMS team match stats), where available
- Competition scoring rules
- Team type (`teams.team_type`) for Club / International match-type filter

## Columns

See modes above. Win % = wins ÷ played × 100 (one decimal).

## Calculation rules

1. Load completed fixtures for competition + season; apply date range if set.
2. Resolve hemisphere from **team admin only** (no silent name-list guessing).
3. **Match inclusion:**
   - Default: both teams must have known hemisphere (northern or southern).
   - **Include Unknown = Yes:** matches with at least one known or unknown team per agreed rules.
4. **View filter** on team perspectives:
   - **All** — all completed matches
   - **Home** — team was home
   - **Away** — team was away
   - **Neutral** — `is_neutral_venue` true
5. **Match type:** filter by `teams.team_type` (club-like vs international).
6. For each included match, add stats to hemisphere summary and/or team row using competition scoring rules.
7. Northern v Northern and Southern v Southern matches still count toward each team’s / hemisphere’s totals.

## Sorting

### Hemisphere summary

1. Northern Hemisphere
2. Southern Hemisphere
3. Unknown (if enabled)

### Team breakdown

1. Win % (desc)
2. Wins (desc)
3. Points difference (desc)
4. Points for (desc)
5. Tries for (desc)
6. Team name (asc)

## UI notes

Show:

- Competition, season, date range, match type, view, mode
- Hemisphere rule explanation
- Unknown team count
- Data coverage, confidence, calculation method
- Warning e.g. *“3 teams are missing hemisphere values and are excluded from this table.”*
- Export CSV, shareable URL (`mode`, `matchType`, `venue`, `includeUnknown`, dates)

Admin: team edit must allow **Hemisphere**, **Country**, **Region**, **Team type** (Club, International, Franchise, Provincial, Academy, Other).

## Data confidence rules

| Level | When |
|-------|------|
| **High** | All teams have hemisphere values; scores complete |
| **Medium** | Some Unknown teams or missing tries |
| **Low** | Major hemisphere gaps or incomplete fixtures |
| **Unavailable** | No rows after filters |

## Tests

File: `apps/web/src/lib/table-lab/hemisphere-table.test.ts`

- Route param `type=hemisphere-table`
- Northern v Southern summary aggregation
- Northern v Northern and Southern v Southern team breakdown
- Unknown team excluded by default; included when flag on
- Warning text for missing hemisphere values
- Home, away, neutral view filters
- Hemisphere summary row order (N then S)
- Team breakdown sort (win %, wins, PD, …)
- Win percentage calculation
- Missing tries data (does not fail)
- Match type international filter

Related: `table-hemisphere.test.ts` (legacy Nations Championship pool split for enriched results on NC competitions).
