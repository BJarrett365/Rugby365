# Commentary Rules — Rugby365 Commentary Intelligence Engine

How match commentary is written and compiled. For editors, ops and agents working on Live Commentary.

## Purpose

Commentary should read like a **live rugby journalist** (Planet Rugby / Rugby365 tone) — not an Opta stats ticker. Numbers may appear only when explained in prose. Never publish bare lines such as `Territory update: 52%–48%` or `Possession 63%`.

## End-to-end compilation

```
Fixture + events + squads + coaches + table + H2H + weather
+ team stats + player highlights + BI tip + MOTM
        ↓
match-narrative-commentary-service (loads context from CMS/DB)
        ↓
buildMatchNarrativeCommentary()
  ├── Prematch builders (welcome, referee, weather, table, BI, H2H, XVs, kick-off)
  └── buildIntelligenceInPlayCommentary()  ← Intelligence Engine
        ↓
POST /api/admin/matches/[id]/commentary/generate  (replace: true)
        ↓
Published commentary rows → admin feed + public match commentary
```

| Step | Where |
|------|--------|
| Generate button | `/admin/matches/[id]/commentary` |
| API | `POST /api/admin/matches/[id]/commentary/generate` |
| Context assembly | `match-narrative-commentary-service.ts` |
| Prematch + orchestration | `match-narrative-commentary.ts` |
| In-play engine | `match-narrative-intelligence-engine.ts` |
| Phrase / personality libraries | `match-narrative-phrases.ts` |

Opta-style minute gap-fill (`fillCommentaryMinuteGaps`) and raw team-stat dumps (`buildFullMatchTeamStatLines`) are **not** used as the default in-play voice.

## Prematch (kept as dedicated builders)

Always first, in order when data exists:

1. Welcome (venue, competition, teams)
2. Referee
3. Weather / pitch
4. Table positions + summit / foot-of-table colour
5. Betting Intelligence tip
6. Head-to-head
7. Home / away XV (+ coach + changes from last game)
8. Kick-off

## 10 commentary layers

Each layer has multiple writing styles. Insight minutes **blend 2–4 layers** into one paragraph.

| # | Layer | Role |
|---|--------|------|
| 1 | **Live Match Commentary** | What just happened (try, kick, card). Styles: TV / Journalist / Excited / Calm / Storytelling |
| 2 | **Match Story** | Arc beats (~10', ~25', HT, ~60', FT report) |
| 3 | **Momentum** | Who is on top — territory spells, carries, scoreboard pressure (prose, not %) |
| 4 | **Tactical Analysis** | Kicking, rucks, breakdown, set piece |
| 5 | **Player Watch** | Named influencers — ratings, metres, tries, tackles |
| 6 | **Coach Watch** | Subs / tactical changes — **name the coach** |
| 7 | **Statistical Insight** | Explain why a number matters — never bare dumps |
| 8 | **Defensive Analysis** | Tackles, missed tackles, turnovers as prose |
| 9 | **Match Context** | Competition, table, venue, H2H colour |
| 10 | **What's Next?** | Natural lean / prediction — never fake certainty |

### Segments in the feed

Common `facts.segment` values: `play_by_play`, `match_story`, `momentum`, `coach_watch`, `journalist_insight` (blended multi-layer), `man_of_the_match`, `next_fixture`, plus prematch segments (`welcome`, `weather_pitch`, etc.).

## Personality modes (rotate)

Modes rotate across updates (tone colour, not on-screen labels):

- Television Commentary
- Match Reporter (Planet Rugby)
- Tactical Analyst
- Former Player
- Data Journalist
- Story Teller

## Multi-layer blending

- **Insight minutes** (every ~3–4 quiet minutes): combine **2–4 layers** into one natural paragraph.
- **Scoring events / yellow / red**: strong Live Match Commentary; may lightly blend Momentum + What's Next.
- **Story beats**: Match Story leads; may pair with context or what's-next.
- **FT**: narrative report (not a bare score line), then MOTM + next fixtures from the outer builder.

## AI / publishing rules (enforced in code)

1. **Opening variety** — do not reuse the same opening phrase within the last **10** consecutive updates.
2. **Stat anti-repeat** — avoid repeating the same statistic key unless the story meaningfully changed.
3. **Explain numbers** — every stat must answer *why it matters*.
4. **Rolling narrative** — story beats and prior score state feed later lines.
5. **Blend 2–4 layers** on insight updates.
6. **Rotate personalities**.
7. Every update should answer at least one of: *What happened? Why does it matter? Who is influencing? What next?*
8. Use **player names, coaches, venue, competition, weather/context** when available.
9. **Priority**: tries / red / FT always; yellow and score reactions usually; no every-minute Opta spam.

## Priority publishing (summary)

| Always | Usually | Cadenced | Never as raw feed lines |
|--------|---------|----------|-------------------------|
| Tries, penalty tries, red cards, FT report | Yellows, conversions, momentum after scores | Tactical / defensive / player watch every few quiet minutes; story at 10/25/HT/60/FT | `Territory update:…`, possession % dumps, full team-stat spreadsheets |

## After full time

1. Match Story FT report (Intelligence Engine)
2. Man of the Match (if not already present)
3. Next fixtures for both sides

## Related admin surfaces

- Generate UI: Match → Commentary
- Knowledge Base index: `/admin/knowledge`
- This page: `/admin/knowledge/commentary-rules`
- Live Audio (Lead/Analyst rewrite, never TTS of this prose): [Audio Commentary Rules](/admin/knowledge/audio-commentary-rules)
- Operator / commentary research sandbox (R&D experiments — not the production engine)
