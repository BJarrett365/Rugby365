# Premiership Rugby Historical Data Audit

**Date:** 8 July 2026  
**Competition:** Premiership (`premiership`, id `b91075db-ce58-4d1e-9b66-660a76f93e7a`)  
**Scope:** Seasons 2008/09 – 2025/26  
**Method:** Read-only DB audit via `scripts/audit-premiership-seasons.ts` + deep checks

---

## Executive summary

The Premiership data layer has **structural problems** that explain mixed seasons, incomplete tables, and missing playoffs/winners:

| Area | Finding | Severity |
|------|---------|----------|
| Season records | 40 records (1987–2026); duplicates merged but **fixtures not season-linked** | Critical |
| Fixtures | No `season_id` FK — season inferred only by `kickoffInSeason()` | Critical |
| Winners | **Not stored in DB** — hardcoded UI catalog only | Critical |
| Standings vs fixtures | **Systematic mismatch** — table `played` ≠ fixture counts | Critical |
| 2013/14 | **No standings, no in-window fixtures** | Critical |
| 2020/21 | 56 fixtures snapshot-linked to **2019/20 season ID** | High |
| Active season | `2026–27` marked active but **deprecated**; 2025–26 not active | High |
| Attendance | **0 fixtures** with attendance across all seasons | High |
| Playoffs | Present in DB for most seasons (3 FT) but not stored separately from regular season in schema | Medium |
| Bonus/deductions | Only aggregate `bonus_points`; no TBP/LBP/deduction columns | Medium |

**0 of 18 audited seasons pass all validation checks.**

---

## Schema gaps (must fix before reliable repair)

```
competition_seasons
  ✗ champion_team_id / winner_team_id
  ✗ wikipedia_source_url / data_provenance

fixtures
  ✗ season_id FK
  ✓ attendance (column exists, never populated)
  ✓ round (used for playoff detection)

standing_rows
  ✗ try_bonus_points, losing_bonus_points, points_deduction
  ✓ bonus_points (aggregate only)
```

---

## Season mapping audit

### Competition lineage

Single competition record: **Premiership** (`premiership`). All historical seasons belong to this competition. SDMS catalog extends back to 1987–88 (pre-scope).

### Duplicate season records

**Current state:** `reportDuplicateCompetitionSeasons` returns **0 duplicate year groups** — prior `mergeDuplicateCompetitionSeasons` has collapsed label variants.

**However:**
- `mergeDuplicateCompetitionSeasons` migrates **standings only**, not fixtures (fixtures have no `season_id`).
- Deprecated record exists: `2026–27` (`9a335031…`) — `isDeprecated=true` but `isActive=true` (incorrect).
- Pre-2008 SDMS seasons (1987–2007) remain as empty catalog rows.

### Canonical season map (2008–2026)

| Start year | Label | Canonical ID | Slug | Provider | Active |
|-----------:|-------|--------------|------|----------|--------|
| 2025 | 2025–26 | `2474679e-c18b-4b1b-b2af-796e7504b688` | 2025-26 | livesport | false |
| 2024 | 2024–25 | `182eb6da-351d-482f-889f-dca7926494c9` | 2024-25 | livesport | false |
| 2023 | 2023–24 | `294f2614-b1d3-4d82-b032-12a161a3de3e` | 2023-24 | livesport | false |
| 2022 | 2022–23 | `671733e1-f5a1-432d-89c3-572891178141` | 2022-23 | livesport | false |
| 2021 | 2021–22 | `f25f5123-c7f8-4f2f-994b-739cf8ea4fdf` | 2021-22 | livesport | false |
| 2020 | 2020–21 | `b5728b8f-e3ab-4d5c-a669-d358e03a6ed0` | 2020-21 | livesport | false |
| 2019 | 2019–20 | `dbfdd820-ff2b-48b1-ae37-749f50b8a20b` | 2019-20 | livesport | false |
| 2018 | 2018–19 | `61351199-9570-4f95-a5ba-4b8e7d39b404` | 2018-19 | livesport | false |
| 2017 | 2017–18 | `76d0f4aa-1d2b-44d8-aec7-add81961eeb1` | 2017-18 | livesport | false |
| 2016 | 2016–17 | `ef8c0c2c-a63f-42cb-8c1c-7af462bdd690` | 2016-17 | livesport | false |
| 2015 | 2015–16 | `c0f79813-0030-46a2-bd36-dbc14cf42eb2` | 2015-16 | livesport | false |
| 2014 | 2014–15 | `7787988b-83ff-44c3-a9f8-9dc0cdcf218b` | 2014-15 | livesport | false |
| 2013 | 2013–14 | `4c457b96-658f-4fc3-ba69-f81fe966d1e2` | 2013-14 | sdms | false |
| 2012 | 2012–13 | `4d12f5cd-d5de-4eea-b5fb-a48e2d3c25fb` | 2012-13 | livesport | false |
| 2011 | 2011–12 | `cc4672f0-48cc-4eb7-808a-ad2a075c00b0` | 2011-12 | livesport | false |
| 2010 | 2010–11 | `0f2417b8-4b6b-4d34-82ac-78ba4a5389cc` | 2010-11 | livesport | false |
| 2009 | 2009–10 | `8c660846-351b-4bf0-89c9-3a37aa352b9b` | 2009-10 | livesport | false |
| 2008 | 2008–09 | `479dee69-721e-40a5-acb5-00070eff08d7` | 2008-09 | livesport | false |

