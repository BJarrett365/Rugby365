# Table Lab — permanent instructions (Rugby365)

Table Lab is the rugby-specific analytics layer in Rugby365 CMS. It builds league and performance tables from imported fixtures, scores, events and SDMS team stats — with explicit confidence, coverage and warnings when data is missing.

**This folder is the source of truth for table behaviour.** Agreed rules must be written here before implementation. Do not rely on chat notes or ad-hoc specs.

## Where to look

| Document | Purpose |
|----------|---------|
| [TABLE_LAB_INDEX.md](./TABLE_LAB_INDEX.md) | Master index of all table types by category |
| [instructions/](./instructions/) | Per-table instruction files (route, filters, calculation, tests) |

## CMS entry points

| Area | Route |
|------|--------|
| Table Lab hub | `/admin/tables` |
| View tables | `/admin/tables/view` |
| Table index (UI) | `/admin/tables/index` |
| Guide (UI) | `/admin/tables/guide` |
| Build table | `/admin/tables/build` |
| Edit definitions | `/admin/tables/edit` |

## Instruction file template

Each table with agreed behaviour gets a file at:

`docs/tables/instructions/<table-id>.md`

Use kebab-case slugs matching the view URL `type` param (e.g. `full-table.md` for `type=full-table`).

Every instruction file **must** include these sections:

1. **Table name**
2. **Route**
3. **Purpose**
4. **Filters** (required, optional, defaults)
5. **Required data**
6. **Columns**
7. **Calculation rules**
8. **Sorting**
9. **UI notes**
10. **Data confidence rules**
11. **Tests**

## Global rules (all tables)

### Data honesty

- Never invent or silently guess missing values.
- Show confidence (`high` / `medium` / `low` / `unavailable`) and coverage %.
- Surface warnings when **minimum** required inputs are incomplete — not when optional enhanced or advanced data is missing.

### Data level fallback

Every table definition declares three tiers:

| Tier | Purpose | Typical sources |
|------|---------|-----------------|
| **Minimum (Level 1)** | Basic results table | Fixtures, final scores, teams, competition, season |
| **Enhanced (Level 2)** | Rugby scoring columns | Try stats, bonus points, competition scoring rules |
| **Advanced (Level 3)** | Detailed match stats | Carries, tackles, possession, lineouts, discipline events |

Rules:

- Build the **best possible table** from available data.
- If only Level 1 data exists, show a clean basic table (P, W, D, L, PF, PA, PD, Pts).
- Add try/bonus columns only when Level 2 data exists — never show them as zero when missing.
- Enable advanced table types only when their minimum tier is satisfied.
- Distinguish **true zero** (collected, value is 0), **missing** (not collected), and **not applicable** (competition/season did not use the metric).
- A useful basic table is always better than no table.

The view shows a short **data coverage note** (e.g. “Basic results data available for all 24 seasons. Detailed try data available from 2008/09.”) without cluttering the table.

Implementation: `table-lab-data-levels.ts`, `table-confidence-service.ts`, `table-definition-service.ts` (`minimumData` / `enhancedData` / `advancedData` on each definition).

### Completed fixtures only

- Include matches with status = completed (or equivalent full-time result).
- **Postponed:** ignore until completed.
- **Abandoned:** ignore unless the competition has awarded an official result.

### Match ordering

When selecting recent or ordered matches:

1. Actual kickoff date/time
2. Fixture ID as stable tiebreaker

### Competition scoring

- League points, try bonus and losing bonus use **competition-specific rules** (`competition_scoring_rules`).
- Do not hard-code Premiership rules globally.

### Optional columns (TF, TA, TBP, LBP)

When try stats or bonus breakdown data exists in the standing rows, show:

- **TF** — Tries for (requires SDMS try stats on at least one match)  
- **TA** — Tries against (same source as TF)  
- **TBP** — Try bonus points (requires try stats plus competition try-bonus rules, or synced breakdown)  
- **LBP** — Losing bonus points (requires competition losing-bonus rules and completed matches, or synced breakdown)  

Hide these columns when the underlying fields are `null` on all rows. Competition rules alone do not surface empty columns.

### Shareable URLs

View tables sync filter state to the query string where supported, e.g.:

`/admin/tables/view?type=full-table&competitionId=…&season=2025-26&venue=all`

### Code locations

| Area | Path |
|------|------|
| Table definitions | `apps/web/src/lib/table-lab/table-definition-service.ts` |
| Calculation engine | `apps/web/src/lib/table-lab/table-calculation-service.ts` |
| View UI | `apps/web/src/app/admin/tables/view/page.tsx` |
| Results panels | `apps/web/src/components/admin/TableLabPanels.tsx` |
| Unit tests | `apps/web/src/lib/table-lab/*.test.ts` |

## Documented tables (instruction files)

| Table | Instruction file | Implementation |
|-------|------------------|----------------|
| Full Table | [instructions/full-table.md](./instructions/full-table.md) | Live |
| Live Table | [instructions/live-table.md](./instructions/live-table.md) | Live |
| Form Table | [instructions/form-table.md](./instructions/form-table.md) | Live |
| Home Table | [instructions/home-table.md](./instructions/home-table.md) | Live |
| Away Table | [instructions/away-table.md](./instructions/away-table.md) | Live |
| All-Time Premiership | [instructions/all-time-premiership.md](./instructions/all-time-premiership.md) | Live |
| Calendar Year Table | [instructions/calendar-year-table.md](./instructions/calendar-year-table.md) | Live |
| Table On This Date | [instructions/table-on-this-date.md](./instructions/table-on-this-date.md) | Live |
| Table Between Two Dates | [instructions/table-between-dates.md](./instructions/table-between-dates.md) | Live |
| Hemisphere Table | [instructions/hemisphere-table.md](./instructions/hemisphere-table.md) | Live |
| First Half Table | [instructions/first-half-table.md](./instructions/first-half-table.md) | Live |
| Second Half Table | [instructions/second-half-table.md](./instructions/second-half-table.md) | Live |
| Final 20 Minutes Table | [instructions/final-20-minutes-table.md](./instructions/final-20-minutes-table.md) | Live |

All other types are listed in [TABLE_LAB_INDEX.md](./TABLE_LAB_INDEX.md) as **planned** until an instruction file is added.

## Workflow

1. Agree behaviour with product/editorial.
2. Add or update the instruction file in `docs/tables/instructions/`.
3. Update [TABLE_LAB_INDEX.md](./TABLE_LAB_INDEX.md) status.
4. Implement in `table-calculation-service` and UI.
5. Add unit tests matching the **Tests** section of the instruction file.
6. Run `npm run typecheck` and table-lab tests before merge.

## Related product docs

When table behaviour affects public-facing copy, also check:

- `app/product/page.tsx` (if in racing365-social monorepo)
- Admin reports pages per workspace governance rules
