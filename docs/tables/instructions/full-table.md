# Full Table

## Table name

Full Table

## Route

`/admin/tables/view?type=full-table`

Example with filters:

`/admin/tables/view?type=full-table&competitionId={uuid}&season=2025-26&venue=all`

## Purpose

Show the overall league table for the selected competition and season — the canonical standings view with wins, draws, losses, bonus points and league points.

Supports full-season tables plus **All**, **Home** and **Away** slices of the same fixture pool.

## Filters

### Required

- **Competition**
- **Season**

### Optional

- **View:** All · Home · Away

### Defaults

- **View** = All
- **Competition** = Premiership (when available in CMS)

## Required data

- Fixtures
- Final scores (home and away)
- Home team, away team
- Match status = completed
- Competition
- Season
- Competition scoring rules
- Standing rows (optional sync path — used when available for faster/high-confidence results)
- Team match stats (optional — for TF / TA when SDMS data exists)

## Columns

| Column | Code | Notes |
|--------|------|--------|
| Position | # | Rank after sort |
| Team | | Team name |
| Played | P | Completed matches in scope |
| Won | W | |
| Drawn | D | |
| Lost | L | |
| Points For | PF | |
| Points Against | PA | |
| Points Difference | PD | PF − PA |
| Tries For | TF | When try data available |
| Tries Against | TA | When try data available |
| Try Bonus Points | TBP | When rules/data support |
| Losing Bonus Points | LBP | When rules/data support |
| Bonus Points | BP | TBP + LBP |
| League Points | Pts | Competition table points |

## Calculation rules

1. Load completed fixtures for the selected competition and season.
2. Apply **View** filter:
   - **All** — every completed match for each team
   - **Home** — only matches where the team was home
   - **Away** — only matches where the team was away
3. Prefer synced `standing_rows` for the matching view when present and fixtures exist.
4. Otherwise aggregate per-team results from fixture perspectives.
5. Apply **competition-specific** scoring per match:
   - Win / draw / loss base points
   - Try bonus (threshold from competition rules)
   - Losing bonus (margin from competition rules)
6. Do **not** hard-code Premiership scoring globally.

### Date handling

- Order fixtures by kickoff, then fixture ID.
- Postponed: excluded until completed.
- Abandoned: excluded unless official result recorded.

## Sorting

Default order:

1. League points (desc)
2. Wins (desc)
3. Points difference (desc)
4. Points for (desc)
5. Tries for (desc)
6. Team name (asc)

## UI notes

Show:

- Competition, season, view (All / Home / Away)
- Filter summary, data coverage %, confidence
- Calculation method and required data (meta panel)
- Last updated (when season standings synced)
- Export CSV
- Shareable URL (`type`, `competitionId`, `season`, `venue` when not All)

TF, TA, TBP, and LBP columns appear only when the standing rows include non-null values for those fields (try stats from SDMS, or synced bonus breakdown). Competition rules alone do not show empty columns.

## Data confidence rules

| Level | When |
|-------|------|
| **High** | Synced standing rows used, or full fixture set with scores complete |
| **Medium** | Calculated from fixtures; some try stats missing |
| **Low** | Sparse fixtures or major gaps in scores |
| **Unavailable** | No completed fixtures in scope |

## Tests

File: `apps/web/src/lib/table-lab/full-table.test.ts`

- Route param `type=full-table` maps to `full_table`
- Competition-specific scoring rules (e.g. Top 14 try threshold, Six Nations no losing bonus)
- Try and losing bonus calculated separately
- All, home and away views produce correct played counts
- Sort order: league points, wins, PD, PF, tries, team name
- Only completed fixtures contribute to standings
