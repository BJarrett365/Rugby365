# Table Lab — Data Gap Report

**Audit date:** 13 July 2026  
**Database:** Docker Postgres `rugby365` (`localhost:5433`)  
**Related:** [TABLE_LAB_AUDIT.md](./TABLE_LAB_AUDIT.md)

Global fallback rule (from README): never treat missing Level-2/3 data as zero; show basic Level-1 tables when possible; hide advanced columns when null; advanced tables show unavailable / limited coverage when required inputs missing.

---

## Global inventory (current DB)

| Source | Count / coverage | Notes |
|--------|------------------|-------|
| Fixtures `full_time` | **5,054** | Primary completed status (not `completed`) |
| Fixtures `scheduled` / `live` / other | 102 / 1 / 20 | Live Table may include live |
| Premiership `full_time` | **2,571** | Includes knockouts on season rows |
| Premiership seasons (sample) | 2024–25: 130 FT fixtures, 10 overall standings rows; 2025–26: 93 FT, 10 standings | Synced standings ≈ league phase |
| `standing_rows` | **1,544** | Overall / home / away views |
| `team_match_stats` | **780** | Tries present on all counted rows |
| Premiership try stats by season | **2024–25: 0**; **2025–26: 80**; **2026–27: 106** | Top 14 / Super Rugby also have stats |
| `match_events` | **138,566** | Strong timeline coverage on recent Premiership (~71–72% of team-fixtures in 2024–25 calc warnings) |
| `teams.hemisphere` | **12 / 702** tagged | Almost all clubs null |
| Competition scoring rules | In-code catalogs | Not a DB table |

---

## Agreed tables — data readiness

### Level 1 — Basic results (fixtures + scores)

| Table | Minimum data | Available now | Missing | Seasons / comps affected | Basic fallback works? | Import / collection work |
|-------|--------------|---------------|---------|--------------------------|----------------------|--------------------------|
| Full Table | Fixtures or `standing_rows` | ✓ Both | Playoff vs league scope ambiguity (AUD-019) | Premiership seasons with knockouts on same `season_id` | ✓ Synced | Clarify league-only flag / round filter |
| Live Table | Fixtures + live scores | ✓ | Live try/bonus rare | All | ✓ Without live BP | Live feed QA |
| Form Table | Fixtures + scores | ✓ | — | — | ✓ | — |
| Home / Away | Fixtures + scores (+ neutral flag) | ✓ | Neutral flags sparse | Away neutrals | ✓ | Flag neutrals |
| Calendar Year | Fixtures + scores | ✓ | — | — | ✓ | — |
| On This Date | Fixtures + scores | ✓ | Completion ts often = kickoff | Historic | ✓ | Optional FT timestamps |
| Between Dates | Fixtures + scores | ✓ | — | — | ✓ | — |
| All-Time Premiership | Fixtures + aliases + era rules | ✓ | Unmapped identities (e.g. Yorkshire) | Historic clubs | ✓ With warnings | Alias map maintenance |
| v Top / Bottom Half | Season results | ✓ | Historic ranks for `at_match` thinner older | Early seasons | ✓ | Event/ranking archive optional |

### Level 2 — Tries, bonus, competition rules

| Table | Minimum data | Available now | Missing | Affected | Basic fallback? | Work required |
|-------|--------------|---------------|---------|----------|-----------------|---------------|
| Tries Scored | Verified try counts | Prem 2025–26+ ✓ | **Prem 2024–25 and older** | Most historic Prem seasons | Empty + warning (correct) | SDMS / event-derived tries backfill |
| Tries Conceded | Same | Same | Same | Same | Same | Same |
| Both Teams Scored Tries | Both sides’ tries | Same | Same | Same | Same | Same |
| Winning Bonus Points | Tries + scoring rules | Rules ✓; tries recent ✓ | Historic tries; max-win definition QA | Pre-2025–26 Prem | Empty when tries missing | Same + era N/A copy |
| Full Table TF/TA/TBP/LBP cols | Tries or synced breakdown | Synced bonus often present; TF null on synced path | Try columns | 2024–25 Full Table | Base Pts ✓; hide TF | Standings try import |
| Try / Losing / Bonus Points (partial defs) | Tries + rules | Partial | Code path wrong + data gaps | All | Misleading if shown | Fix code (Phase 2) then data |

