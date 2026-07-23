# Rugby365 Rule Book

**Status:** Permanent standard  
**Audience:** CMS operators, developers, AI agents, importers  

This Rule Book is the single source of truth for Rugby365 development. Future imports, providers, AI agents and CMS modules must follow it.

---

## Season Rules

### Club competitions — cross-year seasons

Examples: Premiership, URC, Top 14, Investec Champions Cup.

Labels use an en-dash range:

- `2025–26`
- `2026–27`

Northern-hemisphere club seasons run approximately **August → July**. Never use calendar year alone.

### International competitions — calendar-year seasons

Examples: Six Nations, Rugby Championship, July Internationals, Autumn Nations Series.

Labels use the calendar year:

- `2026`

### Tournament competitions — tournament year

Examples: Rugby World Cup, British & Irish Lions, Under 20 World Cup.

Labels use the tournament year:

- `2027`
- `2029`

### Resolution order (locked)

Never determine a season using the calendar year alone. Always resolve using:

1. Competition  
2. Season type (club / international / tournament)  
3. Season start / end (or year window for the type)  
4. Provider mapping (confirmed)  
5. Fixture kick-off date  

Ambiguous or missing seasons → `SEASON_UNMAPPED` → review. Do not invent seasons without a clear unique match.

---

## Entity uniqueness (hard rule)

**Never create a second live row for the same real-world entity.** Imports, resolvers, CMS create flows and AI agents must resolve to an existing record when one already matches.

| Entity | Unique by | On conflict |
|--------|-----------|-------------|
| **Competition** | Canonical display name (e.g. International Matches / Internationals → `International`) | Reuse existing; merge provider ids onto it |
| **Season** | Competition + season year / label kind | Reuse existing; deprecate/delete duplicate year rows after FK migrate |
| **Team** | Normalised name / provider id | Reuse / merge |
| **Player** | Normalised name (+ club context when needed) / provider id | Reuse / merge |
| **Fixture** | Competition + kick-off + home + away (or provider match id) | Upsert; never insert a second copy |

Duplicate names in dropdowns (seasons, competitions) are a data bug, not a UI feature. Prefer cleaning the database; UI filters may collapse aliases temporarily but must not encourage parallel entities.

Cleanup scripts:

- `npx tsx scripts/dedupe-competitions.ts`
- `npx tsx scripts/dedupe-transfers-and-players.ts`
- `npx tsx scripts/dedupe-teams.ts`
- `npx tsx scripts/dedupe-fixtures.ts`

---

## Fixture Rules

Every **approved** fixture must contain:

- Competition  
- Season  
- Home team  
- Away team  
- Kick-off date  
- Match status  
- Primary provider  
- Provider mapping (when an external source is used)  

A fixture without a valid season must **never** become an approved fixture.

Where a season cannot be determined:

- Mark as `SEASON_UNMAPPED`  
- Hold for review  
- Surface in Mapping / season repair review  
- Exclude from normal competition statistics until resolved  

Every season repair must be recorded in the data integration audit log.

---

## Match Loading Rules

Matches CMS and Match Loader follow these permanent rules.

### On first page load

- Do **not** load all fixtures  
- Do **not** load historic fixtures unrestricted  
- Do **not** perform unrestricted queries  

The user must first select:

- From date  
- To date  
- Competition  

Only then may fixtures be loaded.

### Query shape

Filter with **AND** only:

- Date range  
- Competition  
- Optional season  

Never use OR logic to widen the set.

### Results

- Return only matching fixtures  
- Group by competition and season  
- Sort by kick-off date and time  
- Default **20** fixtures per page  

### Incomplete filters

Display:

> Select a date range and competition to load fixtures.

Do not automatically load every fixture.

---

## Public Match Centre

The public Match Centre is the fan-facing story of a match. Rugby365 powers it; Planet Rugby presents it.

### Rules

- Rugby365 is the master data platform.
- Planet Rugby is the presentation layer.
- Public pages never calculate statistics independently.
- Every statistic comes from Rugby365.
- Every player, team and competition page uses Rugby365 entities.
- Public pages should tell the story of the match, not simply display raw data.
- New modules must reuse existing Rugby365 services.
- Match Centre should remain visually consistent with Planet Rugby branding.

### Presentation constraints

Do **not** change Planet Rugby chrome or commercial layout when improving Match Centre modules:

- Header, navigation, footer  
- Ad positions  
- Branding, typography, colour palette  
- Existing page width  

Only Match Centre content modules may evolve. Primary tabs remain: Match Details, Stats, Lineups, Head-to-Head.

### Data flow

1. Providers feed Rugby365 (import / sync / ratings / commentary).  
2. Rugby365 services persist and expose match payloads.  
3. Planet Rugby (or the public Match Centre surface) renders those payloads only.  

Do not call provider APIs from public presentation code to invent parallel stats. Do not duplicate calculation logic in the presentation layer.

---

## Related pages

- [Season Rules](./season-rules.md)  
- [Fixture Rules](./fixture-rules.md)  
- [Import Rules](./import-rules.md)  
- [Mapping Rules](./mapping-rules.md)  
- [Public Match Centre](./public-match-centre.md) (approved plan)  
