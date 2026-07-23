# Rugby Data API — Capture, Mapping & Client Foundation

**Status:** Phase 2 audit complete. Phase 2–3 foundation in code (mapping tables, client, raw capture). No production bulk sync.  
**Captured:** 2026-07-10  
**Base URL (dev):** `https://cms-planetrugby-players-investigator-for-barrie.hneeds.com`  
**Config:** `RUGBY_DATA_API_BASE_URL`, `RUGBY_DATA_API_TOKEN` (server-only; never `NEXT_PUBLIC_*`)  
**Keys UI:** `/admin/keys/rugby-data`  
**Migration:** `0035_data_integration_foundation`

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
