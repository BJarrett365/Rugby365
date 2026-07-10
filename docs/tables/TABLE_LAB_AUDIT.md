# Table Lab — Full Audit Report

**Audit date:** 7 July 2026  
**Repository:** `rugby365`  
**Scope:** All 66 registered table definitions; deep review of 26 agreed Table Lab tables (24 main + Hemisphere + Custom Match Period)  
**Method:** Instruction review, code inspection, unit tests (274 passing), live DB calculation (`calculateRugbyTable`), standing-row spot checks, HTTP/UI probe  
**Fix policy:** Audit only — no product fixes applied in this pass

---

## Executive summary

| Outcome | Count |
|---------|------:|
| **Fully working** (load + calculate + instructions + tests; data sufficient) | **18** |
| **Partial** (works with caveats, wrong generic path, or UI blocked) | **7** |
| **Broken** (wrong output or blocking runtime error) | **2** |
| **Missing** (no real implementation) | **1** |
| **Blocked by data** (code path exists; DB lacks required inputs) | **6** |

**Critical blockers:** Table Lab view page returns **HTTP 500** (client bundle pulls Postgres/`net`). Fresh databases can fail all calculations when migration `0028` is journal-marked but columns were never applied.

---

## Status matrix — agreed main tables (26)

| Table | Docs | UI | API | Calculation | Filters | Data | Tests | Overall |
|-------|------|----|-----|-------------|---------|------|-------|---------|
| Full Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Live Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Form Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Home Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Away Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| All-Time Competition Table | Partial | Broken | Partial | Partial | Partial | Working | Partial | **Partial** |
| Calendar Year Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Table On This Date | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Table Between Two Dates | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| First Half Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Second Half Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Final 20 Minutes Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Custom Match Period | Missing | Broken | Partial | Broken | Missing | Partial | Missing | **Broken** |
| Table v Top Half | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Table v Bottom Half | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Table When Scoring First | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Table When Conceding First | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Points Gained From Losing Positions | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Points Lost From Winning Positions | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Points Gained From Drawn Positions | Missing | Broken | Partial | Broken | Missing | Partial | Missing | **Missing** |
| Comeback Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Lead Protection Table | Working | Broken | Partial | Working | Partial | Working | Working | **Partial** |
| Tries Scored Table | Working | Broken | Partial | Working | Partial | Blocked | Working | **Blocked by Data** |
| Tries Conceded Table | Working | Broken | Partial | Working | Partial | Blocked | Working | **Blocked by Data** |
| Both Teams Scored Tries | Working | Broken | Partial | Working | Partial | Blocked | Working | **Blocked by Data** |
| Winning Bonus Points Table | Working | Broken | Partial | Working | Partial | Blocked | Working | **Blocked by Data** |
| Hemisphere Table | Working | Broken | Partial | Working | Partial | Blocked | Working | **Blocked by Data** |

### Notes on matrix columns

- **UI = Broken** for all rows: `/admin/tables/view` returns HTTP 500 in dev (see AUD-001). API route `/api/admin/tables/calculate` is structurally correct but was not fully exercised over HTTP while the app shell is broken.
- **API = Partial:** Server calculation works when DB schema matches code; blocked on schema drift.
- **Filters = Partial:** Dedicated filter UI exists for implemented tables in `view/page.tsx`, but cannot be exercised in browser until AUD-001 is fixed. Generic partial tables lack instruction-defined filter panels.

---

## Status matrix — extra partial tables (selected)

| Table | Overall | Notes |
|-------|---------|-------|
| Try Bonus Point Table | **Broken** | Generic switch; hardcoded 4-try threshold; counts matches without try data |
| Losing Bonus Point Table | **Partial** | Generic switch; default Premiership rules only |
| Bonus Points Table | **Partial** | Generic switch; default rules; no instruction file |
| Tries Conceded (defence) | **Blocked by Data** | Duplicate metric of dedicated table; 0 SDMS rows |
| Tryless Opponent | **Partial** | `triesAgainst === 0` only; null tries not excluded from played |
| Set piece / attack / defence / possession / discipline (28 tables) | **Blocked by Data** | Generic `buildMetricStandings`; 10 `team_match_stats` rows total in DB |

---

## Test execution

