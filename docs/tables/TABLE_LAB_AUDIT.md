# Table Lab — Full Audit Report

**Audit date:** 13 July 2026 (re-audit)  
**Prior audit:** 7 July 2026 (superseded by this document)  
**Repository:** `/Users/barriejarrett/Desktop/rugby365`  
**Scope:** All registered Table Lab definitions (67); deep review of 26 agreed tables (24 main + Hemisphere + Custom Match Period)  
**Method:** Instruction review, code inspection, unit tests, live `calculateRugbyTable` against Docker Postgres, HTTP/UI probe  
**Fix policy:** Audit only — no product fixes applied in this pass

---

## Executive summary

| Outcome | Count (of 26 agreed) |
|---------|---------------------:|
| **Fully working** (UI loads + filters + verified calc + data honesty + tests) | **0** |
| **Partial** (calc/service OK or usable; UI and/or gaps remain) | **20** |
| **Broken** (wrong output or misleading proxy) | **2** |
| **Missing** (registered but not implemented) | **1** |
| **Blocked by data** (code path OK; required inputs absent for primary scopes) | **3** |

**Critical blocker (audit-time):** Admin/Table Lab UI returned **HTTP 500** via client→Postgres bundle poison (`Can't resolve 'net'`). **Resolved in Phase 1 repair** (see below) — routes return 200 and Full Table renders in browser.

**Calculation reality check (Premiership 2024–25):** Full Table top three match synced `standing_rows` exactly (Bath 18/14/0/4/72). Form / home / away / opposition / timeline tables return non-empty plausible rows. Betting try tables return rows for **2025–26** (SDMS present) but **0 rows** for **2024–25** (no try stats that season).

---

## Status matrix — agreed main tables (26)

| Table | Docs | UI | API | Calculation | Filters | Data | Tests | Overall |
| ----- | ---- | -- | --- | ----------- | ------- | ---- | ----- | ------- |
| Full Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Live Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Form Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Home Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Away Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| All-Time Competition Table | Partial | Broken | Broken | Partial | Partial | Working | Partial | **Partial** |
| Calendar Year Table | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Table On This Date | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Table Between Two Dates | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| First Half Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Second Half Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Final 20 Minutes Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Custom Match Period | Missing | Broken | Broken | Broken | Missing | Partial | Missing | **Broken** |
| Table v Top Half | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Table v Bottom Half | Working | Broken | Broken | Working | Partial | Working | Working | **Partial** |
| Table When Scoring First | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Table When Conceding First | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Points Gained From Losing Positions | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Points Lost From Winning Positions | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Points Gained From Drawn Positions | Missing | Broken | Broken | Broken | Missing | Partial | Missing | **Missing** |
| Comeback Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Lead Protection Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Tries Scored Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Tries Conceded Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Both Teams Scored Tries | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Winning Bonus Points Table | Working | Broken | Broken | Working | Partial | Partial | Working | **Partial** |
| Hemisphere Table | Working | Broken | Broken | Working | Partial | Blocked | Working | **Blocked by Data** |

### Matrix notes

- **UI = Broken / API = Broken:** Webpack compile fails for admin routes; `/admin/tables`, `/admin/tables/view`, `/api/admin/tables/definitions` all HTTP 500 in this environment (see AUD-001). Server calculation via direct `calculateRugbyTable` still works.
- **Filters = Partial:** Filter UI exists in `view/page.tsx` but cannot be exercised in browser until AUD-001. Away `includeNeutralVenueForAwayTable` still not exposed in UI.
- **All-Time Docs = Partial:** Product docs say “All-Time Competition”; implementation remains Premiership-specific (`all_time_premiership`).
- **Tries / WBP Overall = Partial (not Blocked):** SDMS try rows exist for Premiership **2025–26** (80) and **2026–27** (106). **2024–25** has **0** try-stat rows — tables correctly return empty with warnings for that season.
- **Hemisphere = Blocked by Data:** Premiership clubs lack `teams.hemisphere` (only 12 of 702 teams tagged globally); Premiership scope returns 0 rows.

---

## Extra / partial tables (not in the 24 main list)

