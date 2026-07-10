# R&D Workstream 2 — Rugby Union Player Rating Engine

**Last updated:** 2026-07-08

## Technical uncertainties

- Position weighting
- Error deductions / duplicate error blocks in source stats
- Win/loss impact
- Minutes adjustment (subs)
- Forward vs back bias
- Match dominance
- Rating distribution
- Incomplete-data confidence (final vs provisional)
- Performance trend vs selection trend (must stay separate)
- Official POTM vs Rugby365 POTM divergence

## Models in repo

| ID | Scale | Storage | Status |
|----|-------|---------|--------|
| **career-v1** | ~35–99 | `player_ratings` | **KEEP** — batch completed 3041/3041 (2026-07-07). Used on profiles, search, squads, rankings. |
| **match-v1** | 1.0–10.0 | `player_match_ratings` | Line-up + POTM; separate from career. Do not force towards career. |
| **Form** | 1.0–10.0 | Calculated from recent match-v1 only | Shown when match rating absent (fixtures) or in panel |

## UI rule (2026-07-08)

Line-up shows:

`Career | Match ▲ trend` e.g. `87 | 9.1 ▲ +0.6`

Legend on match page separates overall quality vs this-match performance vs form.

Do **not** change career-v1 weights until match-v1 Premiership simulation is reviewed.

## Active job

**None.** Career batch finished. Do not start second full career run or change weights until simulation review.

## Experiments

- `EXP-PR-001` career batch  
- Line-up dual badge UI + form signal shipped 2026-07-08

## Next actions

1. Controlled match-v1 sample (few Premiership fixtures) → simulation report  
2. Review queue for suspicious match ratings  
3. Only then consider career-v2 (may include form) — never overwrite career-v1 blindly  

## Decision log

| Date | Decision |
|------|----------|
| 2026-07-08 | Do not interrupt or duplicate full rating jobs |
| 2026-07-08 | Do not change match or career weights until first full results reviewed |
| 2026-07-08 | Performance trend ≠ selection trend |
| 2026-07-08 | **Keep both Career and Match systems** — Form from Match Ratings only |