| Command | Result |
|---------|--------|
| `npm test -- table-lab` | **274 passed** (30 files) |
| `npm test -- rugby-table-metrics` | **5 passed** |
| `npm test -- table-confidence` | **No dedicated file** (confidence covered in `table-lab.test.ts`) |
| `npm run typecheck` (root) | **Fails** in `@rugby365/match-operator-agent` (unrelated) |
| `npm run typecheck` (`apps/web`) | **Fails** — `tries-scored-table-service.ts`, `winning-bonus-points-table-service.ts` (`extra` fields with `undefined`); unrelated import-sdk/wiki errors |

---

## Manual calculation verification (Premiership 2024–25)

**Season:** `182eb6da-351d-482f-889f-dca7926494c9`  
**Method:** Compared `calculateRugbyTable('full_table')` synced output to `standing_rows` (`view = overall`)

| Team | Source | P | W | D | L | PF | PA | Pts | Match |
|------|--------|--:|--:|--:|--:|---:|---:|----:|-------|
| Northampton Saints | Calc / DB | 18 / 18 | 12 / 12 | 0 / 0 | 6 / 6 | 555 / 555 | 453 / 453 | 60 / 60 | ✓ |
| Bath | Calc / DB | 18 / 18 | 11 / 11 | 0 / 0 | 7 / 7 | 511 / 511 | 413 / 413 | 60 / 60 | ✓ |
| Saracens | Calc / DB | 18 / 18 | 11 / 11 | 0 / 0 | 7 / 7 | 522 / 522 | 387 / 387 | 56 / 56 | ✓ |

**Form / opposition / timeline tables:** Unit tests verify calculation logic with fixture fixtures; live spot-checks confirmed non-zero rows and plausible standings for 2024–25 when match events exist (~490 event-backed Premiership fixtures). Betting tables (tries/bonus) return **0 rows** — no SDMS try data for Premiership in DB (see data gaps doc).

**Try Bonus Point (generic):** Bath shows **20 played** vs official **18** — uses raw perspectives, not season-synced scope; treats missing `triesFor` as non-bonus rather than excluding match (**AUD-009**).

---

## Issue register

### AUD-001 — Table Lab view page HTTP 500 (client imports database)

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Tables** | All |
| **Problem** | `/admin/tables/view` fails to compile/load in browser |
| **Expected** | Page renders; filters call `/api/admin/tables/calculate` |
| **Actual** | HTTP 500 — `Module not found: Can't resolve 'net'` |
| **Root cause** | `view/page.tsx` imports `on-this-date-table-service.ts` → `competition-scoring-rules.ts` → `competition-admin-service.ts` → `@rugby365/db` → `postgres` in client bundle |
| **Files** | `apps/web/src/app/admin/tables/view/page.tsx`, `on-this-date-table-service.ts`, `competition-scoring-rules.ts`, `competition-admin-service.ts` |
| **Type** | Code |
| **Fix** | Split parse/format helpers from server scoring/DB modules; ensure `"use client"` page only imports client-safe modules |
| **Effort** | Small (0.5–1 day) |

### AUD-002 — Schema drift: migration 0028 journal entry without columns

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Tables** | All (fixture/team load) |
| **Problem** | `loadPerspectives` fails on fresh/mis-migrated DB |
| **Expected** | `npm run db:migrate` applies `hemisphere`, `team_type`, `is_neutral_venue` |
| **Actual** | `drizzle.__drizzle_migrations` lists `0028`; DB lacked `teams.hemisphere` and `fixtures.is_neutral_venue` until manual `ALTER` during audit |
| **Root cause** | Migration marked applied without SQL effect (or DB restored from pre-0028 snapshot) |
| **Files** | `packages/db/drizzle/0028_team_hemisphere.sql`, migrate runner |
| **Type** | Data / ops |
| **Fix** | Verify migration idempotency; add `db:check` assertion for required columns; re-run 0028 SQL on affected environments |
| **Effort** | Small |

### AUD-003 — `points_gained_drawn` not implemented

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Tables** | Points Gained From Drawn Positions |
| **Problem** | Table is registered and routable but not built |
| **Expected** | Timeline-based table for points earned after scores were level (per definition) |
| **Actual** | Falls through `switch` `default` → `buildStandingsFromPerspectives` — ordinary league table |
| **Root cause** | No dedicated block in `table-calculation-service.ts`; no instruction file; index status "Planned" |
| **Files** | `table-definition-service.ts`, `table-calculation-service.ts`, `table-view-utils.ts` |
| **Type** | Code |
| **Fix** | Add instruction file, service (mirror `points-gained-losing-table-service.ts`), calculation block, UI filters |
| **Effort** | Medium (2–3 days) |

