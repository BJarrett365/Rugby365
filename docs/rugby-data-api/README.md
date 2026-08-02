# Rugby Data API — Capture, Mapping & Client Foundation

**Status:** Bulk ingestion pipeline implemented (discover → import → enrich). Day sync remains for live score updates.  
**Captured:** 2026-07-10  
**Base URL (dev):** `https://cms-planetrugby-players-investigator-for-barrie.hneeds.com`  
**Config:** `RUGBY_DATA_API_BASE_URL`, `RUGBY_DATA_API_TOKEN` (server-only; never `NEXT_PUBLIC_*`)  
**Keys UI:** `/admin/keys/rugby-data`  
**Migration:** `0035_data_integration_foundation`

## Postman collection

Import these into Postman (or Bruno):

| File | Purpose |
|------|---------|
| [`Rugby.Union.Apis.postman_collection.json`](./Rugby.Union.Apis.postman_collection.json) | Full Rugby Union API collection (match, league, team, discovery, favourites) |
| [`Rugby.Union.Apis.postman_environment.json`](./Rugby.Union.Apis.postman_environment.json) | Environment variables for local or upstream base URL + token |

Set `rugby_data_api_base_url` to your Rugby365 app when testing locally:

```text
http://localhost:8080
```

The same paths are now served by Rugby365 at `/api/v1/rugby-union/*` (they proxy to the configured upstream provider).

Examples:

```text
GET http://localhost:8080/api/v1/rugby-union/teams
GET http://localhost:8080/api/v1/rugby-union/matches?type=all&date=2026-07-08
GET http://localhost:8080/api/v1/rugby-union/match/7581/info
```

Endpoint catalog: `apps/web/src/lib/rugby-data-api-endpoints.ts`  
Route handler: `apps/web/src/app/api/v1/rugby-union/[[...segments]]/route.ts`

## Bootstrap local data

Populate the database and capture all Rugby Data API samples in one go:

```bash
npm run bootstrap:data
```

This runs migrations, seeds demo data, captures 31 Rugby Union API samples to `docs/rugby-data-api/samples/`, imports Planet Rugby competitions + SDMS fixtures, and syncs Rugby Data scores/events onto matched fixtures.

## Bulk ingestion runbook

Discover all leagues, import competitions/teams/fixtures/standings, then enrich finished matches:

```bash
npm run import:rugby-data:discover
npm run import:rugby-data:all
npm run import:rugby-data:enrich
npm run import:rugby-data:coverage
```

Single league (Premiership sample id `104`):

```bash
tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-data-all.ts import-league --id=104
tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-data-all.ts enrich-matches --league=104 --limit=500
```

Admin UI: `/admin/keys/rugby-data` (bulk actions + job history) and `/admin/data-sources/rugby-data/mappings` (mapping review).

## Pull all feeds (raw) vs structured ingest

**Pull** stores every API response in `provider_raw_responses` (audit/replay).  
**Ingest** maps pulled data into CMS tables (`fixtures`, `teams`, `standing_rows`, etc.).

```bash
# Pull feeds into DB (rate-limited; full run can take hours)
npm run pull:rugby-data

# Limit scope while testing
npm run pull:rugby-data -- --league-limit=10 --date-sweep-days=14 --match-limit-per-league=20

# Generate what is NOT ingested + why (no API calls)
npm run pull:rugby-data:report
```

Reports: `docs/rugby-data-api/INGEST_GAP_REPORT.md` and `.json`

API: `GET /api/admin/integrations/rugby-data?view=ingest-gaps`  
Admin action: `PATCH` with `{ "action": "pull-feeds", "leagueLimit": 10 }`

Services:

- `apps/web/src/lib/data-integration-job-service.ts`
- `apps/web/src/lib/rugby-data-discovery-service.ts`
- `apps/web/src/lib/rugby-data-mapping-service.ts`
- `apps/web/src/lib/rugby-data-import-service.ts`
- `apps/web/src/lib/rugby-data-match-import-service.ts`
- `scripts/import-rugby-data-all.ts`
- `apps/web/src/lib/rugby-data-feed-pull-service.ts`
- `apps/web/src/lib/rugby-data-feed-catalog.ts`
- `apps/web/src/lib/rugby-data-ingest-gap-report.ts`
- `scripts/pull-rugby-data-all.ts`

## Re-capture

```bash
# Optional token (not required for current GET samples with browser UA)
export RUGBY_DATA_API_TOKEN='…'   # do not commit
export RUGBY_DATA_API_BASE_URL='https://cms-planetrugby-players-investigator-for-barrie.hneeds.com'

bash scripts/capture-rugby-data-api-samples.sh
python3 scripts/capture-prem-rugby-samples.py
```

Samples are stored under `docs/rugby-data-api/samples/`.

**Note:** Cloudflare returns 403 to default Python `urllib` User-Agent. Capture scripts use a browser UA (curl script) or set `User-Agent` explicitly.

## Primary competition sample

| Rugby365 concept | Primary API | ID |
|------------------|-------------|-----|
| Gallagher Premiership 2025–26 | Tournament **PREM Rugby** | `104` |
| Playoffs 2025–26 | Gallaghe Premiership Playoff | `203` |
| Bath | Team | `270` |
| Bath v Leicester (Round 18) | Match | `5370` |