| Table | Overall | Notes |
|-------|---------|-------|
| Custom Match Period | **Broken** | Final-20 proxy; ignores custom minutes (AUD-004) |
| Points Gained From Drawn Positions | **Missing** | Falls through to ordinary league table (AUD-003) |
| Try Bonus Point Table | **Broken** | Generic path; competition rules / null-try handling weak (AUD-005/006/009) |
| Losing Bonus Point / Bonus Points | **Partial** | Generic `matchLeaguePoints` without competition rules; LBP conflated with total BP (AUD-006/007) |
| Set piece / attack / defence / possession / discipline (~28) | **Blocked by Data** / Partial | Generic metric standings; sparse SDMS beyond tries |
| `points_gained_drawn` | **Missing** | No instruction file |

---

## Test execution (13 Jul 2026)

| Command | Result |
|---------|--------|
| `npm test -- table-lab` | **279 passed, 3 failed** (33 files). Failures all in `all-time-premiership.test.ts` |
| `npm test -- rugby-table-metrics` | **5 passed** |
| `npm test -- table-confidence` | **No dedicated file** (confidence covered in `table-lab.test.ts` / data-levels) |
| `npm test -- table-lab-data-levels` | **5 passed** |
| `npm test -- live-table` | **16 passed** |
| `npm run typecheck` (root) | **Fails** (import-sdk / match-operator-agent unrelated + web errors) |
| `apps/web` `tsc --noEmit` | **Many table-lab TS errors** (extra field types, `triesMatchRangeCount`, `AllTimePremiershipCoverage`, MatchEventLike, etc.) — AUD-012 expanded |

### All-time test failures (AUD-018)

Assertions look for `teamName === "Bath"` but alias map now canonicalises to **`Bath Rugby`**. Coverage assertions that find Bath therefore get `undefined`. This is primarily **test/alias drift**, not proof that live all-time calc is empty (live DB returns 16 clubs headed by Leicester Tigers).

---

## Manual calculation verification

### Full Table — Premiership 2024–25 (`seasonId` `182eb6da-…`)

| Team | Synced `standing_rows` | `calculateRugbyTable('full_table')` | Match |
|------|------------------------|--------------------------------------|-------|
| Bath | P18 W14 D0 L4 PF651 PA417 Pts72 | same | ✓ |
| Leicester Tigers | P18 W11 D1 L6 PF533 PA439 Pts61 | same | ✓ |
| Sale Sharks | P18 W12 D0 L6 PF529 PA455 Pts58 | same | ✓ |

Source path: prefers synced overall standings (expected for Full Table).

### Home Table — Bath

| Source | P | W | D | L | PF | PA | Pts |
|--------|--:|--:|--:|--:|---:|---:|----:|
| Synced `standing_rows` view=home | 9 | 7 | 0 | 2 | 258 | 172 | 35 |
| `calculateRugbyTable('home_table')` | 9 | 7 | 0 | 2 | 258 | 172 | 35 |

✓ Match.

### Scope inconsistency (AUD-019 — High)

Same season_id Premiership Bath fixtures with `status=full_time`: **P25 W19 L6 PF877 PA584** (includes knockouts/playoffs). Synced league table stays at **18**. Live Table calc for 2024–25 returned Bath **P25** — so Live / fixture-based paths include non-league matches that Full Table (synced) excludes. Editors will see contradictory tables unless season scope is clarified (league-only vs all competition fixtures).

### Form — Last 5 Away

`form_table` with `tableView=away`, `formMatchCount=5` returned teams with **P=5** (e.g. Leicester, Sale, Northampton). Unit tests cover venue-before-slice. Browser Last-5-Away not verified (UI down).

### Tries Scored — season contrast

| Season | `team_match_stats` on Premiership fixtures | Tries Scored rows |
|--------|--------------------------------------------|------------------:|
| 2024–25 | 0 | 0 (warnings: no verified SDMS try data) |
| 2025–26 | 80 | 10 (e.g. Northampton TF 115 / P20) |

Honest empty state for missing try data — correct Level-2 behaviour.

### Custom Match Period / Points Gained Drawn

| Table | Actual behaviour |
|-------|------------------|
| `custom_match_period` | Warning: “using final 20 minutes proxy”; Bath P20 Pts65 — **not** a custom window |
| `points_gained_drawn` | Same shape as ordinary full/live standings (Bath P25 Pts77) — **wrong semantics** |

