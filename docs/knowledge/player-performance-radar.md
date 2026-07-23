# Player Performance Radar

Position-percentile radar for public Rugby365 player profiles.

## Rules

- Compare **same position family only** (never all players together).
- Spokes are **percentiles** of rates (per 80 / per match / derived %), not raw totals.
- Cohort uses **minimum minutes** (CMS default 400).
- Summary text is generated from spoke percentiles — never invent strengths.
- Mirror metrics in HTML for SEO.
- Cache in `player_radar_caches`; invalidate after season ranks / CMS radar save; rebuild with `npx tsx scripts/rebuild-player-radar-caches.ts`.

## Types

Overall DNA (position-aware), Attack, Defence, Ball carrying, Set piece, Physical. Kicking and Discipline remain listed until kick/card columns land in season stats.

## Surfaces

- Overview — compact
- Stats — Position analysis · Performance radar (full)
- Scouting view — full Performance block on Overview

## CMS

Player edit → Public performance radar: enable, default type, min minutes, approve summary, override summary, preview.
