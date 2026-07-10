# Table Lab — master index

All table types registered in `table-definition-service.ts`.  
**Instruction file** = permanent spec in `docs/tables/instructions/`.  
**Status** = implementation in Table Lab view/calculate path.

Legend:

- **Spec** — instruction file exists
- **Live** — implemented in calculation service + view UI
- **Partial** — definition exists; calculation may use generic path
- **Planned** — index only; add instruction file before coding

---

## Standard Tables

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `full_table` | Full Table | `full-table` | [full-table.md](./instructions/full-table.md) | Live |
| `live_table` | Live Table | `live-table` | [live-table.md](./instructions/live-table.md) | Live |
| `hemisphere_table` | Hemisphere Table | `hemisphere-table` | [hemisphere-table.md](./instructions/hemisphere-table.md) | Live |
| `form_table` | Form Table | `form-table` | [form-table.md](./instructions/form-table.md) | Live |
| `home_table` | Home Table | `home-table` | [home-table.md](./instructions/home-table.md) | Live |
| `away_table` | Away Table | `away-table` | [away-table.md](./instructions/away-table.md) | Live |
| `all_time_premiership` | All-Time Premiership Rugby Table | `all-time-premiership` | [all-time-premiership.md](./instructions/all-time-premiership.md) | Live |
| `calendar_year` | Calendar Year Table | `calendar-year-table` | [calendar-year-table.md](./instructions/calendar-year-table.md) | Live |
| `on_this_date` | Table On This Date | `table-on-this-date` | [table-on-this-date.md](./instructions/table-on-this-date.md) | Live |
| `between_dates` | Table Between Two Dates | `table-between-dates` | [table-between-dates.md](./instructions/table-between-dates.md) | Live |

---

## Match period

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `first_half` | First Half Table | `first-half-table` | [first-half-table.md](./instructions/first-half-table.md) | Live |
| `second_half` | Second Half Table | `second-half-table` | [second-half-table.md](./instructions/second-half-table.md) | Live |
| `final_20_minutes` | Final 20 Minutes Table | `final-20-minutes-table` | [final-20-minutes-table.md](./instructions/final-20-minutes-table.md) | Live |
| `custom_match_period` | Table By Custom Match Period | `custom-match-period` | — | Partial |

---

## Opposition

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `v_top_half` | Table v Top Half | `table-v-top-half` | [table-v-top-half.md](./instructions/table-v-top-half.md) | Implemented |
| `v_bottom_half` | Table v Bottom Half | `table-v-bottom-half` | [table-v-bottom-half.md](./instructions/table-v-bottom-half.md) | Implemented |

---

## Game state

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `scoring_first` | Table When Scoring First | `table-when-scoring-first` | [table-when-scoring-first.md](./instructions/table-when-scoring-first.md) | Implemented |
| `conceding_first` | Table When Conceding First | `table-when-conceding-first` | [table-when-conceding-first.md](./instructions/table-when-conceding-first.md) | Implemented |
| `points_gained_losing` | Points Gained From Losing Positions | `points-gained-from-losing-positions` | [points-gained-from-losing-positions.md](./instructions/points-gained-from-losing-positions.md) | Implemented |
| `points_lost_winning` | Points Lost From Winning Positions | `points-lost-from-winning-positions` | [points-lost-from-winning-positions.md](./instructions/points-lost-from-winning-positions.md) | Implemented |
| `points_gained_drawn` | Points Gained From Drawn Positions | `points-gained-drawn` | — | Planned |
| `comeback` | Comeback Table | `comeback-table` | [comeback-table.md](./instructions/comeback-table.md) | Complete |
| `lead_protection` | Lead Protection Table | `lead-protection-table` | [lead-protection-table.md](./instructions/lead-protection-table.md) | Complete |

---

