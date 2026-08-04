# Ratings & Market Value

How Rugby365 calculates **Match Ratings**, **Player / Coach / Referee profile ratings**, and **Player Market Values**. These are separate signals — do not merge them into one score.

| Signal | Applies to | Model | Scale | Answers |
|--------|------------|-------|-------|---------|
| Match Rating | Players | `match-v1` | 1.0–10.0 | How well did they play in this match? |
| Coach Match Rating | Coaches | `coach-match-v1` | 1.0–10.0 | How well did the coach’s side perform this match? |
| Referee Match Rating | Referees | `referee-match-v1` | 1.0–10.0 | How well was this contest controlled? |
| Form | Players | from Match Ratings | 1.0–10.0 | How well are they playing right now? |
| Player / Career Rating | Players | `career-v1` | 35–99 | How good is this player overall? |
| Coach Rating | Coaches | `coach-rating-v1` | 35–99 | How good is this coach overall? |
| Referee Profile Score | Referees | `referee-profile-v1` | 35–99 | How strong is this referee’s appointment profile? |
| Market Value | Players only | `player-value-v1` | GBP estimate | What is their model market worth today? |

**Code (players):** `match-rating-math.ts`, `match-rating-service.ts`, `player-rating-service.ts`, `player-value-math.ts`, `player-value-service.ts`.  
**Code (staff):** `staff-match-rating-math.ts`, `staff-match-rating-service.ts`, `coach-intelligence-service.ts`, `referee-intelligence-service.ts`.

**Rule:** Player Match Rating ≠ Coach Match Rating ≠ Referee Match Rating. Career / profile scores (35–99) are never forced toward a single match (1.0–10.0).

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

## 4. Coach Match Ratings (`coach-match-v1`)

Published for completed fixtures when home / away head coaches are linked on the fixture. Stored in `coach_match_ratings`. Shown on the public Match Centre (coach chips) and staff Rating Lab surfaces.

### Inputs

From fixture scoreline + team match stats + card events for that coach’s side:

- Result (win / draw / loss) and margin  
- Try difference  
- Metre-gain share vs opponent  
- Tackle workload and turnovers won  
- Yellow / red cards for the team  

### Formula (summary)

1. Start near **5.8**  
2. **Win** +1.1 (+ margin uplift, capped); **draw** +0.25; **loss** −0.85 (− margin penalty, capped)  
3. Adjust for try difference, metres share, tackles (≥120), turnovers (≥6)  
4. Discipline: yellow × −0.2, red × −0.55  
5. Clamp to **1.0–10.0** (same performance bands as player Match Ratings)

### Trends

Compared to the coach’s previous match rating in the same competition (▲ / ▼ / → / NEW). Independent of player performance trends.

### Linking coaches

If `fixtures.home_coach_id` / `away_coach_id` are empty, staff rating calc can fill from current team head-coach assignments (`team_coaching_staff` / resolve defaults). Without a linked coach, no coach match rating is stored.

---

## 5. Coach Rating (`coach-rating-v1`)

Overall coach quality for coach profiles and intelligence packets. Scale **35–99**. Manual CMS override wins when set. Stored via person intelligence score history (`formulaVersion = coach-rating-v1`).

### Building blocks

| Component | Role |
|-----------|------|
| Current performance | Win rate + competition level + trophies / finals signals |
| Recent form | Points from latest team fixtures (W=3, D=1) |
| Team improvement | Win-rate change since earlier stretch of the sample |
| Player development | Years / assignment experience proxy |
| Experience | Years + international coaching flag |
| Reputation | Trophies / finals / international experience |

### Display blend

`display ≈ currentPerformance×0.25 + recentForm×0.2 + teamImprovement×0.2 + playerDevelopment×0.1 + experience×0.15 + reputation×0.1`

**Rule:** Do not equate Coach Rating (35–99) with Coach Match Rating (1–10). Match ratings feed narrative and form; profile rating is the standing score.

---

## 6. Referee Match Ratings (`referee-match-v1`)

Published for completed fixtures when `fixtures.referee_id` is set. Stored in `referee_match_ratings`. Shown on Match Centre referee chip and Ranking / Rating Lab.

### Inputs

- Final scoreline (margin + total points)  
- Yellow / red card counts (match-wide)  
- Penalty-related event count  

### Formula (summary)

1. Start near **6.4**  
2. Reward competitive contests (margin ≤ 7 and total points ≥ 30)  
3. Sensible yellow volume (1–4) or a clean game; penalise very high yellow counts (≥ 7)  
4. One red can reflect decisive foul management; multiple reds deduct  
5. Mid-range penalty volume rewarded; very high penalty counts deduct  
6. Clamp to **1.0–10.0**

### Trends

Compared to the referee’s previous match rating in the same competition.

---

## 7. Referee Profile Score (`referee-profile-v1`)

Overall appointment / experience profile for referee pages. Scale **35–99**. Built from verified Rugby365 appointments (synced from fixtures into `referee_appointments`). Manual override wins when set.

### Building blocks

| Component | Role |
|-----------|------|
| Experience | Matches refereed |
| Appointment level | Highest competition tier (test / international / Europe / top domestic / domestic) |
| Current status | Recent appointment volume |
| Consistency profile | Volume-based stability proxy |
| Discipline profile | Neutral baseline in v1 (no invented foul stats) |

### Display blend

`display ≈ experience×0.3 + appointmentLevel×0.25 + currentStatus×0.2 + consistency×0.15 + discipline×0.1`

**Rule:** Referee Profile Score ≠ Referee Match Rating. Match rating is contest control for one fixture; profile score is career appointment strength.

---

## Related admin tools

- **Rating Lab** — `/admin/rating-lab`  
- **Coaches** — `/admin/coaches`  
- **Referees** — `/admin/referees`  
- **Knowledge Base** index — `/admin/knowledge`  
- Dual-system R&D notes — `docs/rd/player-ratings/DUAL_RATING_SYSTEM.md`
