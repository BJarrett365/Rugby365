# Competition Rules

Part of the Rugby365 Knowledge Base. Expand this page as the product evolves.

See the [Rule Book](./rule-book.md) for permanent standards.

## Bonus points (league tables)

Domestic leagues that use the Premiership / URC-style bonus system award:

| Bonus | Rule | Points |
| --- | --- | --- |
| **Try bonus** | Score **4 or more tries** in the match | +1 |
| **Losing bonus** | Lose by **7 points or fewer** | +1 |

A team can earn both in the same match (lose by ≤7 while scoring 4+ tries).

### Competitions using these rules

- Premiership
- Championship
- United Rugby Championship
- **Currie Cup** (including provider slugs like `currie-cup-*`)

### Exceptions (catalog)

- **Top 14** — try bonus at **3** tries; losing bonus by ≤7
- **Rugby Championship / Six Nations** — try thresholds differ; losing bonus often **not** used (see `competition-scoring-rules-catalog.ts`)

### Storage

Per-fixture bonus points are stored on `fixtures`:

- `home_try_bonus_points` / `away_try_bonus_points`
- `home_losing_bonus_points` / `away_losing_bonus_points`
- `bonus_points_computed_at`

Computed from final score + try counts (`team_match_stats.tries`, else match try events) and the competition’s scoring rules. Public Match Details shows a Bonus Points summary (Try / Losing totals).