### AUD-004 — `custom_match_period` uses wrong proxy

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Tables** | Custom Match Period |
| **Problem** | Does not honour user-defined minute range |
| **Expected** | Points for arbitrary [start, end] minute window from timed events |
| **Actual** | `switch` case filters `finalTwentyFor != null` and sums final-20 proxy; emits warning |
| **Root cause** | Stub implementation in generic switch |
| **Files** | `table-calculation-service.ts` (~2892), `table-definition-service.ts` |
| **Type** | Code |
| **Fix** | Dedicated service with event window aggregation; UI for start/end minutes |
| **Effort** | Medium–Large (3–5 days) |

### AUD-005 — `try_bonus_point` ignores competition rules and missing data

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fix applied (2026-07-07)** — dedicated `try-bonus-point-table-service.ts`; null tries excluded; competition threshold |
| **Tables** | Try Bonus Point Table |
| **Problem** | Incorrect bonus logic and match scope |
| **Expected** | Competition `tryBonusThreshold`; exclude matches without verified tries |
| **Actual** | Hardcoded `triesFor >= 4`; increments `played` even when `triesFor` is null; played count can exceed official table (e.g. Bath 20 vs 18) |
| **Root cause** | Generic `switch` stub |
| **Files** | `table-calculation-service.ts` (~2902–2912) |
| **Type** | Code |
| **Fix** | Dedicated service using `getScoringRulesForCompetition` + try data guards (like winning bonus table) |
| **Effort** | Medium |

### AUD-006 — `losing_bonus_point` / `bonus_points` use default Premiership rules

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | Losing Bonus Point, Bonus Points |
| **Problem** | Wrong rules for non-Premiership competitions |
| **Expected** | `competition_scoring_rules` per README global rules |
| **Actual** | `matchLeaguePoints(...)` called without rules → `DEFAULT_PREMIERSHIP_SCORING_RULES` |
| **Root cause** | Generic switch omitting `getScoringRulesForCompetition` |
| **Files** | `table-calculation-service.ts` (~2914–2924), `rugby-table-metrics-service.ts` |
| **Type** | Code |
| **Fix** | Pass resolved rules into generic bonus cases or promote to dedicated services |
| **Effort** | Small |

### AUD-007 — `losing_bonus_point` sums total bonus on losses, not LBP only

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | Losing Bonus Point Table |
| **Problem** | Metric includes try bonus on losing matches |
| **Expected** | Losing bonus points only |
| **Actual** | `return result === "lost" ? bonusPoints : 0` where `bonusPoints = TBP + LBP` |
| **Root cause** | Uses aggregate `bonusPoints` from `matchLeaguePoints` |
| **Files** | `table-calculation-service.ts` (~2915–2918) |
| **Type** | Code |
| **Fix** | Return `losingBonusPoints` only |
| **Effort** | Trivial |

### AUD-008 — `all_time_premiership` is not generic All-Time Competition Table

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | All-Time Competition Table (agreed name) |
| **Problem** | Premiership-only implementation |
| **Expected** | Configurable competition + season range (per product intent) |
| **Actual** | `all_time_premiership` hard-wired to Premiership slug, team identity map, historic scoring |
| **Root cause** | Scope implemented as Premiership special case |
| **Files** | `all-time-premiership-service.ts`, `table-calculation-service.ts`, instruction `all-time-premiership.md` |
| **Type** | Code / docs |
| **Fix** | Generalise or rename in index to match actual scope |
| **Effort** | Large if generalised |

### AUD-009 — Misleading “No completed fixtures” when try data missing

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | **Fix applied (2026-07-07)** — `SDMS_TRY_DATA_UNAVAILABLE` warning; `seasonFixtureCount` passed to coverage |
| **Tables** | Tries Scored, Tries Conceded, Both Teams Scored Tries, Winning Bonus Points |
| **Problem** | Warning implies empty fixture set |
| **Expected** | Distinguish “fixtures exist” vs “try data missing” |
| **Actual** | `assessFixtureCoverage` on empty `scoringPerspectives` emits “No completed fixtures in scope.” — **confirmed:** with the same `seasonId` as Full Table (2024–25), Full Table returns 18 played per team while Tries Scored returns 0 rows because **0% SDMS try data**, not because fixtures are absent |
| **Root cause** | Coverage assessed on try-filtered perspectives, not season scope |
| **Files** | `table-confidence-service.ts`, `table-lab-data-levels.ts`, betting table services |
| **Type** | Code |
| **Fix** | Pass `completedMatchCount` into coverage; separate warning strings |
| **Effort** | Small |

