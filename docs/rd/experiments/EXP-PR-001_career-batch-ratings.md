# EXP-PR-001 — Career player ratings batch (`--all`)

| Field | Value |
|-------|--------|
| Date | 2026-07-07 |
| Hypothesis | Recalculating Rugby365 career ratings for all squad players from squad/match/season data produces complete `player_ratings` coverage with zero failures |
| Technical uncertainty | Form windows, ability vs reputation mix, missing match stats |
| Code / script | `scripts/batch-calculate-player-ratings.ts --all` → `player-ratings-batch-service` → `player-rating-service` (career-v1) |
| Data tested | Players with squad (fixture_players) activity |
| Run time | ~68 min (terminal running_for ~4120128 ms from start; log complete by 12:37) |
| PID (historical) | 81046 (process ended) |
| Result | **3041/3041 rated**, 0 without score, 0 failed |
| Log | `/tmp/rugby365-batch-ratings.log` |
| Problems found | None in batch completion metrics |
| Unexpected | Many players clustered at rating 85 — distribution review needed |
| Decision | Treat as **completed** career-v1 run. Do not re-run `--all`. Do not change weights until distribution review. |
| Next action | Simulation / distribution report; separate controlled match-v1 sample later |

## Chain

`Technical uncertainty → batch --all → 3041 rated → learning: complete coverage, check 85-cluster bias → next: review then match-v1 sample`