### Hemisphere

0 rows; warning: 12 teams missing hemisphere excluded.

---

## Exists checklist (instruction ↔ code ↔ menu)

| Table | Instruction | Definition | Dedicated service | In view menu | Calc path |
|-------|:-----------:|:----------:|:-----------------:|:------------:|-----------|
| Full | ✓ | ✓ | Inline + synced | ✓ | Dedicated |
| Live | ✓ | ✓ | `live-table-service` | ✓ | Dedicated |
| Form | ✓ | ✓ | `form-table-service` | ✓ | Dedicated |
| Home | ✓ | ✓ | `home-table-service` | ✓ | Dedicated |
| Away | ✓ | ✓ | `away-table-service` | ✓ | Dedicated |
| All-Time Premiership | ✓ | ✓ | `all-time-premiership-service` | ✓ | Dedicated |
| Calendar Year | ✓ | ✓ | `calendar-year-table-service` | ✓ | Dedicated |
| On This Date | ✓ | ✓ | `on-this-date-table-service` | ✓ | Dedicated |
| Between Dates | ✓ | ✓ | `between-dates-table-service` | ✓ | Dedicated |
| Hemisphere | ✓ | ✓ | `hemisphere-table-service` | ✓ | Dedicated |
| First / Second / Final 20 | ✓ | ✓ | Dedicated | ✓ | Dedicated |
| Custom Match Period | ✗ | ✓ | ✗ | ✓ | **Proxy** |
| v Top / Bottom Half | ✓ | ✓ | Dedicated | ✓ | Dedicated |
| Scoring / Conceding First | ✓ | ✓ | Dedicated | ✓ | Dedicated |
| Points Gained Losing / Lost Winning | ✓ | ✓ | Dedicated | ✓ | Dedicated |
| Points Gained Drawn | ✗ | ✓ | ✗ | ✓ | **Wrong default** |
| Comeback / Lead Protection | ✓ | ✓ | Dedicated | ✓ | Dedicated |
| Tries Scored / Conceded / BTTS / WBP | ✓ | ✓ | Dedicated | ✓ | Dedicated |

`TABLE_LAB_INDEX.md` Summary still claims **14** instruction files; **25** exist (AUD-011).

---

## Issue register

### AUD-001 — Admin / Table Lab UI HTTP 500 (client imports Postgres)

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Status** | **Fixed (Phase 1)** |
| **Tables** | All |
| **Problem** | `/admin/tables`, `/admin/tables/view`, `/api/admin/tables/definitions` fail to compile/load |
| **Expected** | Pages and API routes return 200 |
| **Actual (audit)** | HTTP 500 — `Module not found: Can't resolve 'net'` |
| **Actual (Phase 1)** | Routes **200**; no `net`/postgres in browser bundle |
| **Root cause** | Client import chain: `PlayerDataSection.tsx` → `player-season-stats-service.ts` → `@rugby365/db` → `postgres`; view page also imported calculation service trees for parsers |
| **Files** | `PlayerDataSection.tsx`, `player-season-stats-filters.ts`, `table-lab-param-parsers.ts`, `db.ts`, `admin/tables/view/page.tsx` |
| **Type** | Code |
| **Effort** | Small–Medium (0.5–1.5 d) |

### AUD-003 — `points_gained_drawn` not implemented

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Hidden (Phase 1)** — calculator no longer returns league table; full implementation remains Phase 2+ |
| **Tables** | Points Gained From Drawn Positions |
| **Problem** | Registered and selectable; output is a normal league table |
| **Expected** | Timeline-based points gained after level scores |
| **Actual (audit)** | `calculateRugbyTable` falls through `default` → full perspectives standings |
| **Actual (Phase 1)** | Hidden from menu; empty result + warning |
| **Root cause** | No dedicated service / instruction |
| **Files** | `table-calculation-service.ts`, `table-definition-service.ts` |
| **Type** | Code |
| **Fix** | Implement service + instruction, or hide from menu until ready |
| **Effort** | 2–3 d |