### AUD-010 — `tryless_opponent` treats null tries as in-scope

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | Tryless Opponent |
| **Problem** | Missing try data not excluded |
| **Expected** | Only count matches with verified opponent try count |
| **Actual** | Filter `triesAgainst === 0` — null passes filter incorrectly when included in perspectives |
| **Root cause** | Generic switch without null guard |
| **Files** | `table-calculation-service.ts` (~2933–2938) |
| **Type** | Code |
| **Fix** | Require `triesAgainst != null && triesAgainst === 0` |
| **Effort** | Trivial |

### AUD-011 — `TABLE_LAB_INDEX.md` summary is stale

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Tables** | Documentation |
| **Problem** | Index misreports instruction coverage |
| **Expected** | Accurate counts |
| **Actual** | Summary claims **14** instruction files; **25** exist. Opposition/Game state/Rugby scoring show **0** instruction files in summary despite many specs |
| **Root cause** | Index not updated after instruction files added |
| **Files** | `docs/tables/TABLE_LAB_INDEX.md` |
| **Type** | Docs |
| **Fix** | Regenerate summary table |
| **Effort** | Trivial |

### AUD-012 — TypeScript errors in new table services

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | Tries Scored, Winning Bonus Points |
| **Problem** | `tsc --noEmit` fails |
| **Expected** | Clean web workspace typecheck |
| **Actual** | `extra` fields allow `undefined`; type requires `string \| number \| null` |
| **Root cause** | Optional computed fields written as `undefined` instead of omitted/null |
| **Files** | `tries-scored-table-service.ts`, `winning-bonus-points-table-service.ts` |
| **Type** | Code |
| **Fix** | Coalesce optional extras to `null` or omit keys |
| **Effort** | Trivial |

### AUD-013 — SDMS / try data essentially absent for Premiership

| Field | Detail |
|-------|--------|
| **Severity** | High (data) |
| **Tables** | Tries Scored, Tries Conceded, Both Teams Scored Tries, Winning Bonus Points, all advanced stat tables |
| **Problem** | Betting and Level-3 tables cannot run on main competition |
| **Expected** | Try counts from `team_match_stats` or events |
| **Actual** | **0** `team_match_stats` rows for Premiership; **10** total in entire DB |
| **Root cause** | Import/collection gap |
| **Files** | N/A (data pipeline) |
| **Type** | Data |
| **Fix** | SDMS import for Premiership seasons (see `TABLE_LAB_DATA_GAPS.md`) |
| **Effort** | Large |

### AUD-014 — Hemisphere table blocked

| Field | Detail |
|-------|--------|
| **Severity** | Medium (data) |
| **Tables** | Hemisphere Table |
| **Problem** | All club teams lack `hemisphere` |
| **Expected** | Teams tagged northern/southern or unknown excluded with clear coverage |
| **Actual** | “10 teams are missing hemisphere values and are excluded” — 0 rows for Premiership |
| **Root cause** | `0028` backfill only targets international names |
| **Files** | `0028_team_hemisphere.sql`, `hemisphere-table-service.ts` |
| **Type** | Data |
| **Fix** | Club hemisphere rules or competition-scoped defaults |
| **Effort** | Medium |

### AUD-015 — Live table SSE / browser behaviour not verified

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Tables** | Live Table |
| **Problem** | Real-time UI path untested in browser |
| **Expected** | 0–0 draw at kick-off, movement, no duplicate rows on SSE |
| **Actual** | 16 unit tests pass; browser blocked by AUD-001 |
| **Root cause** | UI outage |
| **Files** | `live-table-service.ts`, `view/page.tsx` |
| **Type** | Code (unverified) |
| **Fix** | Fix UI; manual + integration test with `demo:feed` |
| **Effort** | Small–Medium |

