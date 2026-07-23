# Public Match Centre — Approved Plan

**Status:** Approved  
**Date:** 2026-07-11  
**Audience:** CMS operators, developers, AI agents  

Rugby365 is the data engine. Planet Rugby is the public experience. The public Match Centre is powered entirely by Rugby365 and must look and feel like Planet Rugby.

See also: [Rule Book — Public Match Centre](./rule-book.md#public-match-centre).

---

## Objectives

- Become the best Rugby Union Match Centre available.
- Tell the complete story of the game.
- Every panel answers a fan question (who is winning, who is dominating, who has played well, what happened, who came on, how teams compare, what it means).
- Every module must add value. Never add statistics simply because they exist.

---

## Presentation constraints (locked)

Do **not** redesign Planet Rugby. Do **not** change:

- Header  
- Navigation  
- Footer  
- Ad positions  
- Planet Rugby branding  
- Typography  
- Existing page width  
- Existing colour palette  

Only improve the Match Centre.

### Primary tabs (retain)

- Match Details  
- Stats  
- Lineups  
- Head-to-Head  

Future tabs may be added; these remain primary.

---

## Product modules (approved scope)

### Match Header

Retain existing design. Enhance with Rugby365 data:

- Competition, Season, Round  
- Venue, Attendance, Referee, Weather  
- Kick-off time, Match status, Live clock, Half  
- Current score  
- Bonus points, Penalty count, Cards, Scorers  
- Winning probability (future)  
- Momentum (future)  

### Timeline

Improve the event timeline. Include:

Try, Conversion, Penalty, Drop Goal, Yellow Card, Red Card, Substitution, Captain Change, TMO, Half Time, Full Time.

Every event links to player profiles.

### Match Details

Score, Scorers, Conversions, Penalties, Drop Goals, Cards, Player of Match, Attendance, Referee, Venue, Weather, Duration, Possession, Territory.

### Match Summary

Retain comparison cards. Expand with bars (not plain numbers):

Points, Tries, Conversions, Penalties, Drop Goals, Carries, Metres, Passes, Defenders Beaten, Clean Breaks, Offloads, Turnovers Won, Rucks Won, Lineouts, Scrums, Tackles, Missed Tackles, Discipline, Kicking.

### Snapshot

Retain Snapshot. Expand Top Five cards (each links to Player Stats):

Carries, Metres, Tries, Tackles, Turnovers Won, Offloads, Clean Breaks, Defenders Beaten, Kicking Metres, Lineout Takes, Scrum Wins.

### Detailed Stats

Keep existing categories (Attack, Defence, Kicking, Errors, Carries). Add Set Piece, Discipline, Breakdown, Passing.

Filters: Team, Player, Position, Forward, Back, Starter, Replacement.

### Lineups

Retain jersey layout. Enhance with Captain, Vice Captain, Yellow/Red cards, Substituted, Player Rating, Player of Match. Click opens profile.

### Head-to-Head

Completely expand: Overall, Last 5, Last 10, Home, Away, Competition, World Cup, Six Nations; averages (score, tries, carries, tackles); Biggest win, Longest winning streak, Highest score, Most tries; previous meetings.

### Team Statistics (dedicated page)

Attack, Defence, Discipline, Kicking, Set Piece, Territory, Possession, Rucks, Breakdown, Efficiency.

### Player Statistics (two views)

Home Team / Away Team. Sortable by every statistic. Filters: Forwards, Backs, Starters, Replacements, Top Performers.

### Team Comparison

Progress bars, radar charts, percentage rings, comparison cards. No unnecessary graphs.

### Match Insights

Automatic data-driven AI insights (most carries/metres/tackles/defenders beaten, most influential player, most effective kicker, most line breaks, most dominant scrum, best lineout success, biggest momentum swing).

### Commentary

Rugby365 commentary engine: Live Commentary, Key Moments, AI Summary, Half Time Summary, Full Time Summary.

### Fixtures Sidebar

Retain existing right column: Live matches, Upcoming fixtures, Completed results, Competition table. Click to navigate.

### Player / Team links

Every player → Profile, Career, Season Stats, Match History, Ratings, News, Transfer History, Social (future).

Every team → Squad, Fixtures, Results, Table, Statistics, History, Coach, Venue.

### Responsive & performance

Desktop first; tablet; mobile. Do not remove modules — re-stack intelligently.

Lazy load heavy charts, historical data, H2H, player tables. Do not delay first paint.

---

## CMS / architecture rules

- Everything shown publicly comes from Rugby365.
- No duplicated logic. No duplicated calculations.
- Planet Rugby is a presentation layer.
- Rugby365 remains the single source of truth.
- New modules reuse existing Rugby365 services.

---

## Audit baseline (2026-07-11)

### Current surface

| Item | Reality |
|------|---------|
| App | `apps/web` — no separate Planet Rugby frontend app |
| Route | `/matches/{sdmsId}/{comp}/{compId}/{home}-v-{away}/{date}?tab=…` |
| Shell | AdminShell + Planet Rugby CMS theme (not public PR chrome) |
| Ads | None on this page |
| Commentary | Separate route `/matches/{cmsSlug}/commentary` |

### Critical finding

Public Match Centre still fetches SDMS live on page load. That conflicts with Rugby365-as-SoT. Closing the data contract is Phase 0 before UI expansion.

### Capability gaps (summary)

| Ready now | CMS-ready, not public | Weak persistence | Missing |
|-----------|----------------------|------------------|---------|
| Header basics, events, summary bars, team/player stats, lineups, ratings/POTM, commentary engine, schedule | Rich H2H, admin stats APIs, standings | `team_match_stats` sections | Weather, win prob, momentum, insights UI, public entity pages, sidebar, Snapshot module |

---

## Reusable assets

### UI

`MatchDetailView`, `MatchDetailTabs`, `CompareBarRow` / `StatSection`, `MatchSummaryPanel`, `KeyEventsPanel`, `MatchTeamStatsPanel`, `PlayerStatsPanel`, `KeyPlayerStatsPanel`, `MatchLineupsWithRatings`, rating badges, admin `HeadToHeadStatsSection` / H2H panel (promote), `CommentaryFeed`, schedule board patterns, PR CMS tokens/theme.

### Services (do not duplicate)

`match-detail-service`, `team-match-stats-service`, `player-season-stats-service`, `match-rating-service`, `head-to-head-service`, commentary services, `planet-rugby-live-fixtures-service`, standings APIs. Import SDK SDMS modules are **ingest only**, not the long-term public render path.

### New components required

`MatchHeroMeta`, `MatchTimeline`, `MatchSnapshot`, `MatchInsights`, `MatchCentreSidebar`, `TeamComparisonVisual`, `PlayerStatsWorkbench`, `TeamStatsPage`, public entity links, commentary sub-views, lazy wrappers for H2H/charts/tables.

---

## Performance principles

- First paint: hero + score + status + primary tabs + lightweight Details (score story + key events).
- Defer Stats depth, H2H history, charts, Snapshot leaders, sidebar secondary fetches.
- Dynamic-import charts; stale-while-revalidate for sidebar; never block page on empty advanced stats.

---

## Phased implementation (approved)

### Phase 0 — Architecture lock

- Rugby365 as SoT: persist provider data into fixtures/events/stats/ratings on ingest.
- Single public match payload (RSC/API over CMS services).
- Harden `team_match_stats` import.
- Align with Rule Book Public Match Centre.

### Phase 1 — Story of the match

- Header enhancements (season, attendance, clock/period, cards/scorers).
- Timeline expansion + player links.
- Match Summary compare bars to approved metric set.
- Commentary entry points without leaving PR chrome.

### Phase 2 — Stats depth

- Snapshot Top Five.
- Detailed Stats new categories + filters.
- Player Statistics workbench.
- Team Comparison visuals (bars first).

### Phase 3 — Lineups + H2H + sidebar

- Lineup badges (captain, VC, cards, sub, rating, POTM).
- Full public H2H from existing services.
- Fixtures sidebar (live / upcoming / results / table).

### Phase 4 — Team stats + entity links

- Dedicated Team Statistics page.
- Public player/team hubs.

### Phase 5 — Insights & future header

- Data-driven Match Insights (published only).
- Weather (new source).
- Winning probability + momentum (future).

**Build order when starting:** Phase 0 → 1 → 2 → 3 → 4 → 5.