### AUD-004 — `custom_match_period` is a final-20 proxy

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Hidden (Phase 1)** — no longer returns final-20 proxy; full minute-range impl remains Phase 2+ |
| **Tables** | Custom Match Period |
| **Problem** | Does not honour custom start/end minutes |
| **Expected** | Event-window table for arbitrary period |
| **Actual (audit)** | Warning + final-20 proxy; UI lacks minute filters |
| **Actual (Phase 1)** | Hidden from menu; empty result + warning |
| **Root cause** | Stub switch case |
| **Files** | `table-calculation-service.ts`, `table-types.ts`, `view/page.tsx` |
| **Type** | Code |
| **Fix** | Dedicated window service (Phase 2+) |
| **Effort** | 3–5 d |

### AUD-005 / AUD-006 / AUD-007 — Generic bonus table paths wrong

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Tables** | Try Bonus Point, Losing Bonus Point, Bonus Points |
| **Problem** | Hardcoded / default Premiership-style rules; LBP uses total `bonusPoints` |
| **Expected** | Competition scoring rules; separate TBP / LBP |
| **Actual** | `matchLeaguePoints` without rules in generic switch |
| **Files** | `table-calculation-service.ts` (~2956+) |
| **Type** | Code |
| **Effort** | 0.5–2 d |

### AUD-011 — Index summary stale

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Problem** | Summary says 14 instruction files; 25 exist |
| **Files** | `docs/tables/TABLE_LAB_INDEX.md` |
| **Effort** | Trivial |

### AUD-012 — Table Lab TypeScript errors (expanded)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | **Fixed (Phase 1)** — no remaining table-lab tsc errors |
| **Problem** | `apps/web` tsc fails across multiple table services (`extra` undefined, wrong context field names, missing types) |
| **Files** | `all-time-premiership-service.ts`, `scoring-first-table-service.ts`, `tries-*`, `table-calculation-service.ts`, others |
| **Type** | Code |
| **Effort** | 0.5–1 d |

### AUD-013 — Try / SDMS coverage incomplete by season

| Field | Detail |
|-------|--------|
| **Severity** | High (data) |
| **Tables** | Tries Scored/Conceded, BTTS, Winning Bonus Points, enhanced columns |
| **Problem** | Premiership try stats only on recent seasons (2025–26 / 2026–27); none on 2024–25 |
| **Expected** | Documented coverage; empty with warnings when missing (current code does this) |
| **Actual** | 780 `team_match_stats` total; Premiership 186 (not on 2024–25) |
| **Type** | Data |
| **Fix** | Backfill SDMS / event-derived tries for historic seasons |
| **Effort** | Large |

### AUD-014 — Hemisphere blocked for club competitions

| Field | Detail |
|-------|--------|
| **Severity** | Medium (data) |
| **Tables** | Hemisphere |
| **Actual** | 0 Premiership rows; clubs untagged |
| **Fix** | Tag clubs or restrict UI to international comps |
| **Effort** | 1–2 d |

### AUD-015 — Live Table browser / SSE unverified

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Problem** | 16 unit tests pass; browser SSE / 0–0 draw / movement not verified (UI down) |
| **Files** | `live-table-service.ts`, `live-table/stream` route |
| **Effort** | 1 d after AUD-001 |

### AUD-018 — All-time unit tests fail after Bath → Bath Rugby alias

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | **Fixed (Phase 1)** — tests expect `Bath Rugby`; alias map unchanged |
| **Tables** | All-Time Premiership |
| **Problem** | 3 tests fail looking for `teamName === "Bath"` |
| **Expected** | Tests use canonical display names / keys |
| **Actual (audit)** | Alias map returns `Bath Rugby` |
| **Type** | Code (tests) |
| **Effort** | Small |

### AUD-019 — League standings vs all fixtures on same season_id

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Tables** | Live, Form, timeline, opposition (fixture-based) vs Full/Home/Away (often synced) |
| **Problem** | Same season contains 18-game synced league table and 25 Bath full_time fixtures |
| **Expected** | Explicit league-only vs all-matches scope |
| **Actual** | Full Table uses synced 18; Live uses 25 — contradictory without labelling |
| **Type** | Data + code (scope rules) |
| **Effort** | Medium |

### AUD-020 — Away neutral-venue toggle not in UI

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Tables** | Away Table |
| **Problem** | Context supports `includeNeutralVenueForAwayTable`; view page does not expose it |
| **Effort** | Small |

