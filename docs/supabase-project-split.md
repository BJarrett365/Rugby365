# Supabase project split (Rugby365 + per-product cutovers)

**Date:** 2026-08-27 (updated: Shared → Rugby365 identity; Fixtures365 empty target deleted)  
**Org:** BJarrett365's Org (`edqhzxblfpxgodgodrsn`) — Pro plan  

## Hard rule: no cross-project files or data unless explicitly stated

**Default: do not cross products.** Rugby365 ≠ planetf1-live ≠ planet-sport-deck ≠ Fixtures ≠ Racing ≠ Greyhounds ≠ Teamtalk.

- Do **not** copy files, schemas, env, keys, or data between products unless the user **explicitly** asks for that cross-project work in the current request.
- Each product keeps its **own** Supabase project (or cutover target), `.env` / keys, and app wiring. Same org ≠ shared DB.
- Never write/migrate application data into the wrong project. Verify project id/URL before any insert, seed, or migration.
- Agents working in the Rugby365 repo touch **only** Rugby365 live (`oguqhyggjbefrhzdxomk`) unless told otherwise.

## Canonical Rugby365 (live data — former “365 Shared”)

| Field | Value |
|---|---|
| Name (target) | **Rugby365** |
| Name (current — rename **PENDING**) | `365 Shared (Rugby/Fixtures/Racing/Greyhounds/Teamtalk)` |
| Project id / ref | `oguqhyggjbefrhzdxomk` |
| URL | `https://oguqhyggjbefrhzdxomk.supabase.co` |
| Region | `eu-west-1` |
| Status | `ACTIVE_HEALTHY` — **holds all production rugby data** |

This project **is** Rugby365 for app wiring and docs. Project **ref does not change** when renamed in the dashboard; keep using `oguqhyggjbefrhzdxomk`.

### Schemas still on this DB (other products not cut over yet)

| Product | Schema | Approx content |
|---|---|---|
| Rugby365 | `public` (+ storage buckets `rugby365-*`) | ~128 tables (fixtures, players, ratings, etc.) |
| Fixtures | `fixtures365` | competitions, fixtures, results, standings, teams, site_settings |
| Racing | `racing365` | meetings, races, runners, tips |
| Greyhounds | `greyhounds365` | meetings, races, runners, tips, tip priors/outcomes |
| Teamtalk | `teamtalk` | transfers, players_from_transfers |

Do **not** drop other-product schemas from this DB until those products have cut over and you have explicit approval.

## Dashboard: rename Shared → Rugby365 (**PENDING** as of 2026-08-27)

**Renamed: no.** Agent could not change the display name programmatically.

| Method | Result |
|---|---|
| Supabase MCP | No `update_project` / rename tool (create / pause / restore / get / list only) |
| Management API `PATCH /v1/projects/{ref}` | Not attempted — no `SUPABASE_ACCESS_TOKEN` in env, `.env*`, keychain, or `supabase` CLI |
| CLI `supabase projects update` | `supabase` not installed; no login token |

Verified via MCP `list_projects` (2026-08-27): `oguqhyggjbefrhzdxomk` still named **`365 Shared (Rugby/Fixtures/Racing/Greyhounds/Teamtalk)`**. Empty duplicate `abmapnaxaswdqfmllrch` no longer appears in the org list (get returns permission error) — display name **Rugby365** should be free.

### Manual rename (required)

