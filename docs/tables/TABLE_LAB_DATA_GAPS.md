# Table Lab — Data Gap Report

**Audit date:** 7 July 2026  
**Database:** `postgresql://localhost:5433/rugby365` (Docker Postgres)

This document lists **minimum data required**, **what exists today**, **gaps**, and **fallback behaviour** for each agreed Table Lab table.

---

## Global data inventory (Premiership-focused)

| Source | Count / coverage | Notes |
|--------|------------------|-------|
| Fixtures (`status = full_time`) | 2,567 | Primary result set |
| Fixtures (Premiership, all seasons in DB) | ~490 per competition filter | Season filter uses kickoff year (Sep–Aug) |
| `standing_rows` | 1,278 | Synced tables for many seasons (e.g. 2024–25: 30 rows/season) |
| `team_match_stats` | **10 total** | **0** linked to Premiership fixtures |
| `match_events` | 134,721 | Strong coverage for Premiership timeline tables |
| `teams.hemisphere` | Column often missing until 0028 applied; clubs largely **null** | International teams backfilled in migration SQL |
| `fixtures.is_neutral_venue` | Column often missing until 0028 applied | Affects away table neutral handling |
| `competition_scoring_rules` | In-code slug map | Not a DB table; Premiership defaults in `table-types.ts` + historic overrides |

---

## Level 1 — Basic results (fixtures + scores)

**Fallback rule:** P, W, D, L, PF, PA, PD, Pts without tries or advanced stats.

| Table | Minimum data | Available | Missing | Seasons / competitions affected | Basic fallback works? | Import work |
|-------|--------------|-----------|---------|--------------------------------|----------------------|-------------|
| Full Table | fixtures, scores, standing_rows (optional) | ✓ Full | — | None for Premiership | ✓ Yes (synced) | Keep standings sync current |
| Live Table | fixtures, live scores | ✓ | Live bonus needs tries | All | ✓ Without live bonus cols | Live feed for in-progress matches |
| Form Table | fixtures, scores | ✓ | — | None | ✓ Yes | — |
| Home Table | fixtures, scores | ✓ | — | None | ✓ Yes | — |
| Away Table | fixtures, scores, neutral venue flag | ✓ Scores | `is_neutral_venue` if 0028 not applied | All if schema drift | ✓ Partial | Apply 0028; set neutral flags |
| Calendar Year | fixtures, scores | ✓ | — | None | ✓ Yes | — |
| On This Date | fixtures, scores | ✓ | Completion timestamp often kickoff proxy | Historic | ✓ Yes | Optional FT timestamps |
| Between Dates | fixtures, scores | ✓ | — | None | ✓ Yes | — |
| All-Time Premiership | fixtures, scores, aliases | ✓ | Non-Premiership competitions | Non-Premiership | N/A (competition-specific) | Extend if generic all-time needed |

---

## Level 2 — Rugby scoring (tries, bonus, competition rules)

**Fallback rule:** Hide TF/TA/TBP/LBP when null; never show as zero.

| Table | Minimum data | Available | Missing | Seasons / competitions affected | Basic fallback works? | Import work |
|-------|--------------|-----------|---------|--------------------------------|----------------------|-------------|
| Tries Scored | fixtures, scores, **try counts** | Scores ✓ | **SDMS tries** — 0 Premiership stat rows | All Premiership seasons in DB | ✗ No rows (correct exclusion) | SDMS / event-derived try totals per team |
| Tries Conceded | same | same | same | same | ✗ No rows | same |
| Both Teams Scored Tries | same | same | same | same | ✗ No rows | same |
| Winning Bonus Points | fixtures, scores, tries, rules | Scores + rules ✓ | Verified try/bonus breakdown | same | ✗ No rows | same + synced bonus breakdown optional |
| Try Bonus Point (partial) | tries + rules | Rules ✓ | Tries; generic path still “works” incorrectly | same | ⚠ Shows wrong table (AUD-005) | SDMS tries + fix code |
| Losing Bonus Point (partial) | scores + rules | ✓ | LBP-only metric conflated with TBP in code | Wrong rules outside Premiership | ⚠ Misleading values | Fix code; optional synced LBP |
| Bonus Points (partial) | same | ✓ | same | same | ⚠ Misleading | Fix code |
| Full Table (enhanced cols) | tries in standing_rows | Synced `bonus_points` on rows | `triesFor`/`triesAgainst` null in calc path | Recent seasons | ✓ Base table; bonus from sync | Try columns in standings import |

---

## Level 3 — Timeline / game state (match events)

**Fallback:** Table unavailable or limited coverage % when events missing; never infer from final score alone (implemented tables honour this).

| Table | Minimum data | Available | Missing | Seasons affected | Basic fallback works? | Import work |
|-------|--------------|-----------|---------|------------------|----------------------|-------------|
| First Half | HT scores or timed events | Events ✓ (~490 fixtures) | Some matches without HT snapshot | Early seasons | ✓ With coverage warnings | HT score import where events thin |
| Second Half | HT + FT | Events ✓ | ~3% gap (audit warning 97.1% scores) | Sparse early data | ✓ Partial coverage | Same |
| Final 20 Minutes | Timed events / 60' snapshot | Events ✓ | Extra time handling varies | Knockout rounds | ✓ With warnings | Minute-accurate events |
| Custom Match Period | Timed events | Events exist | **No arbitrary window builder** | All | ✗ Wrong proxy (final 20) | Code + events |
| Scoring First | First score events | ✓ | Small ambiguous set | Rare edge cases | ✓ | Event order QA |
| Conceding First | same | ✓ | Teams with 0 qualifying matches excluded | — | ✓ | — |
| Points Gained Losing | Score timeline | ✓ | Coverage <100% on old seasons | Pre-event eras | ✓ Limited | Historic event backfill |
| Points Lost Winning | same | ✓ | same | same | ✓ Limited | same |
| Points Gained Drawn | Timeline + drawn states | Events exist | **No implementation** | — | ✗ Shows wrong table | Implement service |
| Comeback | Timeline | ✓ | same as timeline tables | same | ✓ Limited | same |
| Lead Protection | Timeline | ✓ | same | same | ✓ Limited | same |

