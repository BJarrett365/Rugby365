# Betting Intelligence — R&D Lab

Research & Development notes for Match Centre / fixtures-board win-probability.

**Purpose:** freeze each algorithm version, record what we measure against outcomes, and track improvement experiments before they ship.

| Field | Value |
|-------|--------|
| Current production model | `betting-intel-v1.1` |
| Code (math) | `apps/web/src/lib/match-betting-intelligence-math.ts` |
| Code (Phase A helpers) | `apps/web/src/lib/match-betting-intelligence-phase-a.ts` |
| Code (Match Centre load) | `apps/web/src/lib/match-betting-intelligence-service.ts` |
| Code (board lean) | `apps/web/src/lib/schedule-win-probability.ts` |
| Accuracy UI | `/admin/odds/model-accuracy` |
| R&D hub | `/admin/odds/betting-rd` |

---

## Baseline freeze — `betting-intel-v1` (2026-08-01)

This section is the **first recorded production algorithm**. Do not rewrite history in place; append newer versions below under [Improvement log](#improvement-log).

### Goal

Explainable home / draw / away win % + lean + expected scoreline. Bookmaker odds optional (value bets only).

### Two surfaces (important)

| Surface | Model inputs actually used | Graded by accuracy page? |
|---------|----------------------------|---------------------------|
| Match Centre Betting tab | Full signal set below | **No** (not snapshotted) |
| Fixtures board + model-accuracy | **Form + home only** (ratings/coach/H2H/availability forced null) | **Yes** |

Baseline lesson: accuracy was measuring a thinner model than Match Centre.

### Signal weights (Match Centre)

When a signal is present, it contributes `±weight` to a home edge (home +, away −, neutral 0).

| Key | Weight | Input |
|-----|--------|--------|
| `ratings` | **0.20** | Avg career rating (35–99) of named XV with ratings |
| `form` | **0.18** | Last-5 team win rate (≥3 games either side) |
| `availability` | **0.16** | Injury + suspension counts |
| `h2h` | **0.14** | SDMS H2H wins (≥2 meetings) |
| `home_advantage` | **0.12** | Venue name present |
| `coach` | **0.08** | Coach rating number if linked |
| `weather` | **0.06** | Harsh rain/wind → **neutral on winner**; −5 expected total points |

Typed but **not emitted** in v1: `squad_depth`, `referee`, `venue`, `momentum`.

### Edge → probabilities

1. Sum signal edges  
2. `edge = clamp(edge × 1.35, −1.4, 1.4)`  
3. Softmax-style H/D/A with draw base `0.06` → `homeWinPct` / `drawPct` / `awayWinPct`  
4. Lean: home/away if gap ≥ 8 pts, else uncertain / slight lean  
5. Confidence: `52 + |H−A|×0.55 + signalCount×2.5` (clamped 45–96)

### Scoreline

Total points from rating gap + harsh weather; home share from same `edge`. Lean winner cannot trail on expected points.

### Explicitly unused in v1 edge

- Player market value  
- Per-player match performance rates (tries/metres) — narrative / props only  
- International level / caps boost  
- Tour fatigue / days since Test  
- Travel distance  
- Hot vs cold climate fit  
- Altitude (`altitudeM` stubbed `null`)  
- Referee ability (display intel only)  
- Bookmaker implied odds (value bets only, not WDW blend)

### Early accuracy snapshot (lightweight board model)

Around late July – 1 Aug 2026 (≈30 graded non-draw fixtures):

- Overall ~**40%** correct lean  
- Soft edges (~10 pt) ~**25%**  
- Stronger edges ~**60%**  

Soft “56–41 home” defaults were a common failure mode.

---

## Production — `betting-intel-v1.1` (2026-08-01)

Phase A ship. Same edge → probability pipeline as v1; richer inputs and rebalanced weights.

### Surfaces (unified)

| Surface | Inputs |
|---------|--------|
| Match Centre | Full v1.1 signal set (lineup-weighted ratings, intl, fatigue, travel, temp fit, form, H2H, availability, coach, home) |
| Fixtures board + model-accuracy | Form + home + **squad quality** (recent form-fixture player ratings) + **travel / climate lat** when venue GEO exists |

Board still omits H2H / availability / coach / weather / fatigue (expensive or Match-Centre-only).

### Signal weights (when present)

| Key | Weight | Notes |
|-----|--------|--------|
| `ratings` | **0.18** | Lineup-weighted career rating (starters full, bench 0.55) |
| `form` | **0.15** | Last-5 win rate |
| `availability` | **0.12** | Injuries + suspensions |
| `h2h` | **0.12** | SDMS H2H |
| `home_advantage` | **0.10** (capped **0.06** / **0.03**) | Cap when away rating gap ≥4 / ≥8 |
| `international_quality` | **0.07** | Share of XV with `internationalTeamId` |
| `fatigue` | **0.06** | Share of XV in intl/world_cup fixtures in prior 14 days |
| `travel` | **0.06** | Haversine team home venue → match venue |
| `coach` | **0.06** | Coach rating |
| `weather_fit` | **0.05** | Heat (≥28°C) / cold (≤8°C) vs home-venue latitude |
| `weather` | **0.04** | Harsh rain/wind — neutral on winner; still lowers totals |

### Still unused in edge

- Player market value  
- Altitude  
- Referee ability as a WDW signal  
- Bookmaker implied odds blend  

---

## Target product KPIs

| KPI | Target | Notes |
|-----|--------|--------|
| Call-tier side-pick accuracy | ≥ **70%** | Edge ≥ ~18 or market-agree; toss-ups abstained |
| All graded leans | ≥ **55–58%** | Includes softer leans |
| Calibration | Predicted bucket ≈ observed | Prefer Brier / log-loss later |

“70% of every match” is unrealistic; “70% when we publish a call” is the R&D goal.

---

## Planned improvements (not yet shipped)

### Phase 0 — Measurement

- Persist `match_prediction_snapshots` at pre-kickoff (H/D/A, lean, signals, model version, channel)  
- Grade frozen snapshots (not recomputed form)  
- Split report: call / lean / toss_up; competition; market-agree  
- Unify board + Match Centre onto same capture path  

### Phase B — Venue enrichment

1. Persist `venues.altitude_m`  
2. Empirical hot/cold affinity from history  
3. Stronger travel when home HQ missing  

### Phase C — Market + referee

1. Blend implied odds when snapshot exists; veto soft fades of market favourites  
2. Small referee signal after measurement (cards / home-win bias)  

---

## Improvement log

Append-only. Newest first.

### 2026-08-01 — Shipped `betting-intel-v1.1` (Phase A)

- Bumped production `BETTING_INTEL_MODEL` to `betting-intel-v1.1`.  
- Lineup-weighted squad quality; home advantage capped vs strong visitors.  
- New signals: `international_quality`, `fatigue`, `travel`, `weather_fit`.  
- Fixtures board / model-accuracy now use squad ratings + travel (not form+home only).  
- Helpers: `match-betting-intelligence-phase-a.ts`.  
- Decision: **keep** pending next accuracy sweep on `/admin/odds/model-accuracy`.

### 2026-08-01 — Baseline recorded (`betting-intel-v1`)

- Frozen this document as the first R&D record of production Betting Intelligence.  
- Noted Match Centre vs board/accuracy input mismatch.  
- Agreed Phase A factors: player data, international level, tour fatigue, travel, climate fit, altitude (altitude + heat affinity need enrichment).  
- Admin R&D entry: Odds → Betting R&D + Knowledge Base doc.  

*(Next entries: date, model version, what changed, accuracy before/after, decision keep/revert.)*

---

## How to run an experiment

1. Branch / feature flag new math as `betting-intel-v1.2` (or higher).  
2. Capture snapshots with that `model_version`.  
3. Compare call-tier accuracy vs `v1.1` on the same fixture set.  
4. Log result in [Improvement log](#improvement-log).  
5. Only then bump the production constant `BETTING_INTEL_MODEL`.

---

## Related

- [Ratings & Market Value](./player-value.md) — player/coach/referee ratings used as inputs  
- Model accuracy UI: `/admin/odds/model-accuracy`  
- Odds hub: `/admin/odds`
