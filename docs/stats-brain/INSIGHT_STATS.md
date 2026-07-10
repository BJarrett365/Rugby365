# Insight Stats — specification

**Part of:** [Rugby365 Stats Brain](./README.md)  
**CMS route:** `/admin/insight-stats`  
**Status:** Plan

---

## 1. Overview

Insight Stats is the **master system** for creating, reviewing and publishing rugby statistics insights across the entire Rugby365 database.

It is intentionally **not** nested under Players, Teams, Matches or any other entity admin area. Entity pages only **display** linked, approved insights via shared publishing components.

---

## 2. CMS: `/admin/insight-stats`

### 2.1 Top-level separation

| Area | Route | Role |
|------|-------|------|
| Insight Stats (master) | `/admin/insight-stats` | Create, manage, approve, publish all insights |
| Players | `/admin/players` | Player CRUD — shows linked insights read-only |
| Coaches | `/admin/coaches` | Coach CRUD — shows linked insights read-only |
| Teams | `/admin/teams` | Team CRUD — shows linked insights read-only |
| Matches | `/admin/matches` | Match CRUD — shows linked insights read-only |
| Competitions | `/admin/competitions` | League CRUD — shows linked insights read-only |
| Venues | `/admin/venues` | Stadium CRUD — shows linked insights read-only |
| Referees | `/admin/referees` | Referee CRUD — shows linked insights read-only |

### 2.2 CMS features

| Feature | Description |
|---------|-------------|
| View all | Paginated table with filters (see §2.3) |
| Create manual | Form with text, categories, entity linker |
| Edit | Full edit while draft or pending; limited edit when published |
| Approve | `pending_review` → `approved` |
| Reject | `pending_review` → `rejected` (reason required) |
| Publish | `approved` → `published` (sets `published_at`) |
| Unpublish | `published` → `archived` |
| Pin | Boolean flag; pinned insights sort first on entity widgets |
| Link entities | Attach one insight to many entities with relationship types |
| Generate | Trigger Stats Brain detectors for selected scope |
| Audit log | Full history per insight |

### 2.3 Filters (list view)

| Filter | Parameter |
|--------|-----------|
| Entity type | `entityType` (via join on `insight_stat_entities`) |
| Match | `matchId` |
| Team | `teamId` |
| Player | `playerId` |
| Coach | `coachId` |
| Referee | `refereeId` |
| Stadium | `stadiumId` (venues table) |
| Competition | `competitionId` |
| Season | `seasonId` |
| Stat type | `statType` |
| Insight category | `insightCategory` |
| Interest score | `interestScoreMin` |
| Status | `status` |
| Pinned | `pinned` |
| Search | `q` (title, short_text) |
| Date range | `createdFrom`, `createdTo` |

---

## 3. Data model

### 3.1 `insight_stats`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `title` | `text` NOT NULL | Headline, ≤120 chars recommended |
| `short_text` | `text` NOT NULL | Social / ticker / card teaser |
| `long_text` | `text` | Article paragraph; optional |
| `stat_type` | `text` NOT NULL | Machine key, e.g. `team_home_form`, `referee_discipline_leader` |
| `insight_category` | `text` NOT NULL | See §5 |
| `entity_scope` | `text` NOT NULL | Primary scope: `player` \| `coach` \| `team` \| `match` \| `competition` \| `season` \| `referee` \| `stadium` \| `crowd` \| `country` \| `transfer` \| `ranking` \| `head_to_head` \| `historical` \| `milestone` |
| `date_range` | `jsonb` | `{ "from": "2019-01-01", "to": "2026-03-31", "label": "since 2019" }` |
| `season_id` | `uuid` FK → `competition_seasons` | Optional shortcut |
| `competition_id` | `uuid` FK → `competitions` | Optional shortcut |
| `match_id` | `uuid` FK → `fixtures` | Optional shortcut |
| `confidence_score` | `real` | 0.0–1.0 |
| `interest_score` | `integer` | 0–100 |
| `source_data` | `jsonb` NOT NULL DEFAULT `{}` | Snapshot of numbers used |
| `source_query` | `jsonb` | Detector id, SQL fingerprint, input params |
| `status` | `text` NOT NULL DEFAULT `draft` | See §3.5 |
| `pinned` | `boolean` NOT NULL DEFAULT `false` | |
| `expires_at` | `timestamptz` | Optional; live-match insights |
| `created_by` | `text` | `system:stats-brain` or admin user id |
| `approved_by` | `text` | |
| `published_at` | `timestamptz` | |
| `created_at` | `timestamptz` NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now() | |

