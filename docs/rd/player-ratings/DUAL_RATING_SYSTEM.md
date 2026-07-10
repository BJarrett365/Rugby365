# Rugby365 Rating System — Dual Model Rules

**Date:** 2026-07-08

## Keep both

| Signal | Scale | Storage | Answers |
|--------|-------|---------|---------|
| Career Rating (`career-v1`) | 35–99 | `player_ratings` | How good is this player overall? |
| Match Rating (`match-v1`) | 1.0–10.0 | `player_match_ratings` | How well did they play today? |
| Form Rating | 1.0–10.0 | Calculated from Match Ratings | How well are they playing right now? |
| Performance Trend | ▲▼→NEW | On match row | Improving vs last Match Rating? |
| Selection Trend | START/BENCH/OUT… | On match row | Squad role movement? |

Do not merge into one score.  
Do not force Match Rating toward high Career Rating.  
Do not change `career-v1` until Match Rating Premiership simulation is reviewed.  
Future `career-v2` may include Form — later only.
