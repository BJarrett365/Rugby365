# Scraped Rugby World Cup archive

Source URLs (requested):

- Ultimate Rugby tables/results/fixtures: `https://www.ultimaterugby.com/rugby-world-cup-{year}/…`
- Official past tournaments: `https://www.rugbyworldcup.com/2027/en/past-tournaments/{year}`

Broader ingest source catalog (unions, comps, Wikipedia stats, player DBs, news):

- [`../source-catalog.json`](../source-catalog.json)

## Refresh

```bash
npm run scrape:rwc
npm run import:scraped:rwc
npm run scrape:rwc:wiki-stats
npm run import:rwc:wiki-stats
npm run import:rwc:opta-leaders
```

## Layout

- `index.json` — competition-level summary
- `{year}/tournament.json` — parsed pools, knockouts, match links, metadata
- `{year}/*.html` — raw HTML snapshots
- `generated-pool-catalog.ts.fragment` — pool memberships for `rugby-world-cup-pools.ts`
- `../wikipedia/rugby-world-cup-statistics/{year}.json` — Wikipedia statistics scrape

## Notes

- **2019 typhoon:** World Rugby’s official tables show some Pool B/C teams with **P=3** (cancelled matches). Ultimate Rugby lists **P=4** with the same points. Import prefers Ultimate Rugby when W/D/L columns exist.
- Match **events / referees / coaches** on Ultimate Rugby match pages are largely app/JS-gated; capture match URL inventory in `tournament.json` for follow-up (Wikipedia/SDMS enrich).
- **2027** pool draw is in code (`rugby-world-cup-pools.ts`); official/UR HTML did not expose fillable pool tables yet (pre-tournament).
- Wikipedia season pages hold fixtures; **`{year}_Rugby_World_Cup_statistics`** pages hold try/points boards and occasional individual tackle records. Full Opta-style metre/carry boards are not on Wikipedia — use Opta published leaders + SDMS (2023).
