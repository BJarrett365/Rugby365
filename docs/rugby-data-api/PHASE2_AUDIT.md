# Rugby Data API — Phase 2 Audit Deliverables

Planning artifact only. No DB migrations. No production sync.

---

## 1. API Response Audit

### Capture summary

| Endpoint group | Sample files | HTTP | Auth used |
|----------------|--------------|------|-----------|
| Countries / leagues / search / news | `countries_list`, `country_leagues`, `search_bath`, `news_leagues` | 200 | none (browser UA) |
| Teams | `teams`, `team_243_*` | 200 | none |
| Matches by date | `matches_2026-07-08`, `matches_count_*` | 200 | none |
| Match core | `match_7581_*`, `prem_rugby_match_5370_*` | 200 | none |
| League PREM Rugby 104 | `league_104_prem_rugby_*` | 200 | none |
| Favourites / FCM | not captured | — | out of scope |

**Token:** Current GETs succeeded without `token` when using a browser User-Agent. Keep `RUGBY_DATA_API_TOKEN` support for environments that require it. Never log or expose the token.

### Envelope

Most endpoints:

```json
{ "status": 200, "message": "…", "data": … }
```

Match listing uses `{ status, data, metadata }`. Some include `tabs`, `pagination`, `live_team_ids`.

### ID formats observed

| Entity | Field(s) | Format | Example |
|--------|----------|--------|---------|
| Country (list) | `id`, `cid`, `fid` | int | Albania `id=11650`, `cid=8`, `fid=2` |
| Country (leagues) | `id`, `cid`, `fid` | int | England `id=48`, `cid=907`, `fid=60` |
| Rugby category | `rugbyCategory.id`, `fb_category_id` | int | England cat `48` / fb `907` |
| Tournament / league | `id`, `sl`, `lid`, `category_id` | int + slug | PREM Rugby `104`, `lid=21709` |
| Season | `sea` string only | `YYYY/YY` or `YYYY` | `2025/26`, `2026` |
| Team | `id`, `sg`, `nm` | int + slug | Bath `270`, `bath-270` |
| Match | `id`, `aimId` | int; `aimId` often null | `5370` |
| Player | `id` / `player_id`, `sg`, `nm`/`name` | int + slug | Beno Obano `5408` |
| Lineup row | `or`, `sno`, `isb`, `pos` | order/shirt/bench | `pos` often empty |
| Sub event | `pin_id`/`pout_id` or `piId`/`poId` | int | — |

### Key payload notes

- **Scores:** `ft`, `ht`, `et`, `ps`, `cfs`, `mins`, `st`/`cp` status strings (`Finished`, etc.).
- **Team stats:** sectioned object (`Match Summary`, `Attack`, `Defence`, `Kicking`, `Possession`, `Set piece`, `Error`) with `{ ht, at }` string values (`"-"` for empty).
- **Player stats:** pivoted by type; each row has `match_id`, `player_id`, `type`, `group`, `value`, `is_home`, `player`.
- **Lineups:** 15 starters + substitutions; `pos` blank in Prem sample — shirt `sno` / order `or` are reliable.
- **Events (info):** Try, Conversion, SUB, etc. with minute, score, player ids/names.
- **Tables:** played/won/lost/draw/points/form; bonus-point columns not clearly separated in Prem sample.
- **No venue / referee / coach / DOB / height / weight / images** in captured payloads.
- **Naming:** 2025/26 Premiership appears as **PREM Rugby** (`104`), not “Gallagher Premiership” (that name is `47` / `2024/25`).

---

## 2. Entity Relationship Map

```
Country (cid / rugbyCategory)
  └── Tournament / League (id, sea string, category_id, lid)
        ├── Teams (team.id)  [via /league/{id}/teams]
        ├── Standings rows (tid → team.id)
        └── Matches (match.id, tournament_id)
              ├── competitors.htid / atid → Team
              ├── Lineup home_team.id / away_team.id → Team
              │     └── lineup[].player_id → Player
              │     └── substitutions pin_id / pout_id → Player
              ├── Events.pl.id / piId / poId → Player
              ├── Team stats (home/away aggregates; no team id in section payload — use match competitors)
              ├── Player stats.player_id → Player
              └── Match table (optional pool/league context)
```

