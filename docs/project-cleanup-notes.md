# Project cleanup notes (2026-08-27)

## Root cause

Cursor workspace root was **Rugby365** while agents also worked on **planetf1-live** / Planet Sport deck assets. A broad “commit all uncommitted” scooped wrong untracked files into rugby history:

| Commit | What happened |
|--------|----------------|
| `33da982` | Legitimate match-ratings FT fix **plus** ~213 Planet Sport docs / `public/company-introduction/` assets |
| `af24a1d` | Removed those wrong-project paths |
| `9db41a1` | Added `.cursor/rules/project-boundary.mdc` + `.gitignore` guards |

No history rewrite — leave those commits as the record.

## Audit result (this cleanup)

- Tracked tree: no `company-introduction`, `docs/planet-sport-*`, OpenF1, or planetf1 app code.
- Deleted ignored junk: `apps/web/src/lib/.venue-audit-tmp.json`.
- Kept: SDMS / Planet Rugby product strings; import-sdk HTML fixtures that mention sibling brands in footers; Supabase split docs that list sibling project refs as “do not touch”.

## David — Live Centre WIP

Stay on `David-rugby365-Branch`. Restore stashed Live Centre / Supabase work with `git stash pop` **there only** — do not pop onto `main`. (This machine’s stash list was empty at cleanup time; if the stash lived elsewhere, recover from that clone.)