**Indexes (planned):**
- `(status, published_at DESC)` — public feed
- `(stat_type, entity_scope)` — dedup
- `(interest_score DESC)` WHERE `status = 'published'`
- `(competition_id, season_id)` — competition hub
- `(match_id)` WHERE `match_id IS NOT NULL`

### 3.2 `insight_stat_entities`

Many-to-many link between insights and CMS entities.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `insight_stat_id` | `uuid` FK → `insight_stats` ON DELETE CASCADE | |
| `entity_type` | `text` NOT NULL | See §3.3 |
| `entity_id` | `uuid` NOT NULL | FK target depends on `entity_type` |
| `relationship_type` | `text` NOT NULL DEFAULT `primary` | See §3.4 |
| `label` | `text` | Optional display override |
| `sort_order` | `integer` NOT NULL DEFAULT 0 | |

**Unique:** `(insight_stat_id, entity_type, entity_id, relationship_type)`

**Indexes:**
- `(entity_type, entity_id)` — entity page lookups
- `(insight_stat_id)`

### 3.3 Supported `entity_type` values

| `entity_type` | Resolves to |
|---------------|-------------|
| `player` | `players.id` |
| `coach` | `coaches.id` |
| `team` | `teams.id` |
| `match` | `fixtures.id` |
| `competition` | `competitions.id` |
| `season` | `competition_seasons.id` |
| `referee` | `referees.id` |
| `stadium` | `venues.id` |
| `crowd` | Synthetic: `entity_id` = `fixtures.id` (attendance tied to match) |
| `country` | Synthetic: `entity_id` = `teams.id` (national team) or future `countries` table |
| `transfer` | `transfers.id` |
| `ranking` | `world_ranking_snapshots.id` or row id |

### 3.4 `relationship_type` values

| Value | Meaning |
|-------|---------|
| `primary` | Main subject of the insight |
| `secondary` | Supporting subject (e.g. opponent in H2H) |
| `comparison` | Benchmark entity (“vs league average”) |
| `source` | Data source (e.g. match that set the record) |
| `context` | Background (competition, season, venue) |

### 3.5 `status` values

| Status | Visible on site | Editable |
|--------|-----------------|----------|
| `draft` | No | Full |
| `pending_review` | No | Full |
| `approved` | No (until published) | Full |
| `published` | Yes | Limited (text only, creates audit entry) |
| `rejected` | No | Can reopen to draft |
| `archived` | No | Read-only |

### 3.6 `insight_stat_tags`

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `insight_stat_id` | `uuid` FK |
| `tag` | `text` NOT NULL |
| `tag_type` | `text` DEFAULT `free` — `free` \| `controlled` |

Controlled tag examples: `premiership`, `six-nations`, `world-cup`, `sell-out`, `comeback`.

### 3.7 `insight_stat_audit_log`

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `insight_stat_id` | `uuid` FK |
| `action` | `text` — `created`, `updated`, `approved`, `rejected`, `published`, `archived`, `pinned` |
| `actor` | `text` |
| `before` | `jsonb` |
| `after` | `jsonb` |
| `note` | `text` |
| `created_at` | `timestamptz` |

---

## 4. Example records

### 4.1 Home form

```json
{
  "title": "Leeds on a roll at Headingley",
  "short_text": "Leeds have won 5 of their last 6 home games at Headingley.",
  "long_text": "Leeds' strong run at Headingley continues — they have taken five wins from their last six Premiership home fixtures at the stadium.",
  "stat_type": "team_home_form",
  "insight_category": "Form",
  "entity_scope": "team",
  "confidence_score": 0.95,
  "interest_score": 72,
  "source_data": { "wins": 5, "played": 6, "venue": "Headingley" }
}
```

**Entities:**

| entity_type | relationship_type | Example |
|-------------|-------------------|---------|
| team | primary | Leeds |
| stadium | context | Headingley |
| competition | context | Premiership |

### 4.2 Referee discipline