---

## Level 3 — Opposition context

| Table | Minimum data | Available | Missing | Fallback? | Import work |
|-------|--------------|-----------|---------|-----------|-------------|
| Table v Top Half | Season results + reference table | ✓ | — | ✓ | — |
| Table v Bottom Half | same | ✓ | — | ✓ | — |

Reference table built from full-season perspectives or synced standings.

---

## Hemisphere / international

| Table | Minimum data | Available | Missing | Competitions affected | Fallback? | Import work |
|-------|--------------|-----------|---------|----------------------|-----------|-------------|
| Hemisphere Table | `teams.hemisphere`, fixtures | Fixtures ✓ | **Club hemisphere null** | Premiership, URC, etc. | ✗ 0 rows | Tag clubs or restrict to Nations Championship |
| Nations Championship enrich | Competition slug + team types | Competition exists | Few NC fixtures in DB | Nations Championship | Partial | NC fixture + team import |

---

## Advanced stat tables (set piece, attack, defence, possession, discipline)

| Category | Minimum data | Available | Missing | Fallback? | Import work |
|----------|--------------|-----------|---------|-----------|-------------|
| All 28 partial metric tables | `team_match_stats` SDMS sections | **10 rows globally** | **~99.9% missing** | ✗ `unavailable` | Full SDMS pipeline per competition |

Affected IDs include: `lineout_won`, `carries`, `tackles_made`, `possession`, `penalties_conceded`, `tries_conceded_defence`, etc.

---

## Schema / migration gaps (block all tables)

| Item | Required for | Status in audit DB |
|------|--------------|-------------------|
| `fixtures.is_neutral_venue` | Away table, neutral filter | Missing until manual 0028 SQL |
| `teams.hemisphere`, `team_type`, `region` | Hemisphere table | Missing until manual 0028 SQL |
| Drizzle journal vs actual schema | All fixture/team queries | **Drift detected** — migrate claims 0028 applied |

---

## Per-table summary — agreed 26

| # | Table | Min tier | Data status | Fallback OK? |
|---|-------|----------|-------------|--------------|
| 1 | Full Table | L1 | ✓ Complete | ✓ |
| 2 | Live Table | L1 | ✓ | ✓ (no live bonus) |
| 3 | Form Table | L1 | ✓ | ✓ |
| 4 | Home Table | L1 | ✓ | ✓ |
| 5 | Away Table | L1 | ✓ | ✓ |
| 6 | All-Time Competition | L1 | ✓ Premiership only | ✓ |
| 7 | Calendar Year | L1 | ✓ | ✓ |
| 8 | On This Date | L1 | ✓ | ✓ |
| 9 | Between Dates | L1 | ✓ | ✓ |
| 10 | First Half | L3 | ✓ Events | Coverage % |
| 11 | Second Half | L3 | ✓ Mostly | Coverage % |
| 12 | Final 20 Minutes | L3 | ✓ | Coverage % |
| 13 | Custom Match Period | L3 | Events exist | ✗ Code proxy only |
| 14 | v Top Half | L1 | ✓ | ✓ |
| 15 | v Bottom Half | L1 | ✓ | ✓ |
| 16 | Scoring First | L3 | ✓ | ✓ |
| 17 | Conceding First | L3 | ✓ | ✓ |
| 18 | Points Gained Losing | L3 | ✓ | ✓ |
| 19 | Points Lost Winning | L3 | ✓ | ✓ |
| 20 | Points Gained Drawn | L3 | N/A | ✗ Not built |
| 21 | Comeback | L3 | ✓ | ✓ |
| 22 | Lead Protection | L3 | ✓ | ✓ |
| 23 | Tries Scored | L2 | ✗ No tries | Correct empty |
| 24 | Tries Conceded | L2 | ✗ No tries | Correct empty |
| 25 | Both Teams Scored Tries | L2 | ✗ No tries | Correct empty |
| 26 | Winning Bonus Points | L2 | ✗ No tries | Correct empty |
| + | Hemisphere | L1+meta | ✗ No tags | Empty |
| + | Custom Match Period | L3 | Partial | Wrong |

---

## Recommended data collection priority

1. **Fix schema drift (0028)** — unblocks all environments.
2. **Premiership SDMS try stats** — unlocks four betting tables + try columns on full table.
3. **Club hemisphere tagging** — unlocks hemisphere table for domestic comps OR document as NC-only.
4. **Historic try/backfill** — older seasons for long-range all-time try/bonus analysis.
5. **SDMS full stats** — unlocks 28 advanced partial tables.

---

## Import sources (existing hooks)

| Source | Path / usage |
|--------|----------------|
| Standing sync | `standing_rows`, `trySyncedStandings` |
| Match events | `match_events` → timeline tables |
| Team match stats | `team_match_stats` → tries, carries, tackles |
| Competition rules | `competition-scoring-rules.ts`, `premiership-season-scoring.ts` |
| Team identity | `premiership-team-identity.ts` |

No fake data should be inserted to pass audits — empty states with warnings are correct until imports land.