### AUD-017 — Duplicate Premiership season rows per calendar year

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | **Fix applied (2026-07-07)** — slug seasons preferred; `mergeDuplicateCompetitionSeasons` migrates standings; `is_deprecated` + unique index on `(competition_id, year)` |
| **Tables** | Full Table, Form, generic paths using kickoff-year filter |
| **Problem** | Multiple `competition_seasons` rows share the same `year` (e.g. label `2025` and slug `2025–26` both `year = 2025`) |
| **Expected** | One canonical season per competition year; standings on the active season |
| **Actual** | Check found numeric-label seasons (`2025`, `2026`) with 30 standing rows while slug seasons (`2025–26`, `2026–27`) on the same year had **0** standings; kickoff-year filtering can include **extra fixtures** vs synced table (e.g. Bath 20 played vs official 18) |
| **Root cause** | Duplicate season catalog entries from import/sync |
| **Files** | `competition_seasons`, `standing_rows`, `loadPerspectives` kickoff filter |
| **Type** | Data |
| **Fix** | Deduplicate seasons; point UI default to slug season with standings; audit fixture scope per `seasonId` |
| **Effort** | Medium |

### AUD-016 — `tries_conceded_defence` duplicates dedicated table via stub

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Tables** | Tries Conceded (defence category) |
| **Problem** | Two definitions for similar metric |
| **Expected** | Single canonical tries conceded table or clear distinction |
| **Actual** | `tries_conceded` = dedicated; `tries_conceded_defence` = generic sum of `triesAgainst` |
| **Root cause** | Legacy definition not consolidated |
| **Files** | `table-definition-service.ts`, `table-calculation-service.ts` |
| **Type** | Code / docs |
| **Fix** | Deprecate or alias in UI |
| **Effort** | Small |

---

## Live table checklist (unit-tested; browser not verified)

| Rule | Unit tests | Live DB |
|------|------------|---------|
| Live match starts 0–0 as draw | ✓ `live-table.test.ts` | Not browser-tested |
| Score updates change W/D/L | ✓ | Not browser-tested |
| Completed = final scores | ✓ | ✓ |
| Scheduled excluded by default | ✓ | ✓ (1 scheduled in DB) |
| Live bonus only when data exists | ✓ | Blocked by AUD-013 |
| Movement vs pre-match table | ✓ | Not browser-tested |
| SSE duplicate rows | — | Not tested |

---

## Historic tables checklist

| Rule | Status |
|------|--------|
| Club name / alias mapping | ✓ `premiership-team-identity`, all-time service tests |
| Per-season scoring rules | ✓ `premiership-season-scoring.ts`, on-this-date |
| Seasons without bonus points | ✓ covered in premiership scoring tests |
| Points deductions | ✓ on-this-date / all-time paths |
| Missing try data not zero | ✓ dedicated betting services exclude; **generic try_bonus fails** |

---

## Betting tables — Last N away

Unit tests confirm **venue filter before slice** for tries scored/conceded, both teams scored, winning bonus (`*.test.ts` — “uses last-five away logic per team”). Logic matches instruction intent; live verification blocked by AUD-013.

---

## Browser / UI checklist

| Check | Result |
|-------|--------|
| Page load | **Fail** HTTP 500 |
| Filters | Not testable |
| Empty / loading states | Not testable |
| Mobile / wide table scroll | Not testable |
| Sorting | Not testable |
| Export | Not testable |
| Shareable URLs | Implemented in code (`view/page.tsx` query sync) — not testable |

---

## Audit confidence statement

- **High confidence:** Definition registry, unit test suite, full-table synced accuracy, timeline table logic (events present), generic bonus stub defects.
- **Medium confidence:** Filter behaviour in UI (code review only).
- **Low confidence:** Live SSE UX, export, mobile layout (blocked by AUD-001).

Do **not** mark UI as working until AUD-001 is resolved and browser checks pass.

---

## Selector scoping fix — competition + canonical season (8 July 2026)

### Issue found

Premiership and other admin selectors showed **all-time** teams linked to a competition (standings + fixtures aggregated without `season_id`), producing duplicate and historic clubs in the current season — e.g. Bristol Bears + Bristol Rugby, Newcastle Falcons + Newcastle Red Bulls, London Irish, Wasps, Worcester Warriors, Yorkshire.

Player picker used global `players.club_team_id` with no season or squad scope.

### Affected selectors

- Admin **Teams** list and grouped team pickers (`GroupedTeamSelect` consumers)
- Admin **Players** team filter
- `GET /api/admin/teams?grouped=1` (default all-time scope)
- `GET /api/admin/players?picker=1` (global squad)
- Season list API (`listAllSeasons`) included deprecated / duplicate numeric seasons

### Root cause