Direct link: [Project Settings → General](https://supabase.com/dashboard/project/oguqhyggjbefrhzdxomk/settings/general)

1. Open that URL (confirm ref is **`oguqhyggjbefrhzdxomk`**, not any other project).
2. Under **General** → **Project name**, replace the current name with exactly: `Rugby365`.
3. Click **Save**.
4. Confirm the org project list shows **Rugby365** for ref `oguqhyggjbefrhzdxomk`.

Ref/URL stay `oguqhyggjbefrhzdxomk.supabase.co` — only the display name changes. After rename, update this doc’s “Name (current)” row and mark rename complete.

## Empty duplicate Rugby365 — appears gone from org list

Earlier empty project `abmapnaxaswdqfmllrch` (created as Rugby365 with 0 tables) is **not** in MCP `list_projects` as of 2026-08-27 rename attempt; `get_project` returns permission denied. Treat as deleted or inaccessible — **do not recreate or point apps at it**. If it reappears in the dashboard, delete it before naming Shared `Rugby365`.

Do **not** point the Rugby365 app at `abmapnaxaswdqfmllrch`.

## Product cutover targets (empty — keep)

| Product | Project name | Project id / ref | URL | Region |
|---|---|---|---|---|
| Racing | **Racing365** | `iljljfzbvvbszwblifgl` | `https://iljljfzbvvbszwblifgl.supabase.co` | eu-west-1 |
| Greyhounds | **Greyhounds365** | `avgkozsweghlmfqlbjuu` | `https://avgkozsweghlmfqlbjuu.supabase.co` | eu-west-1 |
| Teamtalk | **Teamtalk** | `mbfcvdlshgudafbewfhq` | `https://mbfcvdlshgudafbewfhq.supabase.co` | eu-west-1 |

**Fixtures has no empty cutover project.** Former empty target **Fixtures365** (`angduibjwopweuoebehe`, created 2026-08-27) is **deleted** — verified absent from MCP `list_projects` (2026-08-27); `get_project` returns permission denied. Fixtures product data remains on Rugby365 in schema `fixtures365` until another cutover plan.

Cost: **$10/month per project** (Pro org). Empty duplicate `abmapnaxaswdqfmllrch` and empty **Fixtures365** `angduibjwopweuoebehe` no longer listed in org (2026-08-27); if either reappears, delete to avoid unused bill.

## Leave alone

| Project | Id | Notes |
|---|---|---|
| **planetf1-live** | `znnjjxlysnolofylwmke` | Isolated F1 project — do not touch |
| **Planet Sport Intelligence** | `quwzfiyscrbseftdxdii` | `INACTIVE` since before this split work; eu-west-2; created 2026-08-15. Warehouse for `planet-sport-deck` — **not** paused by Rugby365 agents. Org is Pro (no auto-pause); likely older Free-tier inactivity or a manual pause. Restore in dashboard if needed; leave alone for rugby cutover. |

## Fixtures365 empty cutover — deleted (2026-08-27)

Empty cutover project **Fixtures365** (`angduibjwopweuoebehe`) is **gone** from the org (MCP `list_projects` + `get_project` permission denied). Do **not** recreate it or point any app at that ref until a new Fixtures plan is agreed.

Fixtures data still lives in Rugby365 schema `fixtures365` on `oguqhyggjbefrhzdxomk`.

### Legacy lowercase fixtures365 (leave alone unless asked)

| Field | Value |
|---|---|
| Name | **fixtures365** |
| Id / ref | `svmcqarpecboxlnjomqm` |
| Status | `INACTIVE` (paused) |
| Region | `eu-west-1` |
| Created | 2026-07-27 |

Do **not** delete legacy `svmcqarpecboxlnjomqm` or live Rugby365 `oguqhyggjbefrhzdxomk` unless explicitly requested.

## Env mapping

### Rugby365 app (canonical — live DB)

```bash
SUPABASE_URL=https://oguqhyggjbefrhzdxomk.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://oguqhyggjbefrhzdxomk.supabase.co
SUPABASE_ANON_KEY=<from Rugby365 / oguqhyggjbefrhzdxomk dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from same project>
```

### Other products (cutover targets — still empty)

```bash
# Fixtures — no dedicated empty project; data remains on Rugby365 schema fixtures365
# Do not use deleted ref angduibjwopweuoebehe

# Racing app → Racing365 ONLY
SUPABASE_URL=https://iljljfzbvvbszwblifgl.supabase.co

# Greyhounds app → Greyhounds365 ONLY
SUPABASE_URL=https://avgkozsweghlmfqlbjuu.supabase.co

# Teamtalk app → Teamtalk ONLY
SUPABASE_URL=https://mbfcvdlshgudafbewfhq.supabase.co
```

**Do not point Rugby365 at** `abmapnaxaswdqfmllrch`, deleted `angduibjwopweuoebehe`, Racing/Greyhounds/Teamtalk, or planetf1-live.  
**Do not point** Racing/Greyhounds/Teamtalk apps at Rugby365 (`oguqhyggjbefrhzdxomk`) after their cutovers. Fixtures stays on Rugby365 until a new plan.

## Current Rugby365 wiring

| Location | Current target | Action |
|---|---|---|
| Runtime `SUPABASE_URL` / Admin → Keys → Supabase | `oguqhyggjbefrhzdxomk` (canonical Rugby365) | Keep |
| `apps/web/next.config.ts` image hostname | `oguqhyggjbefrhzdxomk.supabase.co` | Keep; empty `abmap…` host can be removed after that project is deleted |
| Sync scripts | Env/admin keys → same project | Writes go to live Rugby365 — correct |

## Safe cutover outline for *other* products (not executed)

1. Recreate schema on the correct empty product project only (Racing → Racing365, etc.). Fixtures has **no** empty target project after Fixtures365 delete — invent a new plan before any Fixtures cutover.
2. Verify target id/URL before any `INSERT`/`COPY`/sync.
3. Copy data from schemas still on Rugby365 (`fixtures365`, `racing365`, …); never cross-load.
4. Switch each product app’s env; smoke-test.
5. Only after verified cutover: ask for explicit approval to drop those schemas from Rugby365.

Rugby product data stays on `oguqhyggjbefrhzdxomk` — no migration to deleted empty projects.

## Verification checklist before any write

- [ ] User asked for this product (no cross-project work unless explicitly stated)  
- [ ] Product name matches intended project  
- [ ] Project id matches this doc  
- [ ] `SUPABASE_URL` host = `{ref}.supabase.co` for that product  
- [ ] Rugby365 app uses `oguqhyggjbefrhzdxomk` (not `abmapnaxaswdqfmllrch`)  
- [ ] Not `znnjjxlysnolofylwmke` (planetf1-live) or `quwzfiyscrbseftdxdii` (Planet Sport Intelligence)  
- [ ] Env/keys for this product only — never reused from another product  