**Season:** not a first-class ID. Attach Rugby365 `competition_seasons` via tournament `sea` + competition mapping.

**aimId:** present but null in samples — possible future Opta/SportCC bridge; do not rely on it yet.

---

## 3. Field Mapping Matrix

Legend: **P1** = primary API · **Exact** = clear map · **Missing** = not in API · **New** = API has it, Rugby365 weak/absent · **Conflict** = shape/name clash · **Dup risk** = identity hazard

### Competitions

| Primary field | Rugby365 | Status |
|---------------|----------|--------|
| `league.id` / tournament `id` | `competitions` + mapping | Exact (via mapping layer) |
| `nm` / `name` | `competitions.name` | Exact (normalise PREM Rugby ↔ Premiership) |
| `sl` / `sg` | `slug` / `planet_rugby_slug` | Partial |
| `category_id` / country | country / region fields | New / enrich |
| `lid` | unknown secondary code | New (store in mapping extras) |
| `sea` | `competition_seasons.label` | Conflict (`2025/26` vs `2025–26`) |

### Seasons

| Primary | Rugby365 | Status |
|---------|----------|--------|
| `sea` string | `competition_seasons.label` | Exact after normalisation |
| season entity id | — | Missing in API |

### Teams

| Primary | Rugby365 | Status |
|---------|----------|--------|
| `id` | mapping → `teams.id` | Exact |
| `nm` / `name` | `teams.name` | Exact + alias risk (Bath, Gloucester, Newcastle Red Bulls) |
| `sg` | `teams.slug` | Partial |
| `cn`, `gender`, `mang` | weak/absent | New / ignore until needed |

### Players

| Primary | Rugby365 | Status |
|---------|----------|--------|
| `player_id` / `id` | mapping → `players.id` | Exact |
| `nm` / `name` | `players.name` | Exact + reverse-name / nickname dup risk |
| `sg` | `players.slug` | Partial |
| DOB, nationality, height, weight, image | existing columns | Missing in P1 → secondary |
| position name | `position_name` | Weak (`pos` often empty) → derive from `sno` or secondary |

### Matches / scores

| Primary | Rugby365 | Status |
|---------|----------|--------|
| `id` | mapping → `fixtures.id` | Exact |
| `dt` | `kickoff_at` | Exact (confirm TZ — appears local wall time) |
| `st` / `cp` | `status` | Conflict (string enums vs Rugby365 statuses) |
| `ft` / `cfs` | `home_score` / `away_score` | Exact (parse `24-22`) |
| `ht` | period scores | New (needs score-period storage or snapshot) |
| `et` / `ps` | period scores | New |
| `ro` | `round` | Exact |
| `mins` | `match_minute` | Exact |
| `tournament_id` | `competition_id` via mapping | Exact |
| `htid` / `atid` | `home_team_id` / `away_team_id` | Exact |
| venue | `venue_id` / `venue_name` | Missing |
| referee | `referee_id` / `referee_name` | Missing |
| `aimId` | — | New optional |
| `planet_rugby_url` / `sport365_url` | existing | Keep secondary |

### Lineups

| Primary | Rugby365 | Status |
|---------|----------|--------|
| lineup[] | `fixture_players` | Exact |
| `sno` | `jersey_number` | Exact |
| `isb` / bench via substitutions | `squad_role` | Exact |
| `or` | order | New / useful |
| `pos` | `position_name` | Weak (often empty) |
| cards / rugby_goals on player | events / scoring | Partial |

### Team stats

| Primary section/metric | Rugby365 | Status |
|------------------------|----------|--------|
| tries, goals, drop_goals, metres, tackles, cards | `team_match_stats` summary + `sections` | Exact (map goals→conversions carefully) |
| Possession %, kicking metres, clean breaks, etc. | `sections` jsonb | Exact |
| Half scopes | — | Missing in P1 sample (totals only) |