### Data linkage model (current vs required)

```
CURRENT (broken):
  competition → competition_season → standing_rows
  competition → fixtures (kickoff date only, no season FK)

REQUIRED:
  competition → canonical competition_season
    ├── champion_team_id
    ├── standing_rows (regular season only)
    ├── fixtures (season_id, stage=regular|playoff)
    └── attendance per fixture
```

---

## Season-by-season validation

| Season | Teams | Exp. games* | P range | Table OK | Reg Fx (FT/total) | Playoff Fx | Winner in DB | Attendance | Status |
|--------|------:|-------------:|---------|----------|-------------------:|-----------:|--------------|------------|--------|
| 2025–26 | 10 | 18 | 18–18 | ⚠️ | 124/124 | 3/3 | ✗ | 0 | WARN |
| 2024–25 | 10 | 18 | 17–18 | ✗ | 125/125 | 3/3 | ✗ | 0 | FAIL |
| 2023–24 | 10 | 18 | 17–18 | ✗ | 123/123 | 3/3 | ✗ | 0 | FAIL |
| 2022–23 | 11 | 20 | 16–19 | ✗ | 151/151 | 3/3 | ✗ | 0 | FAIL |
| 2021–22 | 13 | 24 | 15–18 | ✗ | 129/129 | 3/3 | ✗ | 0 | FAIL |
| 2020–21 | 12 | 22 | 15–20 | ✗ | 150/150 | 6/6 | ✗ | 0 | FAIL |
| 2019–20 | 12 | 22† | 14–19 | ✗ | 46/46 | 0/0 | ✗ | 0 | FAIL‡ |
| 2018–19 | 12 | 22 | 16–19 | ✗ | 101/101 | 3/3 | ✗ | 0 | FAIL |
| 2017–18 | 12 | 22 | 16–19 | ✗ | 101/101 | 3/3 | ✗ | 0 | FAIL |
| 2016–17 | 12 | 22 | 16–19 | ✗ | 102/102 | 3/3 | ✗ | 0 | FAIL |
| 2015–16 | 12 | 22 | 16–19 | ✗ | 102/102 | 3/3 | ✗ | 0 | FAIL |
| 2014–15 | 12 | 22 | 16–19 | ✗ | 101/101 | 3/3 | ✗ | 0 | FAIL |
| 2013–14 | 0 | 22 | — | ✗ | 0/0 | 0/0 | ✗ | 0 | MISSING |
| 2012–13 | 12 | 22 | 15–19 | ✗ | 97/97 | 3/3 | ✗ | 0 | FAIL |
| 2011–12 | 12 | 22 | 15–19 | ✗ | 98/98 | 3/3 | ✗ | 0 | FAIL |
| 2010–11 | 12 | 22 | 15–18 | ✗ | 97/97 | 3/3 | ✗ | 0 | FAIL |
| 2009–10 | 12 | 22 | 16–19 | ✗ | 100/100 | 3/3 | ✗ | 0 | FAIL |
| 2008–09 | 12 | 22 | 15–19 | ✗ | 99/99 | 3/3 | ✗ | 0 | FAIL |

\* Expected games = `(teams − 1) × 2` for standard double round-robin.  
† 2019/20 COVID — season stopped early; unequal games expected.  
‡ Playoffs correctly absent (season voided before knockouts).

**Winner in DB:** None — all champions exist only in `competition-champions-catalog.ts` (UI hardcode).

---

## Root cause analysis

### 1. Standings ≠ fixtures (critical)

Sample cross-check (lowest `played` teams):

