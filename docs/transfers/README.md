# Premiership Rugby Transfer Management

Transfer management in Rugby365 SDMS covers manual records, Wikipedia imports, player/team mapping, and career timeline history.

## Admin UI

- **Transfers hub:** `/admin/transfers`
  - Manual transfer form (player, teams, movement type, season, date, notes)
  - Wikipedia import (preview + full import, idempotent)
  - Player match review for low-confidence fuzzy matches
  - Club audit panel (squad vs transfers in/out, missing source, club conflicts)
  - Source column with confidence (High / Medium / Low) and clickable URLs
  - Status badges (Confirmed, Needs review, Missing source, etc.)
  - Search, filters (season, team direction, source, confidence, audit status), pagination (default 20), bulk delete
- **Player edit:** `/admin/players/[id]/edit` — Career timeline table
- **Team edit:** `/admin/teams/[id]/edit` — Players in/out grouped by season

## Movement types

| Type | Description |
|------|-------------|
| `permanent` | Standard club transfer |
| `loan` | Temporary move |
| `contract_extension` | Re-signing / extension |
| `released` | Released by club |
| `academy_promotion` | Promoted from academy |
| `retirement` | Player retired |
| `unknown` | Could not classify from source |

## Wikipedia import

Default audit season: **2026–27**. Imports add transfer history only — they never overwrite player current clubs.

Default source: [2026–27 Premiership Rugby transfers](https://en.wikipedia.org/wiki/List_of_2026%E2%80%9327_Premiership_Rugby_transfers)

Seasons **2013–14** through **2026–27** are available in the admin dropdown (`PREMIERSHIP_TRANSFER_SOURCES` in `premiership-transfer-constants.ts`).

All Wikipedia imports add **transfer history** only — they do not overwrite player current clubs (`PREMIERSHIP_TRANSFER_CLUB_UPDATE_SEASONS` is empty).

**API:** `POST /api/admin/transfers/import`

```json
{
  "url": "https://en.wikipedia.org/wiki/List_of_2026%E2%80%9327_Premiership_Rugby_transfers",
  "seasonLabel": "2026–27",
  "dryRun": true,
  "forcePlayerIds": { "import-key": "player-uuid" }
}
```

The importer is **idempotent**: each row has a stable `import_key`. Re-running updates existing records instead of duplicating them.

### Player matching

Before creating a player, the system scores candidates using:

- Full name (fuzzy / Levenshtein)
- Date of birth (when available)
- Nationality
- Current team
- Position

Thresholds:

- **≥ 86%** — auto-link to existing player
- **62–86%** — flagged for admin review (`pendingPlayerMatches`)
- **< 62%** — create new player (import only; never auto-creates during review band)

### Team matching

Teams are matched against existing SDMS teams using normalized names and Premiership aliases. Unmapped names produce warnings; admins can map manually via team records.

## Database

Migration `0014_transfer_management.sql` extends `player_transfers`:

- `movement_type`, `season_id`, `competition_id`
- `position_name`, `import_key` (unique), `source_url`, `created_at`

Also adds `transfer_import_logs` for import audit trails.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/transfers` | List with filters + pagination |
| POST | `/api/admin/transfers` | Create manual transfer |
| DELETE | `/api/admin/transfers?id=` | Delete one |
| POST | `/api/admin/transfers/bulk` | Bulk delete |
| POST | `/api/admin/transfers/import` | Wikipedia import |
| GET | `/api/admin/transfers/setup` | Page setup (teams, players, seasons) |
| GET | `/api/admin/transfers/club-audit` | Club squad vs transfer audit |
| POST | `/api/admin/transfers/match` | Preview player/team match |

## Tests

```bash
npm test -- transfer parse-transfers transfer-match transfer-filters premiership-transfers
```

Coverage includes Wikipedia parser, fuzzy player/team matching, filter parsing, and import idempotency keys.