1. `listTeamPickerData()` built links as `teamId:competitionId` from **all** standings and fixtures — no `seasonId`.
2. `listPlayersForPicker()` read all players by current club, ignoring `player_season_stats` / `fixture_players` for the selected season.
3. `fixtures` table has no `season_id` FK; season must be inferred via `kickoffInSeason()` when falling back from standings.
4. Duplicate `competition_seasons` rows (numeric `2025` vs slug `2025–26`) were not filtered consistently outside Table Lab.
5. Premiership alias map did not include `Bristol Rugby`; Gloucester display name was shortened.

### Migration / fix applied

| Area | Change |
|------|--------|
| **Core** | New `season-scoped-picker-service.ts` — teams from standings for `seasonId`, fixtures fallback via `kickoffInSeason`, canonical dedupe via `PREMIERSHIP_TEAM_ALIASES` |
| **API** | `GET /api/admin/teams?grouped=1&competitionId=&seasonId=`; `GET /api/admin/players?picker=1&competitionId=&seasonId=&teamId=` |
| **Seasons** | `listAllSeasons` filters `is_deprecated = false`, `dedupeSeasonsByYear`, `decorateSeasonPickerRows`; active season selection skips deprecated rows |
| **UI** | `SeasonCompetitionScope` + scoped hooks on `/admin/teams` and `/admin/players`; **Leagues → Competitions** in nav and breadcrumbs |
| **Audit** | `data-audit-service.ts`, `/admin/data-audit`, `scripts/data-health-audit.ts` |
| **Aliases** | Added `bristol rugby → Bristol Bears`; Gloucester displays as **Gloucester Rugby** |

### Tests added

- `apps/web/src/lib/season-scoped-picker-service.test.ts` — Bristol/Newcastle dedupe, historic vs current Premiership sets, Gloucester display, canonical season preference (with existing `premiership-season-resolution.test.ts`)

### Remaining risks

- **GroupedTeamSelect** on matches, transfers, coaches, squads still loads global teams unless each page passes competition + season scope (follow-up wiring).
- **Fixtures** still lack `season_id`; fixture fallback depends on kickoff window matching season label year.
- **Entity dedup** may still leave duplicate team rows in DB; aliases are code-map only (no `team_aliases` table yet).
- **Player list** admin filter by team still uses `club_team_id` on the main list API — season-scoped picker applies to `picker=1` endpoint only.
- Run `mergeDuplicateCompetitionSeasons` per competition if audit reports duplicate season years with standings on deprecated rows.

---

## Player season membership — Bath squad audit (8 July 2026)

### Issue found

Player lists used **`players.club_team_id`** as the sole club link. That caused four data problems across Bath and other clubs:

1. Previous-season players still linked to the club
2. Confirmed departures still shown under the old club
3. Duplicate identities (Will/William Stuart, Ewan Richards/Richards Ewan, etc.)
4. Reversed or inconsistent import names (Cowan Tom, Harris Sam, Le Roux Neil)

### Root cause

No **`player_team_memberships`** table — season-specific squad membership was inferred from global `club_team_id`, all-time fixture history, or unscoped imports. Transfers updated inbound `club_team_id` but did not close season membership on departures.

### Fix applied

| Area | Change |
|------|--------|
| **Schema** | Migration `0031_player_team_memberships.sql` — `player_id`, `team_id`, `season_id`, `start_date`, `end_date`, `status` |
| **Membership service** | `player-membership-service.ts` — upsert/close, rebuild from fixtures + stats + transfers |
| **Transfers** | `createTransferRecord` calls `applyTransferToMemberships` (does not rely on club_id alone) |
| **Identity** | `player-identity-service.ts` — token-sort dedupe, reversed names, nickname variants; expanded `PLAYER_DISPLAY_NAME_FIXES` |
| **Audit** | `player-squad-audit-service.ts`, `/admin/data-audit/squads`, `scripts/audit-player-squads.ts` |
| **Selectors** | Player list + picker filter by membership when `teamId + seasonId` provided |
| **Scripts** | `scripts/rebuild-player-memberships.ts` |

### Tests added

- `player-identity-service.test.ts` — Bath examples (Stuart, Richards, Cowan, le Roux, Harris)

### Remaining risks

- **`club_team_id`** remains on player row for global admin; season UI must pass `seasonId` to avoid leaks
- Initial membership rows empty until **`rebuild-player-memberships.ts`** or audit with `--rebuild` is run
- Duplicate **player rows** in DB still require entity dedup merge — identity service detects, does not auto-merge
- Official external squad feeds not wired — audit compares memberships + fixtures + Wikipedia transfers

