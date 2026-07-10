# R&D Workstream 1 — Historical Rugby Competition Data Normalisation

**Last updated:** 2026-07-08

## Technical uncertainties

- Duplicate season definitions (slug vs year vs deprecated)
- Cross-calendar season matching (season ≠ calendar year)
- Fixture-to-season assignment / calendar leaks
- Historic uneven games played (valid exceptions)
- Inconsistent Wikipedia page structures (Teams vs Participating teams)
- Sparse Rugbybox / fixture markup (especially 2000–04)
- Progressive completeness (table-first vs full match data)

## Current position

- Catalog: **1987/88 → 2025/26 (39 seasons)** in champions catalog + wiki URLs
- API audit 1987–2007: complete (read-only)
- DB: season shells 1987–2007 **empty** (no standings)
- DB: 2008–2021 tables look one-row-per-team; **2022–2025 duplicate standings**
- Aborted import loops (2018–2025 / 2019–2025): stopped for 429 pile-up — **do not restart**

## Experiments

See `docs/rd/experiments/EXP-HIST-001_wikipedia-api-1987-2007.md` and audit files under `docs/audits/`.

## Next actions (ordered)

1. Canonical season map report (A1) — read-only SQL/script  
2. Duplicate standings repair 2022–25 (A3)  
3. Calendar-leak fixture sample + repair (A2)  
4. Minimum historic import 1987–2007 (season + champion + table + clubs)  
5. Display rules: hide empty sections; never fake zeros  

## Decision log

| Date | Decision |
|------|----------|
| 2026-07-08 | Prefer API audit over DB import for 1987–2007 until canonical structure safe |
| 2026-07-08 | Uneven games / missing coaches = valid historic exception, not fail |
| 2026-07-08 | No broad modern re-import |