| Season | Team | Table P | Reg-season FT fixtures |
|--------|------|--------:|------------------------:|
| 2024–25 | Bath | 17 | **23** |
| 2024–25 | Harlequins | 17 | **22** |
| 2023–24 | Northampton | 17 | **21** |
| 2019–20 | Bath | 14 | **5** |

Standings and fixtures come from **different import pipelines** (SDMS/LiveSport standings build vs accumulated fixture imports) and were never reconciled.

2024–25 has **125 regular-season fixtures** in-window (expected **90** for 10 teams) — excess suggests cross-season leakage or non-league matches tagged as Premiership, not slug/external duplicates.

### 2. Season contamination

**2020/21:** 56 fixtures have `providerSnapshot.livesport.seasonId` pointing to **2019/20** (`dbfdd820…`). Confirms wrong-season import.

**2013/14:** 0 fixtures in `kickoffInSeason(2013)` window; 98 fixtures dated Oct 2014 sit in calendar overlap but belong to **2014/15** season window. Season never imported.

### 3. Playoffs in standings (partially fixed in code, not in DB)

`buildStandingsFromMatches` now excludes playoff rounds in import-sdk, but **existing standing_rows** were built before that fix and may still include playoff matches in `played`.

### 4. Calendar-year filtering (legacy bug)

Many code paths previously used `getFullYear() === startYear`, which mis-assigns Aug–Dec fixtures. Fixed in `listCompetitionFixtures` but historical data imported under wrong assumptions.

### 5. Known bad Flashscore URLs (do not use)

| Season | Issue |
|--------|-------|
| 2020/21 | User links pointed to 2021/22 paths — catalog corrected to 2020-2021 |
| 2015/16 | User links pointed to 2014/15 paths — catalog corrected to 2015-2016 |

Wikipedia must be primary source for repair.

### 6. Winner model missing

No `champion_team_id` on `competition_seasons`. UI reads hardcoded catalog — violates requirement.

### 7. Attendance never imported

`fixtures.attendance` column exists; 0 populated rows across all Premiership fixtures.

---

## Records to merge / retire

| Action | Detail |
|--------|--------|
| Retire | `2026–27` (`9a335031…`) — future catalog row, should not be active |
| Activate | `2025–26` should be `isActive=true` (current domestic season) |
| Import | `2013–14` — empty season, needs full Wikipedia import |
| Re-link | 56× 2020/21 fixtures with wrong snapshot seasonId |
| Rebuild | All `standing_rows` from Wikipedia regular-season tables |
| Re-import | Playoffs per season from Wikipedia knockout section |
| Populate | `champion_team_id` per season from confirmed champions list |

---

## Unresolved data gaps

1. **2013/14** — complete season missing  
2. **2019/20** — COVID-shortened season; unequal games are valid but table must document exception  
3. **2021/22** — 13 teams in standings (relegation/promotion timing — verify vs Wikipedia)  
4. **Fixture excess** — 2022–23 has 151 regular FT (11 teams → expect 110)  
5. **TBP / LBP / deductions** — not in schema; Wikipedia tables include these for modern seasons  
6. **Wikipedia import adapter** — does not yet parse season league tables / results / playoffs  

---

## Recommended repair plan (next phase)

### Phase 1 — Schema
- Migration: `competition_seasons.champion_team_id`, `fixtures.season_id`, `fixtures.stage`
- Migration: `standing_rows.try_bonus_points`, `losing_bonus_points`, `points_deduction`
- Migration: provenance fields (`source_url`, `source_provider`)

### Phase 2 — Season canonicalization
- Fix active season flags
- Backfill `fixtures.season_id` from `kickoffInSeason` + canonical season map
- Fix 2020/21 snapshot contamination

### Phase 3 — Wikipedia import
- Build `WikipediaPremiershipSeasonAdapter` (table, results, playoffs, attendance)
- Idempotent upsert per season

### Phase 4 — Per-season repair (2008–2026)
- Validate page title + winner + team count before import
- Rebuild standings from Wikipedia regular-season table only
- Import playoff fixtures with `stage=playoff`
- Set `champion_team_id`
- Import attendance where published

### Phase 5 — UI
- Read winner from DB, not catalog
- Playoffs from `stage=playoff` fixtures
- Full table columns (TBP, LBP, deductions)

---

## Audit tooling

```bash
npx tsx scripts/audit-premiership-seasons.ts
npx tsx scripts/audit-premiership-seasons.ts --json
npx tsx scripts/audit-premiership-deep.ts
```
