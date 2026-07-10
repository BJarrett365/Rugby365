# Premiership Wikipedia Season Import — 8 July 2026

## What was built

- **Parser (import-sdk):** `packages/import-sdk/src/providers/wikipedia/season/`
  - MediaWiki API fetch with retries
  - Premiership sports-table + Rugbybox + playoff parsing
- **Import service:** `apps/web/src/lib/wikipedia-season-import-service.ts`
- **Bulk script:** `npx tsx scripts/import-wikipedia-premiership-seasons.ts`
- **Admin UI:** `/admin/wikipedia/season-import`
- **API:** `POST /api/admin/wikipedia/season-import` (`analyse` | `import`)

## Import result (all 18 seasons)

| Season | Champion (DB) | Teams | P | Status |
|--------|---------------|------:|--:|--------|
| 2008–09 | Leicester Tigers | 12 | 22 | Imported |
| 2009–10 | Leicester Tigers | 12 | 22 | Imported |
| 2010–11 | Saracens | 12 | 22 | Imported |
| 2011–12 | Harlequins | 12 | 22 | Imported |
| 2012–13 | Leicester Tigers | 12 | 22 | Imported |
| 2013–14 | Northampton Saints | 12 | 22 | Imported (was empty) |
| 2014–15 | Saracens | 12 | 22 | Imported |
| 2015–16 | Saracens | 12 | 22 | Imported |
| 2016–17 | Exeter Chiefs | 12 | 22 | Imported |
| 2017–18 | Saracens | 12 | 22 | Imported |
| 2018–19 | Saracens | 12 | 22 | Imported |
| 2019–20 | Exeter Chiefs | 12 | 22 | Imported (COVID notes remain) |
| 2020–21 | Harlequins | 12 | 22 | Imported |
| 2021–22 | Leicester Tigers | 13 | 24 | Imported |
| 2022–23 | Saracens | 11 | 20 | Imported |
| 2023–24 | Northampton Saints | 10 | 18 | Imported |
| 2024–25 | Bath Rugby | 10 | 18 | Imported |
| 2025–26 | Northampton Saints | 10 | 18 | Imported |

All seasons have:

- `champion_team_id` set
- `wikipedia_source_url` set
- Complete overall standings from Wikipedia (equal games played within each season)
- Playoff fixtures stage-tagged (`semi_final` / `final`)
- Attendance filled where Wikipedia provided it

## Remaining known gaps

- Some seasons still have **extra legacy LiveSport fixtures** beyond Wikipedia’s regular-season count (especially 2008–11, 2016, 2018–22). Tables now come from Wikipedia; fixture cleanup / orphan retirement is a follow-up.
- 2020–21 still shows extra playoff-stage rows from earlier contamination (9 vs expected 3).
- 2019–20 Wikipedia published a completed 22-game table; real season was COVID-interrupted — document as Wikipedia source, not “force match”.
- Admin UI supports Analyse → Import for one season; bulk run remains via script.
- Coaches section on season pages not yet imported (schema already supports `team_coaching_staff`).

## Commands

```bash
# Analyse / import one season
npx tsx scripts/import-wikipedia-premiership-seasons.ts --year=2024

# All seasons
npx tsx scripts/import-wikipedia-premiership-seasons.ts --from=2008

# Audit
npx tsx scripts/audit-premiership-seasons.ts
```