## Rugby scoring

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `tries_scored` | Tries Scored Table | `tries-scored-table` | [tries-scored-table.md](./instructions/tries-scored-table.md) | Complete |
| `tries_conceded` | Tries Conceded Table | `tries-conceded-table` | [instructions](./instructions/tries-conceded-table.md) | Complete |
| `try_bonus_point` | Try Bonus Point Table | `try-bonus-point` | — | Partial |
| `losing_bonus_point` | Losing Bonus Point Table | `losing-bonus-point` | — | Partial |
| `bonus_points` | Bonus Points Table | `bonus-points` | — | Partial |
| `winning_bonus_points` | Winning Bonus Points Table | `winning-bonus-points-table` | [instructions](./instructions/winning-bonus-points-table.md) | Complete |
| `points_scored` | Points Scored Table | `points-scored` | — | Partial |
| `points_conceded` | Points Conceded Table | `points-conceded` | — | Partial |
| `wins_to_nil` | Wins To Nil | `wins-to-nil` | — | Partial |
| `scoreless_matches` | Scoreless Matches | `scoreless-matches` | — | Partial |
| `both_teams_scored_tries` | Both Teams Scored Tries | `both-teams-scored-tries` | [instructions](./instructions/both-teams-scored-tries.md) | Complete |
| `tryless_opponent` | Tryless Opponent | `tryless-opponent` | — | Partial |

---

## Set piece

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `lineout_won` | Lineout Won Table | `lineout-won` | — | Partial |
| `lineout_lost` | Lineout Lost / Conceded Table | `lineout-lost` | — | Partial |
| `lineout_success_pct` | Lineout Success % | `lineout-success-pct` | — | Partial |
| `scrum_success_pct` | Scrum Success % | `scrum-success-pct` | — | Partial |
| `scrum_penalties_won` | Scrum Penalties Won | `scrum-penalties-won` | — | Partial |
| `scrum_penalties_conceded` | Scrum Penalties Conceded | `scrum-penalties-conceded` | — | Partial |
| `set_piece_dominance` | Set Piece Dominance Table | `set-piece-dominance` | — | Partial |

---

## Attack

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `carries` | Carries Table | `carries` | — | Partial |
| `metres_carried` | Metres Carried Table | `metres-carried` | — | Partial |
| `metres_per_carry` | Metres Per Carry | `metres-per-carry` | — | Partial |
| `line_breaks` | Line Breaks | `line-breaks` | — | Partial |
| `defenders_beaten` | Defenders Beaten | `defenders-beaten` | — | Partial |
| `post_contact_metres` | Post-Contact Metres | `post-contact-metres` | — | Partial |
| `try_assists` | Try Assists | `try-assists` | — | Partial |
| `turnovers_won_attack` | Turnovers Won (attack) | `turnovers-won-attack` | — | Partial |
| `attacking_efficiency` | Attacking Efficiency | `attacking-efficiency` | — | Partial |

---

## Defence

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `tackles_made` | Tackles Made | `tackles-made` | — | Partial |
| `tackle_completion_pct` | Tackle Completion % | `tackle-completion-pct` | — | Partial |
| `dominant_tackles` | Dominant Tackles | `dominant-tackles` | — | Partial |
| `missed_tackles` | Missed Tackles | `missed-tackles` | — | Partial |
| `turnovers_won_defence` | Turnovers Won (defence) | `turnovers-won-defence` | — | Partial |
| `tries_conceded_defence` | Tries Conceded (defence) | `tries-conceded-defence` | — | Partial |
| `defensive_efficiency` | Defensive Efficiency | `defensive-efficiency` | — | Partial |

---

## Possession / territory

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `possession` | Possession Table | `possession` | — | Partial |
| `territory` | Territory Table | `territory` | — | Partial |
| `winning_less_possession` | Winning With Less Possession | `winning-less-possession` | — | Partial |
| `losing_more_possession` | Losing With More Possession | `losing-more-possession` | — | Partial |

---

## Discipline

| ID | Label | Route `type` | Spec | Status |
|----|-------|----------------|------|--------|
| `penalties_conceded` | Penalties Conceded | `penalties-conceded` | — | Partial |
| `yellow_cards` | Yellow Cards | `yellow-cards` | — | Partial |
| `red_cards` | Red Cards | `red-cards` | — | Partial |
| `cards_per_match` | Cards Per Match | `cards-per-match` | — | Partial |
| `discipline_score` | Discipline Score | `discipline-score` | — | Partial |

---

## Summary

| Category | Count | With instruction file |
|----------|------:|----------------------:|
| Standard Tables | 10 | 10 |
| Match period | 4 | 3 |
| Opposition | 2 | 0 |
| Game state | 7 | 0 |
| Rugby scoring | 11 | 0 |
| Set piece | 7 | 0 |
| Attack | 9 | 0 |
| Defence | 7 | 0 |
| Possession / territory | 4 | 0 |
| Discipline | 5 | 0 |
| **Total** | **66** | **14** |

When adding a new table, create `docs/tables/instructions/<slug>.md` using the template in [README.md](./README.md), then update this index.
