# Ratings & Market Value

How Rugby365 calculates **Match Ratings**, **Player (Career) Ratings**, and **Market Values**. These are separate signals — do not merge them into one score.

| Signal | Model | Scale | Answers |
|--------|-------|-------|---------|
| Match Rating | `match-v1` | 1.0–10.0 | How well did they play in this match? |
| Form | from Match Ratings | 1.0–10.0 | How well are they playing right now? |
| Player / Career Rating | `career-v1` | 35–99 | How good is this player overall? |
| Market Value | `player-value-v1` | GBP estimate | What is their model market worth today? |

**Code:** `match-rating-math.ts`, `match-rating-service.ts`, `player-rating-service.ts`, `player-value-math.ts`, `player-value-service.ts`.

---

## 1. Match Ratings (`match-v1`)

Published after the fixture is complete (`full_time` / `completed` / similar). Stored in `player_match_ratings`.

### Formula (per appearance)

From match player stats:

1. **Attack contribution** ≈ points + tries×5 + metres + carries + line breaks + try assists×3 + defenders beaten  
2. **Defence contribution** ≈ tackles completed + dominant tackles×2 + turnovers won×3 + tackles made×0.2  
3. **Minutes factor** = min(1, minutes / 80), or 0.25 if no minutes  
4. **Raw score** = `5.2 + attack×0.012 + defence×0.02 + minutes×1.4 − handling errors×0.25 − missed tackles×0.15`  
5. Clamp to **1.0–10.0** (one decimal)

Errors come from extras (`missed_tackles`, `handling_errors`, etc.).

### Performance bands

| Rating | Band |
|--------|------|
| 9.0+ | Exceptional |
| 8.0–8.9 | Outstanding |
| 7.0–7.9 | Very good |
| 6.0–6.9 | Solid |
| 5.0–5.9 | Below average |
| Under 5 | Poor |

### Trends (separate)

- **Performance trend** — this match rating vs previous match rating (▲ / ▼ / → / NEW)  
- **Selection trend** — starter / bench / out movement (START ▲, BENCH ▼, OUT ▼, etc.)

Do not confuse performance trend with selection trend.

### Form Rating

Weighted average of recent Match Ratings only (default last 5, newest weighted highest). **Never** derived from Career Rating. Shown on fixtures when useful, and as a form signal on profiles.

---

## 2. Player / Career Ratings (`career-v1`)

Overall quality for profiles, search, squads, and rankings. Scale **35–99**. Stored in `player_ratings`. Manual CMS override wins when set.

### Building blocks

From season + match stats:

| Component | Role |
|-----------|------|
| Attack / defence (season) | Current ability (~52% attack / 48% defence blend) |
| Form score | Average of last-five per-match quality scores (career scale) |
| Team importance | Appearances-based contribution |
| Potential | Ability + youth uplift |
| Reputation | Appearances + legend + international team link |

### Display rating blend

When ability, form, and team importance are all present:

`display ≈ ability×0.45 + form×0.35 + teamImportance×0.2`

Otherwise fall back through ability → form → team importance → reputation.

Confidence rises with more match/season data points (roughly 0.2–0.95). Badges flag material form/rating moves, age profile, and international signals.

**Rule:** Do not force Match Rating toward a high Career Rating. Keep both systems.

---

## 3. Market Values (`player-value-v1`)

Rugby365 **model estimate of market worth** on public player profiles (`?tab=value`). Not a football transfer fee and not an official salary database. Rugby Union has no trusted Transfermarkt equivalent — this fills that gap intentionally.

### Where it appears

- Public profile **Value** tab and header shortcut  
- Profile-only in v1 (not fixtures boards or competition rankings)

### Four metrics

| Metric | Meaning |
|--------|---------|
| Market Value | Worth today (GBP) |
| Transfer Value | Settlement / release context for a move |
| Contract Value | Suggested annual salary midpoint from performance band |
| Future Value | Model projection over ~2–5 years |

Also: Peak Career Value, Risk Score, Confidence, Trend, factor breakdown, timeline, recommendations.

### Base band from rating

Uses the **max** of current / season / form / reputation (or last-five match ratings scaled if needed):

| Rating | Market band (mid used in model) |
|--------|----------------------------------|
| 95–99 | £1.5m–£3m (~£2.25m) |
| 90–94 | £800k–£1.5m (~£1.15m) |
| 85–89 | £400k–£800k (~£600k) |
| 80–84 | £200k–£400k (~£300k) |
| 75–79 | £75k–£200k (~£137.5k) |
| 65–74 | Under £75k (~£55k) |
| Under 65 | Lower band (~£25k) |

### Factor multipliers (applied to base)

Each factor is a % adjustment; product of `(1 + pct/100)`, clamped ~0.35–2.4:

- Age (youth upside → veteran discount)  
- Current form  
- International caps (fixture-backed)  
- Club competition strength (Top 14, Premiership, URC, Super Rugby, Europe, etc.)  
- Position scarcity (fly-half / scrum-half / front row premiums, etc.)  
- Contract length when known (unknown = neutral)  
- Injuries / days unavailable  
- Future potential  
- Commercial / social footprint (URL presence only)  
- Captaincy  
- Optional media nudge (−8%…+8%) after review of **allowlisted** snippets only

### Club salary caps (context only)

Informational for clubs — not direct player inputs. See `player-value-salary-caps.ts` (Premiership £6.4m, Top 14 €11m, etc.).

### Media check rules

- Allowlisted domains only (BBC, Sky, Guardian, RugbyPass, Planet Rugby, ESPN, L’Équipe, union sites, …)  
- AI may only discuss figures **cited in supplied snippets**  
- Never invent salaries; never treat scrape sites as proof  
- CMS: `POST /api/admin/players/[id]/value` with optional `mediaSnippets[]`

### Storage & editorial

- Table `player_market_values` — yearly snapshots + `is_current` for the profile  
- Label estimates clearly on every public surface  
- Missing contract data must not be invented  
- Manual CMS money fields (when present later) win over the model  

---

## Related admin tools

- **Rating Lab** — `/admin/rating-lab`  
- **Knowledge Base** index — `/admin/knowledge`  
- Dual-system R&D notes — `docs/rd/player-ratings/DUAL_RATING_SYSTEM.md`