---

## Browser testing (audit baseline — superseded by Phase 1)

| Check | Result |
|-------|--------|
| `npm run db:up` / DB reachable | ✓ Docker `rugby365-postgres-1` |
| `npm run dev` | Running (port 3000) |
| `/admin/tables` | **500** (pre-fix) |
| `/admin/tables/view` | **500** (pre-fix) |
| `/api/admin/tables/definitions` | **500** (pre-fix) |
| Filters / export / shareable URLs / mobile | **Blocked** by AUD-001 (pre-fix) |
| Live SSE | **Not tested** |

---

## Phase 1 repair (14 July 2026)

Phase 1 exit criteria from `TABLE_LAB_FIX_PLAN.md` — **met**. Do not start Phase 2 until product owners confirm.

### Fixed issues

| ID | Fix |
|----|-----|
| **AUD-001** | Client components no longer import DB/server services. Pure URL/param parsers moved to `table-lab-param-parsers.ts`. `import "server-only"` added to `db.ts`, `table-calculation-service.ts`, `competition-scoring-rules.ts`, `table-hemisphere-service.ts`, `player-season-stats-service.ts`. Season-stats filter helpers remain in `player-season-stats-filters.ts`. Vitest stubs `server-only` via `test/stubs/server-only.js`. |
| **AUD-012** | Table Lab TypeScript errors cleared (coverage types, `extra` nullability, `MatchEventLike`, tries range/date parsing, related services). |
| **AUD-018** | All-time tests expect canonical **`Bath Rugby`**; alias map unchanged. |
| **AUD-003 / AUD-004 (menu)** | `custom_match_period` and `points_gained_drawn` marked `hiddenFromMenu: true`, filtered from `listRugbyTableDefinitions()`, calculator returns empty + clear warning (no league-table / final-20 proxy). Definitions/docs retained; index status **Planned / Hidden**. |

### Routes checked (HTTP 200)

| Route | Status |
|-------|--------|
| `/admin/tables` | **200** |
| `/admin/tables/view?type=full-table` | **200** |
| `/api/admin/tables/definitions` | **200** (65 visible defs; hidden pair absent) |
| `POST /api/admin/tables/calculate` (`full_table`, Premiership 2024–25) | **200** JSON — 10 rows (e.g. Bath 18/72) |

Browser: Full Table UI loads; competition + season filters populate; table type list has **65** options (no Custom Match Period / Points Gained From Drawn Positions); empty 2026–27 scope shows honest warnings.

### Tests run

```text
npm test -- table-lab
→ 33 files, 283 passed
```

### Key files changed

- `apps/web/src/lib/table-lab/table-lab-param-parsers.ts` (new)
- `apps/web/src/app/admin/tables/view/page.tsx` — imports parsers only
- `apps/web/src/components/admin/TableLabPanels.tsx`
- Table Lab `*-table-service.ts` (re-export parsers; TS/extra fixes)
- `table-definition-service.ts`, `table-calculation-service.ts`, `table-types.ts`
- `apps/web/src/lib/db.ts`, `player-season-stats-service.ts`
- `apps/web/vitest.config.ts`, `test/stubs/server-only.js`
- `docs/tables/TABLE_LAB_INDEX.md`

### Remaining issues (Phase 2+)

- Wrong / incomplete calcs for bonus-point generics, try-bonus competition rules (AUD-005–009)
- Fixture vs synced standings scope labelling (AUD-019)
- Hemisphere club tagging / data (AUD-014)
- SDMS try coverage gaps by season (AUD-013)
- Live Table SSE browser verification (AUD-015)
- Away neutral-venue UI toggle (AUD-020)
- Product naming: synced Full Table may still show historic short names (e.g. `Bath`) from `standing_rows` — separate from all-time canonicalisation

### Blockers

None for Phase 1 exit. Phase 2 is unblocked from an HTTP/UI perspective.

---

## Related documents

- [TABLE_LAB_DATA_GAPS.md](./TABLE_LAB_DATA_GAPS.md)
- [TABLE_LAB_FIX_PLAN.md](./TABLE_LAB_FIX_PLAN.md)
- [TABLE_LAB_INDEX.md](./TABLE_LAB_INDEX.md)
- [README.md](./README.md)