```json
{
  "title": "Premiership's most card-happy referee",
  "short_text": "Referee X has awarded more yellow cards than any other referee in this season's Premiership.",
  "stat_type": "referee_discipline_leader",
  "insight_category": "Discipline",
  "entity_scope": "referee"
}
```

**Entities:** referee (primary), competition (context), season (context)

### 4.3 Attendance record

```json
{
  "title": "Murrayfield's biggest Scotland crowd since 2019",
  "short_text": "This was the largest crowd for a Scotland match at Murrayfield since 2019.",
  "stat_type": "stadium_attendance_record",
  "insight_category": "Attendance",
  "entity_scope": "stadium",
  "date_range": { "from": "2019-01-01", "label": "since 2019" }
}
```

**Entities:** team Scotland (primary), stadium Murrayfield (context), match (source), crowd via match attendance in `source_data`

---

## 5. Insight categories

Fixed vocabulary for `insight_category`:

1. Record  
2. Streak  
3. Milestone  
4. Ranking  
5. Comparison  
6. Head-to-head  
7. Form  
8. Venue  
9. Attendance  
10. Discipline  
11. Tactical  
12. Historical  
13. Live match  
14. Preview  
15. Post-match  

---

## 6. Stats Brain (`statsBrain`)

### 6.1 Service responsibilities

1. Run detectors against the database for a given scope.
2. Render candidate `title`, `short_text`, `long_text` from templates.
3. Compute `confidence_score` and `interest_score`.
4. Attach `source_data` and `source_query`.
5. Create `insight_stats` row as `draft` or `pending_review`.
6. Insert `insight_stat_entities` rows.
7. Dedup against existing insights.

### 6.2 Detector registry

Each detector exports:

```ts
type InsightDetector = {
  id: string;                    // e.g. "team.home_form_last_n"
  entityScope: EntityScope;
  statType: string;
  defaultCategory: InsightCategory;
  run: (ctx: DetectorContext) => Promise<InsightCandidate[]>;
};
```

### 6.3 Detectors by entity

#### Players
| Detector | stat_type | Category |
|----------|-----------|----------|
| Try tally / rank | `player_tries_season` | Ranking |
| Tackle leader | `player_tackles_leader` | Ranking |
| Carry metres milestone | `player_metres_milestone` | Milestone |
| Points streak | `player_points_streak` | Streak |
| Card count | `player_cards_season` | Discipline |
| Career cap milestone | `player_cap_milestone` | Milestone |

#### Coaches
| Detector | stat_type | Category |
|----------|-----------|----------|
| Win rate | `coach_win_rate` | Comparison |
| First match in charge | `coach_debut` | Milestone |
| Tenure record | `coach_tenure_record` | Record |
| H2H vs coach | `coach_h2h_coach` | Head-to-head |

#### Teams
| Detector | stat_type | Category |
|----------|-----------|----------|
| Last N form | `team_form_last_n` | Form |
| Home record | `team_home_form` | Form |
| Away record | `team_away_form` | Form |
| Points for trend | `team_scoring_trend` | Tactical |
| Points against trend | `team_defence_trend` | Tactical |
| Discipline | `team_discipline_season` | Discipline |
| Set-piece (from match stats) | `team_set_piece` | Tactical |
| H2H vs team | `team_h2h` | Head-to-head |

#### Matches
| Detector | stat_type | Category |
|----------|-----------|----------|
| Biggest win margin | `match_biggest_win` | Record |
| Closest finish | `match_closest` | Record |
| Highest combined score | `match_highest_scoring` | Record |
| Comeback win | `match_comeback` | Historical |
| Late winning score | `match_late_score` | Live match |
| First time since | `match_first_time_since` | Historical |

#### Competitions
| Detector | stat_type | Category |
|----------|-----------|----------|
| Season leader (tries, points) | `comp_season_leader` | Ranking |
| Competition record | `comp_record` | Record |
| Winning streak | `comp_team_streak` | Streak |
| Historic comparison | `comp_historic_compare` | Historical |

#### Referees
| Detector | stat_type | Category |
|----------|-----------|----------|
| Card leader | `referee_cards_leader` | Discipline |
| Penalty average | `referee_penalty_avg` | Discipline |
| Home/away card delta | `referee_home_away_bias` | Comparison |
| Competition trend | `referee_comp_trend` | Discipline |