### Player stats

| Primary type | Rugby365 | Status |
|--------------|----------|--------|
| Minutes played | `minutes_played` | Exact |
| Tries, Try assists, Passes, Offloads, Metres, Tackles | performance columns | Exact |
| Goals / Penalty goals / Missed goals | conversions / penalties | Conflict (naming: Goals ≠ clear conversion) |
| Missed tackles, cards, kick metres | columns / `extras` | Exact / extras |
| SportCC codes (MNP, TRI, …) | — | Not in P1 — keep secondary mapping later |

### Standings

| Primary | Rugby365 | Status |
|---------|----------|--------|
| pos, mt, wo, lo, dr, pts, LFM | `standing_rows` | Exact |
| sc/cc/df (match-table variant) | PF/PA/PD | Exact where present |
| Bonus points explicit | competition rules / derived | Partial / conflict |

### Fields P1 can now power (were secondary)

Competitions, teams (core), matches, scores, status, rounds, lineups, team match stats, player match stats, league tables, match events (basic), daily match lists.

### Still secondary-powered

Venues, referees, coaches, transfers, player bios/DOB/body metrics/images, commentary, rankings, historic seasons outside API, club official squads, Wikipedia content.

---

## 4. Provider Gap Matrix

| Data need | Rugby Data API (P1) | SDMS | Sport365 | Wikipedia | RugbyPass | Club sites | World Rugby | Manual CMS |
|-----------|---------------------|------|----------|-----------|-----------|------------|-------------|------------|
| Competitions | **Primary** | Enrich codes/URLs | — | Historic names | — | — | — | Aliases |
| Seasons | String only | Season sync | — | Historic labels | — | — | — | Normalise labels |
| Teams | **Primary** | Enrich | Enrich | Aliases | — | — | — | Aliases |
| Players identity | **Primary IDs** | Enrich | Enrich | Names | Profile IDs | Squad names | — | Merge/dedupe |
| Player bio/DOB/size/image | Gap | Partial | — | **Fill** | **Fill** | Partial | — | Edit |
| Matches/fixtures | **Primary** | Enrich URLs/events | Live/enrich | Historic | — | — | — | Create rare |
| Scores/status | **Primary** | Enrich | Live clock | — | — | — | — | Override reviewed |
| Lineups | **Primary** | Enrich positions | Enrich | — | — | Official squads | — | Edit |
| Team stats | **Primary** | Gap-fill / audit | — | — | — | — | — | Edit |
| Player stats | **Primary** | Gap-fill / audit | — | — | — | — | — | Edit |
| Standings | **Primary** | Audit | — | Historic | — | — | — | — |
| Match events | **Primary (basic)** | Enrich | **Live/detail** | — | — | — | — | Manual commentary events |
| Venues | Gap | Names | Names | **Fill** | — | — | — | Edit |
| Referees | Gap | Names | Names | **Fill** | — | — | — | Edit |
| Coaches | Gap | — | — | **Fill** | — | — | — | Edit |
| Transfers | Gap | — | — | **Primary for transfers** | — | — | — | Edit |
| Commentary | Gap | — | Triggers | — | — | — | — | **Engine + operator** |
| Rankings | Gap | — | — | — | — | — | **Primary** | — |
| News | Optional | — | — | — | — | — | — | Editorial |

**Overwrite rule (locked):** P1 wins when present. P2 fill-empty + conflict review only.

---

## 5. Proposed Mapping Layer

### Do not replace existing columns

Keep `teams.external_provider_id`, `fixtures.external_match_id`, RugbyPass columns, URLs, `provider_snapshot`.

### Add (when migration approved later)

**`provider_entity_mappings`**

