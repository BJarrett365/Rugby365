# Rugby365 Full Coach Platform — Final Report

**Date:** 2026-08-08  
**Scope:** Public Coach Profile + CMS + career/honours data model + calculated engines

## Delivered

### Database (migration `0068_coach_platform`)
- Extended `coaches` with identity, publish/SEO, appointment/contract, style, partial-record flags
- Extended `team_coaching_staff` with career type, primary/eligibility, show-on-overview, verification
- New tables: `coach_playing_stints`, `coach_education`, `coach_honours`, `coach_awards`, `coach_medals`, `coach_milestones`, `coach_images`, `coach_rating_snapshots`, `coach_rating_history`

### Engines
- **Career Record** (`coach-career-record-service.ts`) — eligible fixtures → P/W/D/L, PF/PA, streaks, form, biggest win/loss; Impact before/after appointment
- **Rating + Power Index** (`coach-rating-service.ts`) — 15 Intelligence metrics, central PI weights (`coach-power-v1`), overall rating (`coach-rating-v1`), snapshots/history, world rankings list; sparse metrics stay `null` (no fake scores)

### Public
- Full Overview dashboard (`PublicCoachProfileView` + `pr-coach-profile.css`) matching locked design composition
- Tabs/routes: history, honours, career, stats, matches, compare (`?a=&b=`), rankings
- Publish gates: draft/hidden/non-public coaches hidden unless `?preview=`

### CMS
- Tabbed edit: Overview | History | Honours & Awards | Stats/Ratings
- Nested APIs for playing stints, honours, awards, medals, milestones
- Recalculate ratings / impact / career-record / verify actions
- Wikipedia honour preview/accept API (never auto-verified)

### Enrichment
- Wikipedia import writes `fullName`, `placeOfBirth`, `heightCm`, playing stints (unverified)
- Honour line parser explodes “Winners: 2019, 2023” into discrete proposals + FOUND/MISSING compare

### Tests
- `apps/web/src/lib/coach-platform.test.ts` — 6 passing (career record, PI weights, metrics, honour parse)

## Honest limits (by design)
- Selection Stability / Player Development show insufficient-data until lineup/player-rating windows are wired
- Most coaches still lack CMS identity/honours — Overview uses empty states, not demo numbers
- Opponent-adjusted Power Index and full set-piece stats await richer match stats coverage
- Wikipedia `honourLines` / `playingCareer` require parser/SDK population where infobox lacks them

## Key routes
| Surface | Path |
|---|---|
| Public profile | `/coaches/[slug]` |
| History / Honours / Career / Stats / Matches | `/coaches/[slug]/{history,honours,career,stats,matches}` |
| Compare | `/coaches/compare?a=&b=` |
| Rankings | `/coaches/rankings` |
| CMS | `/admin/coaches`, `/admin/coaches/[id]/edit` |