#### Stadiums
| Detector | stat_type | Category |
|----------|-----------|----------|
| Attendance record | `stadium_attendance_record` | Attendance |
| Team home record at venue | `stadium_team_record` | Venue |
| Highest scoring match at venue | `stadium_highest_scoring` | Record |
| Historic venue summary | `stadium_historic` | Historical |

#### Crowds
| Detector | stat_type | Category |
|----------|-----------|----------|
| Biggest crowd | `crowd_biggest` | Attendance |
| Lowest crowd | `crowd_lowest` | Attendance |
| Average vs season | `crowd_average` | Comparison |
| Crowd growth YoY | `crowd_growth` | Historical |
| Sell-out | `crowd_sellout` | Attendance |

#### Countries
| Detector | stat_type | Category |
|----------|-----------|----------|
| International win record | `country_int_record` | Record |
| World Cup | `country_world_cup` | Historical |
| Six Nations | `country_six_nations` | Historical |
| Rugby Championship | `country_rugby_championship` | Historical |

---

## 7. Publishing components

All components fetch from the insight API — **no local stat computation**.

### 7.1 Component catalogue

| Component | Props | Behaviour |
|-----------|-------|-----------|
| `InsightStatsList` | `entityType`, `entityId`, `limit`, `categories[]`, `pinnedFirst` | Generic list |
| `InsightStatCard` | `insightId` or `insight` object | Single card with badges |
| `InsightStatTicker` | `matchId` or `competitionId`, `rotateMs` | Auto-rotating headlines |
| `MatchInsightStats` | `matchId`, `phase`: `preview` \| `live` \| `post` | Filters by category |
| `TeamInsightStats` | `teamId` | Wrapper |
| `PlayerInsightStats` | `playerId` | Wrapper |
| `CompetitionInsightStats` | `competitionId`, `seasonId?` | Wrapper |
| `StadiumInsightStats` | `stadiumId` | Wrapper |
| `RefereeInsightStats` | `refereeId` | Wrapper |

### 7.2 Entity page integration pattern

```tsx
// On team edit / public team page — display only, no generation
<TeamInsightStats teamId={team.id} limit={5} />
```

Admin entity pages may show a read-only panel:

> **Linked insight stats (3 published)** — [Manage in Insight Stats →](/admin/insight-stats?teamId=…)

---

## 8. API shapes (planned)

### 8.1 Admin list

`GET /api/admin/insight-stats?status=published&teamId=…`

```json
{
  "insights": [{ "id": "…", "title": "…", "status": "published", "entities": [] }],
  "total": 42,
  "filters": {}
}
```

### 8.2 Admin create

`POST /api/admin/insight-stats`

### 8.3 Admin actions

`POST /api/admin/insight-stats/[id]/approve`  
`POST /api/admin/insight-stats/[id]/reject`  
`POST /api/admin/insight-stats/[id]/publish`  
`POST /api/admin/insight-stats/[id]/pin`

### 8.4 Public read

`GET /api/insights/for-entity?entityType=team&entityId=…&status=published`

---

## 9. Dedup rules

Before inserting a generated insight:

1. Same `stat_type` + same primary `entity_id` + overlapping `date_range` → skip or update existing draft.
2. Same `title` normalized (lowercase, strip punctuation) within 7 days → skip.
3. Lower `interest_score` candidate loses if published insight exists.

---

## 10. Open questions

| Question | Recommendation |
|----------|----------------|
| Separate `countries` table? | Phase 1: use national `teams` row; add `countries` later if needed |
| `crowd` as entity_type | Link to `fixtures.id`; store attendance in `source_data` |
| Auto-publish for live? | No — `pending_review` with `expires_at`; operator can fast-approve |
| AI rewrite | Optional Phase 4; never auto-publish without human gate initially |

---

## 11. File map (implementation)

```
packages/db/drizzle/0025_insight_stats.sql
packages/db/src/schema/insight-stats.ts
packages/stats-brain/
apps/web/src/app/admin/insight-stats/
apps/web/src/lib/insight-stats-service.ts
apps/web/src/lib/stats-brain-service.ts
apps/web/src/app/api/admin/insight-stats/
apps/web/src/app/api/insights/
apps/web/src/components/insights/
```