| Column | Purpose |
|--------|---------|
| `id` uuid PK | |
| `provider` text | `rugby_data` (P1), `sdms`, `sport365`, `wikipedia`, `rugbypass`, … |
| `entity_type` text | `country`, `competition`, `season`, `team`, `player`, `match`, `venue`, `referee`, `coach` |
| `external_id` text | Primary numeric IDs as strings (`"104"`, `"270"`, `"5370"`) |
| `rugby365_id` uuid | FK-like reference to local entity |
| `status` text | `UNMAPPED`/`SUGGESTED`/`CONFIRMED`/`CONFLICT`/`IGNORED` |
| `confidence` int | 0–100 rule-based |
| `match_reason` text/jsonb | |
| `external_label` text | Cached name/slug |
| `extras` jsonb | e.g. `lid`, `sea`, `sg`, `aimId` |
| `last_checked_at`, `confirmed_at`, `confirmed_by` | |
| Unique `(provider, entity_type, external_id)` | |
| Index `(entity_type, rugby365_id, provider)` | |

**Optional later:** `provider_raw_snapshots` for non-fixture payloads (league header, search). Until then, store match-level P1 blobs under `fixtures.provider_snapshot.rugby_data`.

### Resolve order

1. Confirmed `rugby_data` mapping  
2. Primary external id on re-fetch  
3. Normalised name + competition/season context  
4. Token-sort / nickname identity helpers  
5. Secondary crosswalk (known SDMS/Sport365 → suggest P1)  
6. Manual Mapping Review  

### Sync policy (future)

1. Upsert from P1 into core fields when mapping CONFIRMED  
2. Never delete secondary IDs  
3. P2 enrich only null/empty fields  
4. Conflicts → queue, not silent overwrite  

---

## 6. Proposed CMS Mapping Review

**Route (proposed):** `/admin/data-sources/rugby-data/mappings`  
**Style:** existing CMS only (`PageHeader`, `cms-btn`, tables, filters) — no redesign.

### List filters

Provider (default `rugby_data`) · Entity type · Status · Competition · Search · Confidence band

### Columns

Provider · Entity · External ID · External label · Suggested Rugby365 record · Confidence · Reason · Conflict · Status · Last checked

### Actions

Confirm · Change mapping · Search SDMS · Create new (gated) · Ignore · Mark conflict · Open source JSON (server-fetched)

### Confidence (non-AI)

| Band | Rule |
|------|------|
| 95–100 | Exact confirmed ID |
| 80–94 | Exact normalised name + same competition + unique |
| 60–79 | Strong alias / nickname / token-sort + context |
| 40–59 | Name-only unique |
| &lt;40 | Ambiguous → manual |

AI may suggest copy only; never auto-confirm players or create competitions.

---

## 7. Exact Build Plan (for approval)

### Phase 2b — complete (this phase)

- [x] Sample capture scripts + saved JSON  
- [x] Response / relationship / field / gap audit  
- [x] Mapping layer + CMS review design  
- [x] Env placeholders for base URL + token  

### Phase 3 — implement after approval (still no production bulk sync until signed off)

1. **Server client** `rugby-data-api-client`  
   - Reads `RUGBY_DATA_API_BASE_URL` + `RUGBY_DATA_API_TOKEN`  
   - Browser UA / proper headers; timeout; no token logging  
2. **Migration:** `provider_entity_mappings` only (additive)  
3. **Admin Mapping Review UI** (existing CMS styles)  
4. **Read-only preview APIs** (parse/compare, no writes)  
5. **Pilot mapping:** England PREM Rugby `104` + 10 clubs + sample matches (confirm only)  
6. **Pilot apply job (gated):** single match upsert from P1 behind explicit admin action  
7. **Secondary enrich pass:** fill-empty from SDMS/Sport365/Wiki/RugbyPass  
8. **Conflict queue**  
9. **Expand** to full PREM Rugby season, then other comps  
10. **Update dedupe preference** when P1 match id present  

### Explicit non-goals until later approval

- Production bulk sync of all sports  
- Removing SDMS/Sport365/Wikipedia/RugbyPass  
- Renaming existing IDs/columns  
- CMS visual redesign  
- Favourites/FCM  
- Scoped production API key cutover (planned later)  

---

## Sample inventory

See `docs/rugby-data-api/samples/` (core endpoints + PREM Rugby `104` / match `5370`).