### Level 3 — Timelines / periods / game state

| Table | Minimum data | Available now | Missing | Affected | Fallback? | Work required |
|-------|--------------|---------------|---------|----------|-----------|---------------|
| First Half | HT score or events ≤40′ | ~72% of Prem 2024–25 matches | ~28% without recoverable HT | Sparse early / incomplete events | Partial table + coverage warning | HT snapshot import |
| Second Half | HT + FT | Same ~72% | Same | Same | Same | Same |
| Final 20 Minutes | Events ≥60′ or score@60 | Same ~72% | 60′ snapshots thin | Knockouts / ET | Same | Minute-accurate events |
| Custom Match Period | Arbitrary timed window | Events exist | **No real builder** | All | ✗ Wrong proxy | Code + events |
| Scoring / Conceding First | Ordered scoring events | ~71.5% team-fixtures | Ambiguous / missing openers | Gaps | Partial + warn | Event order QA |
| Points Gained Losing / Lost Winning | Score progression | Same | Same | Same | Partial | Same |
| Comeback / Lead Protection | Progression | Same | Same | Same | Partial | Same |
| Points Gained Drawn | Progression + level states | Events exist | **No implementation** | — | ✗ Wrong table | Implement |

### Hemisphere

| Table | Minimum | Available | Missing | Competitions | Fallback? | Work |
|-------|---------|-----------|---------|--------------|-----------|------|
| Hemisphere Table | `teams.hemisphere` | Internationals partially tagged | **Club hemisphere null** | Premiership, URC, Top 14, etc. | 0 rows + warning | Tag clubs or NC-only product rule |

---

## Advanced stat tables (set piece, attack, defence, possession, discipline)

| Metric family | Minimum | Available | Gap | Fallback | Work |
|---------------|---------|-----------|-----|----------|------|
| Carries / metres / tackles / etc. | `team_match_stats` fields | Some SDMS rows (780) | Most fixtures/seasons empty; sections sparse | Generic tables return empty / low coverage | Full SDMS import pipeline |
| Cards / penalties | Events or stats | Events partial | Incomplete classification | Empty / low | Event taxonomy QA |

---

## Per-competition try-stat snapshot

| Competition | `team_match_stats` rows | Notes |
|-------------|------------------------:|-------|
| Top 14 | 394 | Strongest try coverage |
| Premiership | 186 | Recent seasons only |
| Super Rugby | 182 | Present |
| International | 18 | Thin |

---

## Fallback compliance summary

| Rule | Status |
|------|--------|
| Missing tries ≠ zero on dedicated try tables | ✓ Empty + warnings observed |
| Basic Full/Form/Home/Away without TF columns | ✓ TF null hidden / absent on synced Full Table |
| Advanced timeline tables without inventing FT-only first scores | ✓ Warnings when coverage &lt; 100% |
| Custom period / drawn-points honesty | ✗ Misleading outputs (code issues, not data) |
| Hemisphere without guessing names | ✓ Excludes untagged (0 rows) |

---

## Priority data collection order

1. **Clarify Premiership season scope** (league vs all fixtures) — unblocks honest Live vs Full comparison.  
2. **Backfill Premiership try stats for 2024–25 and earlier** — unlocks betting tables on the season editors use most.  
3. **HT / 60′ snapshots** where events are thin — raises first/second/final-20 coverage above ~72%.  
4. **Club hemisphere tags** or product restriction — unlocks Hemisphere Table.  
5. **Broader SDMS sections** — unlocks set-piece / attack / defence tables.
