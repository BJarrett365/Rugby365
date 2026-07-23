# Change Log

Part of the Rugby365 Knowledge Base. See the [Rule Book](./rule-book.md) for permanent standards.

## 2026-07-14

- Learn from rejected images: pending `player_image_learning_rules` proposals from editor rejections (approve before scoring uses them); builtin promo/banner negative filters; CMS panel on player edit; reject action queues proposals.
- Player Performance Radar (position percentiles): reusable radar from `player_season_stats` rates/per-80; same-position cohorts only; Attack / Defence / Carrying / Set piece / Physical / Overall DNA (kicking & discipline wait for source columns); HTML table + structured summary; `player_radar_caches` + CMS enable/default/min-minutes/summary override; Overview compact + Stats/Scouting full; rebuild script `scripts/rebuild-player-radar-caches.ts`.

## 2026-07-13

- Public player rollout across all published players: `/players` directory + `/sitemap-players.xml`; fixture season attach (null → resolved); `player_season_stats` rebuilt from match performance; transfer conflict inventory for CMS.
- Player Development Timeline + Performance Radar on Overview/Stats/Career; rolling average; annotations; season table; written summary + CMS chart settings; `model_version` on match/career ratings.
- Public player profile expansion: Domestic / International / Scouting views; season + competition filters (stable slugs); appearance-backed matches/events/stats; current club competition vs latest recorded season; Samoa/fixture international caps; transfer public dedupe + CMS conflict warning; Rugby XV pitch + rating chart; preview noindex.
- Image system (Phases 1–7): `MediaImage` + `next/image` remotePatterns; media tokens; `PlayerPortrait` / `MediaGallery`; `player_images` rights/focal metadata + CMS editor; public gallery + ImageObject JSON-LD; OG/Twitter large image; `/sitemap-images.xml`; docs under Knowledge Base `image-system`.
- Planet Rugby player image enrichment: `player_images` history, Find Images CMS action, confidence scoring, never auto-replace approved primary.
- Hard entity-uniqueness rule in Rule Book / Import Rules (players, teams, competitions, seasons, fixtures).
- Competition merge + season FK migrate (`scripts/dedupe-competitions.ts`); `resolveCompetition` reuses by canonical name.
- Player performance season/competition filters collapse duplicate import aliases in dropdowns.

## 2026-07-11

- Knowledge Base under Keys: markdown viewer/API for Rule Book and related docs (`/admin/knowledge`).
- Season resolve supports club (Aug–Jul), international (calendar year), and tournament (tournament year) via competition type.
- Season repair preview/apply at `/admin/season-repair` (safe unique matches only; audit log).
- Matches CMS idle copy aligned to Rule Book; bare `GET /api/admin/matches` no longer dumps all fixtures (use `mode=cms` filters or `mode=legacy`).
- Schedule API accepts optional `competitionId` server-side filter (public day view unchanged).
- Rule Book: Public Match Centre section (Rugby365 SoT, Planet Rugby presentation).
- Approved Public Match Centre plan copied to Knowledge Base (`public-match-centre.md`): audit, gaps, reusable assets, phases 0–5.
- Public View visual pass: `/matches` Live Scores & Fixtures layout + Match Centre hero/tabs/Details/stats cards/sidebar styled to Planet Rugby designs.
- Public Match Centre aligned to PR mockups: Team/Player Stats (Snapshot + Detailed), Lineups pitch, Head-to-Head bars + meetings.
