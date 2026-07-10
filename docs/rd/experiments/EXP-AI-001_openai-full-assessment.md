# EXP-AI-001 — Full OpenAI profile assessment (`--ai-only`)

| Field | Value |
|-------|--------|
| Date | 2026-07-07 → 2026-07-08 |
| Hypothesis | Long OpenAI assessment (check_missing + safe auto-apply) will meaningfully lift nation coverage and fill profile gaps |
| Technical uncertainty | Safe automated updates; nation ID; intl links; cost of long runs |
| Code / script | `scripts/assign-international-teams-and-ai-assess.ts --ai-only` |
| Data tested | ~3481 players; 519 teams |
| Run time | **~13.7 hours** (elapsed_ms ≈ 49328044) |
| PID (historical) | 41004 (completed) |
| Result | 2665 players assessed; 519 teams; **3184 suggestions**; **306 fields safe-applied**; 4 intl links; 4 intl failures |
| Nation coverage | Before script note: nation 1053 missing 2428; After: nation **999** missing **2482** — **no net improvement** (count moved the wrong way in aggregate snapshot) |
| Suggestion→apply rate | 306 / 3184 ≈ **9.6%** |
| Problems | Low apply rate; nation coverage did not improve; long wall-clock |
| Unexpected | Nation missing **increased** in after snapshot vs before line of same run |
| Decision | **Do not re-run** same full assessment. Document as limited-value experiment. Narrow future AI jobs (nation-only, high-confidence only). |
| Next action | Analyse failure/uncertainty reasons on suggestion queue without another full pass |

## Chain

`Uncertainty: nation enrichment → 13.7h full assess → 9.6% apply, nation flat/worse → learning: long AI runs ≠ coverage → next: targeted jobs`
