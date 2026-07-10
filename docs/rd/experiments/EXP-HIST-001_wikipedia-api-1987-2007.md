# EXP-HIST-001 — Wikipedia API-only Premiership audit 1987–2007

| Field | Value |
|-------|--------|
| Date | 2026-07-08 |
| Hypothesis | MediaWiki API can parse champions, tables, and club/stadium rows for National Division 1 / Premiership 1 / early Premiership without DB import |
| Technical uncertainty | Page structure drift; dual capacities; “Participating teams”; sparse Rugbybox; rate limits |
| Code / script | `scripts/audit-premiership-wikipedia-api-only.ts --from=1987 --to=2007` |
| Data tested | 21 Wikipedia season pages |
| Run time | ~4 minutes (with delays); retries for 429 on 1993/2005 |
| Result | **0 fail** on successful re-run; champions + tables + clubs parsed; report written |
| Report | `docs/audits/PREMIERSHIP_WIKIPEDIA_API_AUDIT_1987-2007_2026-07-08.md` |
| Problems | 429s under load; capacity parsing (dual figures) fixed; coaches often absent (valid) |
| Unexpected | Some seasons parse coaches as stadium (header columns differ) — mitigated by coach header detection |
| Decision | Audit is source of truth for historic **import candidate** data. DB table import still pending. Sparse ≠ failed. |
| Next action | After A1/A3 modern repair: minimum import (champion + table + clubs) season-by-season |

## Aborted / limited related jobs (preserve)

- Overlapping Wikipedia **DB** re-import loops 2018–2025 / 2019–2025 — aborted (429 pile-up). Covered later by successful imports. Do not restart.
