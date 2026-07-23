# Table Lab — Fix Plan

**Audit date:** 13 July 2026  
**Related:** [TABLE_LAB_AUDIT.md](./TABLE_LAB_AUDIT.md), [TABLE_LAB_DATA_GAPS.md](./TABLE_LAB_DATA_GAPS.md)

Do **not** skip Phase 1. UI/schema issues hide every other validation.

---

## Phase 1 — Broken core (unblock Table Lab)

*Goal: Pages load; APIs respond; basic tables usable in the browser.*

| Priority | Issue | Task | Effort |
|----------|-------|------|--------|
| P0 | AUD-001 | Stop client components importing DB services (`PlayerDataSection` / any `"use client"` → `@rugby365/db`). Split pure helpers; `server-only` on services | 0.5–1.5 d |
| P0 | AUD-001 | Confirm `view/page.tsx` only imports client-safe parse helpers (no transitivedb) | 0.5 d |
| P1 | AUD-012 | Fix table-lab TypeScript errors so `apps/web` typecheck is clean for table-lab | 0.5–1 d |
| P1 | — | E2E smoke: `/admin/tables/view?type=full-table` + POST `/api/admin/tables/calculate` for Premiership 2024–25 and 2025–26 | 0.5 d |
| P1 | AUD-018 | Update all-time tests for `Bath Rugby` canonical names | 0.5 h |

**Exit criteria:** Table Lab view returns 200; Full Table renders; calculate API returns JSON; `npm test -- table-lab` green.

---

## Phase 2 — Wrong calculations and misleading tables

*Goal: Outputs match instructions; no silent wrong tables.*

| Priority | Issue | Task | Effort |
|----------|-------|------|--------|
| P0 | AUD-003 | Implement or **hide** `points_gained_drawn` (do not leave as league table) | 2–3 d or 0.5 h hide |
| P0 | AUD-004 | Implement custom match period **or** remove/hide proxy from menu | 3–5 d or 0.5 h hide |
| P0 | AUD-019 | Define league-only vs all-fixtures scope; label Live/Full consistently; filter playoffs if required | 1–2 d |
| P1 | AUD-006/007 | Pass competition scoring rules into generic bonus cases; LBP-only metric | 0.5 d |
| P1 | AUD-005 | Dedicated try-bonus service (null-safe, rule threshold) | 1–2 d |
| P2 | AUD-020 | Expose away neutral-venue toggle in UI | 0.5 d |
| P2 | AUD-008 | Rename docs to All-Time Premiership **or** generalise all-time competition table | 1–5 d |
| P2 | AUD-011 | Refresh `TABLE_LAB_INDEX.md` summary (25 instruction files) | 0.5 h |

**Exit criteria:** Spot-check 3 teams × 5 matches on each fixed table; no registered table returns a silent wrong shape; unit tests for new behaviour.

---

## Phase 3 — Data gaps

*Goal: Level-2 betting tables and coverage notes accurate on Premiership.*

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Backfill Premiership `team_match_stats` tries for **2024–25** (and older as needed) | 3–10 d |
| P1 | HT / minute-60 snapshots where event coverage &lt; ~90% | 2–5 d |
| P1 | Club `hemisphere` tags **or** restrict Hemisphere UI to international comps | 1–2 d |
| P2 | Neutral venue flags | 1 d |
| P2 | Synced standings try/bonus breakdown columns | 2–5 d |

**Exit criteria:** `tries_scored` returns rows for 2024–25 with ≥80% coverage or explicit N/A eras; Hemisphere usable on at least one intended competition.

---

## Phase 4 — Advanced tables

*Goal: SDMS-backed and remaining game-state tables honest and useful.*

| Priority | Task | Effort |
|----------|------|--------|
| P1 | SDMS pipeline for carries, tackles, possession, lineouts | Large |
| P2 | Instruction files for high-value Partial rugby-scoring tables | 2–3 d |
| P2 | Promote selected generic switch tables to dedicated services | Per table |
| P3 | Extra-time / knockout QA for timeline tables | 2 d |

**Exit criteria:** Advanced tables show unavailable when data missing; non-zero when SDMS present; never silent zeros.

---

## Phase 5 — UI and performance

*Goal: Production Table Lab UX.*

| Priority | Issue | Task | Effort |
|----------|-------|------|--------|
| P1 | AUD-015 | Live Table browser + SSE dedup with live feed | 1 d |
| P1 | — | Mobile + horizontal scroll for wide betting columns | 1–2 d |
| P2 | — | CSV export parity; shareable URL regression | 1–1.5 d |
| P3 | — | Calculate caching / perspective memoisation | 2–3 d |
| P3 | — | Dedicated `table-confidence.test.ts` | 0.5 d |

**Exit criteria:** Browser checklist in audit passes; live table verified manually; export matches on-screen columns.

---

## Recommended fix order (summary)

1. **AUD-001** — Unblock UI (highest ROI).  
2. **AUD-018 + AUD-012** — Tests and typecheck green for table-lab.  
3. **Hide or fix AUD-003 / AUD-004** — Stop shipping wrong tables.  
4. **AUD-019** — League vs playoff scope honesty.  
5. **AUD-006/007/005** — Bonus calculation correctness.  
6. **Data:** 2024–25 tries → unlock betting tables on the season people open first.  
7. **AUD-015** — Live browser verification.  
8. **Advanced SDMS + Hemisphere** — after core trust is restored.

---

## Quick wins

1. AUD-001 client/DB split  
2. Hide `points_gained_drawn` and `custom_match_period` from menu until real  
3. AUD-007 one-line LBP fix  
4. AUD-018 rename Bath → Bath Rugby in tests  
5. AUD-011 index summary refresh  

---

## Out of scope for early phases

- Building all 40+ Partial metric tables to dedicated services  
- Inventing try/hemisphere data to make empty tables look populated  
- Public (non-admin) Table Lab API
