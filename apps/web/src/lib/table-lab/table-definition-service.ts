import type { RugbyTableDefinition } from "./table-types";
import { enrichDefinition } from "./table-lab-data-levels";

function def(
  input: Omit<RugbyTableDefinition, "slug" | "minimumData" | "enhancedData" | "advancedData"> & {
    slug?: string;
    minimumData?: RugbyTableDefinition["minimumData"];
    enhancedData?: RugbyTableDefinition["enhancedData"];
    advancedData?: RugbyTableDefinition["advancedData"];
  },
): RugbyTableDefinition {
  return enrichDefinition({
    ...input,
    slug: input.slug ?? input.id,
  });
}

export const RUGBY_TABLE_DEFINITIONS: RugbyTableDefinition[] = [
  // Standard
  def({
    id: "full_table",
    label: "Full Table",
    category: "standard",
    explanation: "Overall league table for the selected competition and season using wins, draws, losses and bonus points.",
    calculationMethod:
      "Uses all, home or away completed fixtures for the selected scope. Applies competition-specific scoring rules for wins, draws, try bonus and losing bonus. Sorts by league points, wins, points difference, points for, tries for, then team name.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules", "standing_rows"],
  }),
  def({
    id: "live_table",
    label: "Live Table",
    category: "standard",
    explanation:
      "Competition table as it stands right now, including in-play matches scored from the current scoreline.",
    calculationMethod:
      "Combines completed matches with live fixtures using current scores (0–0 at kick-off counts as a draw). Applies competition points instantly as the score changes. Optional movement compares live position with the pre-match table.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "hemisphere_table",
    label: "Hemisphere Table",
    category: "standard",
    explanation:
      "Compare Northern and Southern Hemisphere teams using explicit team hemisphere values from admin.",
    calculationMethod:
      "Aggregates completed matches into hemisphere summary or team breakdown rows. Unknown teams are excluded unless Include Unknown is enabled.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "form_table",
    label: "Form Table",
    category: "standard",
    explanation: "League table built from each team's most recent matches only.",
    calculationMethod: "Filters completed fixtures to the last N matches per team, then ranks by league points and points difference.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "home_table",
    label: "Home Table",
    category: "standard",
    explanation:
      "League table built from home matches only for the selected competition and season.",
    calculationMethod:
      "Includes completed fixtures where each team was the home side. Applies competition-specific scoring rules, then sorts by league points, wins, points difference, points for, tries for and team name. Home win % is wins divided by home matches played.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules", "standing_rows"],
  }),
  def({
    id: "away_table",
    label: "Away Table",
    category: "standard",
    explanation:
      "League table built from away matches only for the selected competition and season.",
    calculationMethod:
      "Includes completed fixtures where each team was the away side. Neutral-venue away matches are excluded by default. Applies competition-specific scoring rules, then sorts by league points, wins, points difference, points for, tries for and team name. Away win % is wins divided by away matches played.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules", "standing_rows"],
  }),
  def({
    id: "all_time_premiership",
    label: "All-Time Premiership Rugby Table",
    category: "standard",
    explanation:
      "Cumulative Premiership Rugby table across imported seasons, with canonical club identity and per-season scoring rules.",
    calculationMethod:
      "Aggregates completed Premiership fixtures across the selected season range and view (all/home/away). Maps sponsored or historic club names to canonical Rugby365 team identities, applies historic scoring rules per season, and reports separate results/tries/bonus coverage.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules", "team_match_stats"],
  }),
  def({
    id: "calendar_year",
    label: "Calendar Year Table",
    category: "standard",
    explanation:
      "League table for completed matches with kickoff between 1 January and 31 December of the selected calendar year.",
    calculationMethod:
      "Loads completed fixtures for the competition (optionally narrowed to one season), keeps matches in the selected calendar year, applies all/home/away view, then ranks by league points, wins, points difference, points for, tries for and team name. Rugby seasons crossed by the calendar year are both included.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "on_this_date",
    label: "Table On This Date",
    category: "standard",
    explanation:
      "Rebuild the competition table as it stood after all matches completed on or before the selected date.",
    calculationMethod:
      "Includes completed fixtures in the selected season with completion on or before the as-of date (kickoff date used when completion timestamp is unavailable). Applies season scoring rules and Premiership deductions with known effective dates. Always built as a calculated table from match results.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "between_dates",
    label: "Table Between Two Dates",
    category: "standard",
    explanation:
      "League table for completed matches with kickoff between two selected dates (inclusive).",
    calculationMethod:
      "Keeps completed fixtures in the date range, optionally narrowed to one season, applies all/home/away view and competition scoring rules, then ranks by league points, wins, points difference, points for, tries for and team name.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),

  // Match period
  def({
    id: "first_half",
    label: "First Half Table",
    category: "match_period",
    explanation: "League table based on first-half points only — half-time score is treated as the final result.",
    calculationMethod:
      "Uses verified half-time scores when available, otherwise derives half-time totals from scoring events up to minute 40. Applies competition win/draw/loss points; try and losing bonus only when first-half try data exists. Never guesses from full-time scores.",
    requiredData: ["fixtures", "half_time_scores", "match_events"],
  }),
  def({
    id: "second_half",
    label: "Second Half Table",
    category: "match_period",
    explanation:
      "League table based on second-half points only — scores after half-time are treated as the final result.",
    calculationMethod:
      "Derives second-half points as full-time minus half-time when half-time data exists, otherwise from scoring events after minute 40. Applies competition win/draw/loss points; bonus only when second-half try data exists. Never uses full-time score alone.",
    requiredData: ["fixtures", "half_time_scores", "match_scores", "match_events"],
  }),
  def({
    id: "final_20_minutes",
    label: "Final 20 Minutes Table",
    category: "match_period",
    explanation:
      "League table for points scored from minute 60 to full-time, including added time (extra time excluded by default).",
    calculationMethod:
      "Uses verified scoring events from minute 60 onward, or derives the period as full-time minus verified score at 60 minutes. Applies competition win/draw/loss points; bonus only when period try data exists. Never estimates the 60-minute score.",
    requiredData: ["fixtures", "match_events", "match_scores"],
  }),
  def({
    id: "custom_match_period",
    label: "Table By Custom Match Period",
    category: "match_period",
    explanation: "League table for a custom minute range within matches.",
    calculationMethod: "Sums scoring events between customPeriodStartMinute and customPeriodEndMinute.",
    requiredData: ["fixtures", "match_events"],
    metricLabel: "Period pts",
    hiddenFromMenu: true,
  }),

  // Opposition
  def({
    id: "v_top_half",
    label: "Table v Top Half",
    category: "opposition",
    explanation:
      "League table built only from completed matches against teams in the top half of the full season table.",
    calculationMethod:
      "Builds one shared full-table reference, defines top half as ranks 1 through ceil(n/2), then ranks results from matches v those opponents using the selected opposition position rule.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "v_bottom_half",
    label: "Table v Bottom Half",
    category: "opposition",
    explanation:
      "League table built only from completed matches against teams in the bottom half of the full season table.",
    calculationMethod:
      "Builds one shared full-table reference, defines bottom half as ranks after ceil(n/2), then ranks results from matches v those opponents using the selected opposition position rule.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
  }),

  // Game state
  def({
    id: "scoring_first",
    label: "Table When Scoring First",
    category: "game_state",
    explanation:
      "League table built only from matches where the team registered the opening score of the fixture.",
    calculationMethod:
      "Uses verified match event timelines to identify the first scoring event (try, penalty try, penalty goal or drop goal — conversions excluded). Includes the match only for the team that scored first.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "conceding_first",
    label: "Table When Conceding First",
    category: "game_state",
    explanation:
      "League table built only from matches where the team conceded the opening score of the fixture.",
    calculationMethod:
      "Uses verified match event timelines to identify the first scoring event, then includes the match only for the team that conceded first.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "points_gained_losing",
    label: "Points Gained From Losing Positions",
    category: "game_state",
    explanation:
      "Ranks teams by competition table points earned in matches where they trailed at some stage.",
    calculationMethod:
      "Uses verified score timelines to detect losing positions, then sums the final competition points earned from each qualifying match.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "points_lost_winning",
    label: "Points Lost From Winning Positions",
    category: "game_state",
    explanation:
      "Ranks teams by competition table points lost after holding a lead during a match.",
    calculationMethod:
      "Uses verified score timelines to detect winning positions, compares win baseline points with final table points earned, and never invents an expected try bonus.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
  }),
  def({
    id: "points_gained_drawn",
    label: "Points Gained From Drawn Positions",
    category: "game_state",
    explanation: "League points earned from matches that were level at some stage.",
    calculationMethod: "Includes fixtures where scores were tied during the match.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    metricLabel: "Pts from level",
    hiddenFromMenu: true,
  }),
  def({
    id: "comeback",
    label: "Comeback Table",
    category: "game_state",
    explanation:
      "Teams ranked by successful wins and draws after falling behind during a match.",
    calculationMethod:
      "Uses verified score timelines to detect trailing states, counts final wins and draws as successful comebacks, and never infers comebacks from final scores alone.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    enhancedData: ["half_time_scores", "sixty_minute_scores"],
  }),
  def({
    id: "lead_protection",
    label: "Lead Protection Table",
    category: "game_state",
    explanation:
      "Teams ranked by how well they protect a lead and close out matches after taking the lead.",
    calculationMethod:
      "Uses verified score timelines to detect leading states, tracks wins, draws and losses after leading, and never infers lead protection from final scores alone.",
    requiredData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_events", "match_scores", "competition_scoring_rules"],
    enhancedData: ["half_time_scores", "sixty_minute_scores"],
  }),

  // Rugby scoring
  def({
    id: "tries_scored",
    label: "Tries Scored Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by tries scored across completed matches in the selected period.",
    calculationMethod:
      "Uses verified team try totals or timed try events; never estimates tries from final scores or treats missing data as zero.",
    requiredData: ["team_match_stats", "fixtures", "competition_scoring_rules"],
    minimumData: ["team_match_stats", "fixtures"],
    enhancedData: ["match_events", "competition_scoring_rules"],
  }),
  def({
    id: "tries_conceded",
    label: "Tries Conceded Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by tries conceded across completed matches in the selected period.",
    calculationMethod:
      "Uses verified opponent try totals or timed try events; never estimates tries from final scores or treats missing data as zero.",
    requiredData: ["team_match_stats", "fixtures"],
    minimumData: ["team_match_stats", "fixtures"],
    enhancedData: ["match_events"],
    metricLabel: "Tries conceded",
  }),
  def({
    id: "try_bonus_point",
    label: "Try Bonus Point Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by try-scoring bonus points earned.",
    calculationMethod: "Applies competition try bonus threshold to team try counts per match.",
    requiredData: ["team_match_stats", "competition_scoring_rules", "fixtures"],
    metricLabel: "Try BP",
  }),
  def({
    id: "losing_bonus_point",
    label: "Losing Bonus Point Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by losing bonus points earned within the margin threshold.",
    calculationMethod: "Awards losing bonus when defeat margin is within competition rules.",
    requiredData: ["fixtures", "match_scores", "competition_scoring_rules"],
    metricLabel: "Losing BP",
  }),
  def({
    id: "bonus_points",
    label: "Bonus Points Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by total bonus points (try and losing).",
    calculationMethod: "Sums try and losing bonus points from competition scoring rules.",
    requiredData: ["fixtures", "match_scores", "team_match_stats", "competition_scoring_rules"],
    metricLabel: "Bonus pts",
  }),
  def({
    id: "winning_bonus_points",
    label: "Winning Bonus Points Table",
    category: "rugby_scoring",
    explanation:
      "Teams ranked by try bonus points, losing bonus points, total bonus points and maximum-point wins.",
    calculationMethod:
      "Uses competition scoring rules and verified tries or margins; never guesses bonus points or applies current rules to historic seasons.",
    requiredData: ["fixtures", "match_scores", "team_match_stats", "competition_scoring_rules"],
    minimumData: ["fixtures", "match_scores", "competition_scoring_rules"],
    enhancedData: ["team_match_stats"],
    metricLabel: "Total bonus pts",
  }),
  def({
    id: "points_scored",
    label: "Points Scored Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by match points scored.",
    calculationMethod: "Sums full-time pointsFor from completed fixtures.",
    requiredData: ["fixtures", "match_scores"],
    metricLabel: "Pts scored",
  }),
  def({
    id: "points_conceded",
    label: "Points Conceded Table",
    category: "rugby_scoring",
    explanation: "Teams ranked by match points conceded.",
    calculationMethod: "Sums full-time pointsAgainst from completed fixtures.",
    requiredData: ["fixtures", "match_scores"],
    metricLabel: "Pts conceded",
  }),
  def({
    id: "wins_to_nil",
    label: "Wins To Nil",
    category: "rugby_scoring",
    explanation: "Teams ranked by wins where the opponent scored zero points.",
    calculationMethod: "Counts wins with pointsAgainst = 0.",
    requiredData: ["fixtures", "match_scores"],
    metricLabel: "Wins to nil",
  }),
  def({
    id: "scoreless_matches",
    label: "Scoreless Matches",
    category: "rugby_scoring",
    explanation: "Teams ranked by matches where they failed to score.",
    calculationMethod: "Counts completed fixtures with pointsFor = 0.",
    requiredData: ["fixtures", "match_scores"],
    metricLabel: "Scoreless",
  }),
  def({
    id: "both_teams_scored_tries",
    label: "Both Teams Scored Tries",
    category: "rugby_scoring",
    explanation: "Teams ranked by how often both sides score at least one try in their matches.",
    calculationMethod:
      "Uses verified try totals for both teams; never estimates tries from points or treats missing data as zero.",
    requiredData: ["team_match_stats", "fixtures"],
    minimumData: ["team_match_stats", "fixtures"],
    enhancedData: ["match_events"],
    metricLabel: "BTST yes %",
  }),
  def({
    id: "tryless_opponent",
    label: "Tryless Opponent",
    category: "rugby_scoring",
    explanation: "Teams ranked by matches where they kept the opponent try-less.",
    calculationMethod: "Counts fixtures where triesAgainst = 0 in team_match_stats.",
    requiredData: ["team_match_stats", "fixtures"],
    metricLabel: "Tryless opp.",
  }),

  // Set piece
  def({
    id: "lineout_won",
    label: "Lineout Won Table",
    category: "set_piece",
    explanation: "Teams ranked by lineouts won per match.",
    calculationMethod: "Reads set_piece.lineouts_won from SDMS team_match_stats sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Lineouts won",
  }),
  def({
    id: "lineout_lost",
    label: "Lineout Lost / Conceded Table",
    category: "set_piece",
    explanation: "Teams ranked by lineouts lost or conceded.",
    calculationMethod: "Reads set_piece.lineouts_lost from SDMS team_match_stats sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Lineouts lost",
  }),
  def({
    id: "lineout_success_pct",
    label: "Lineout Success %",
    category: "set_piece",
    explanation: "Teams ranked by lineout success percentage.",
    calculationMethod: "lineouts_won / (lineouts_won + lineouts_lost) from SDMS set_piece sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Lineout %",
  }),
  def({
    id: "scrum_success_pct",
    label: "Scrum Success %",
    category: "set_piece",
    explanation: "Teams ranked by scrum success percentage.",
    calculationMethod: "Uses SDMS set_piece scrum success fields when present.",
    requiredData: ["team_match_stats"],
    metricLabel: "Scrum %",
  }),
  def({
    id: "scrum_penalties_won",
    label: "Scrum Penalties Won",
    category: "set_piece",
    explanation: "Teams ranked by scrum penalties won.",
    calculationMethod: "Reads set_piece.scrum_penalties_won from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Scrum pens won",
  }),
  def({
    id: "scrum_penalties_conceded",
    label: "Scrum Penalties Conceded",
    category: "set_piece",
    explanation: "Teams ranked by scrum penalties conceded.",
    calculationMethod: "Reads set_piece.scrum_penalties_conceded from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Scrum pens conc.",
  }),
  def({
    id: "set_piece_dominance",
    label: "Set Piece Dominance Table",
    category: "set_piece",
    explanation: "Composite ranking from lineout and scrum success metrics.",
    calculationMethod: "Averages available lineout and scrum success percentages per team.",
    requiredData: ["team_match_stats"],
    metricLabel: "Dominance",
  }),

  // Attack
  def({
    id: "carries",
    label: "Carries Table",
    category: "attack",
    explanation: "Teams ranked by carries per match.",
    calculationMethod: "Sums team_match_stats.carries.",
    requiredData: ["team_match_stats", "fixtures"],
    metricLabel: "Carries",
  }),
  def({
    id: "metres_carried",
    label: "Metres Carried Table",
    category: "attack",
    explanation: "Teams ranked by metres gained with ball in hand.",
    calculationMethod: "Sums team_match_stats.metres.",
    requiredData: ["team_match_stats", "fixtures"],
    metricLabel: "Metres",
  }),
  def({
    id: "metres_per_carry",
    label: "Metres Per Carry",
    category: "attack",
    explanation: "Teams ranked by average metres per carry.",
    calculationMethod: "metres / carries from team_match_stats.",
    requiredData: ["team_match_stats"],
    metricLabel: "m/carry",
  }),
  def({
    id: "line_breaks",
    label: "Line Breaks",
    category: "attack",
    explanation: "Teams ranked by line breaks.",
    calculationMethod: "Sums attack.line_breaks from SDMS sections or aggregated player stats.",
    requiredData: ["team_match_stats"],
    metricLabel: "Line breaks",
  }),
  def({
    id: "defenders_beaten",
    label: "Defenders Beaten",
    category: "attack",
    explanation: "Teams ranked by defenders beaten.",
    calculationMethod: "Sums attack.defenders_beaten from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Def. beaten",
  }),
  def({
    id: "post_contact_metres",
    label: "Post-Contact Metres",
    category: "attack",
    explanation: "Teams ranked by post-contact metres.",
    calculationMethod: "Sums attack.post_contact_metres from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "PCM",
  }),
  def({
    id: "try_assists",
    label: "Try Assists",
    category: "attack",
    explanation: "Teams ranked by try assists.",
    calculationMethod: "Sums attack.try_assists from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Try assists",
  }),
  def({
    id: "turnovers_won_attack",
    label: "Turnovers Won",
    category: "attack",
    explanation: "Teams ranked by turnovers won in attack contexts.",
    calculationMethod: "Sums team_match_stats.turnoversWon.",
    requiredData: ["team_match_stats"],
    metricLabel: "Turnovers",
  }),
  def({
    id: "attacking_efficiency",
    label: "Attacking Efficiency",
    category: "attack",
    explanation: "Points scored per carry — a simple attacking efficiency proxy.",
    calculationMethod: "pointsFor / carries using team_match_stats and fixture scores.",
    requiredData: ["team_match_stats", "fixtures", "match_scores"],
    metricLabel: "Pts/carry",
  }),

  // Defence
  def({
    id: "tackles_made",
    label: "Tackles Made",
    category: "defence",
    explanation: "Teams ranked by tackles made.",
    calculationMethod: "Sums team_match_stats.tackles.",
    requiredData: ["team_match_stats"],
    metricLabel: "Tackles",
  }),
  def({
    id: "tackle_completion_pct",
    label: "Tackle Completion %",
    category: "defence",
    explanation: "Teams ranked by tackle completion rate.",
    calculationMethod: "tackles_completed / tackles_made from SDMS defence sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Tackle %",
  }),
  def({
    id: "dominant_tackles",
    label: "Dominant Tackles",
    category: "defence",
    explanation: "Teams ranked by dominant tackles.",
    calculationMethod: "Sums defence.dominant_tackles from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Dominant",
  }),
  def({
    id: "missed_tackles",
    label: "Missed Tackles",
    category: "defence",
    explanation: "Teams ranked by missed tackles (lower is better; table sorts ascending).",
    calculationMethod: "Sums defence.tackles_missed from SDMS sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Missed",
  }),
  def({
    id: "turnovers_won_defence",
    label: "Turnovers Won",
    category: "defence",
    explanation: "Teams ranked by turnovers won in defensive phases.",
    calculationMethod: "Sums team_match_stats.turnoversWon.",
    requiredData: ["team_match_stats"],
    metricLabel: "Turnovers",
  }),
  def({
    id: "tries_conceded_defence",
    label: "Tries Conceded",
    category: "defence",
    explanation: "Defensive view of tries conceded.",
    calculationMethod: "Sums opponent tries from team_match_stats.",
    requiredData: ["team_match_stats", "fixtures"],
    metricLabel: "Tries conc.",
  }),
  def({
    id: "defensive_efficiency",
    label: "Defensive Efficiency",
    category: "defence",
    explanation: "Points conceded per tackle made.",
    calculationMethod: "pointsAgainst / tackles from team_match_stats and fixtures.",
    requiredData: ["team_match_stats", "fixtures", "match_scores"],
    metricLabel: "Pts/tackle",
  }),

  // Possession / territory
  def({
    id: "possession",
    label: "Possession Table",
    category: "possession_territory",
    explanation: "Teams ranked by average possession share.",
    calculationMethod: "Averages possession.overall_percentage from SDMS team_match_stats sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Possession %",
  }),
  def({
    id: "territory",
    label: "Territory Table",
    category: "possession_territory",
    explanation: "Teams ranked by average territory share.",
    calculationMethod: "Averages territory.overall_percentage from SDMS team_match_stats sections.",
    requiredData: ["team_match_stats"],
    metricLabel: "Territory %",
  }),
  def({
    id: "winning_less_possession",
    label: "Winning With Less Possession",
    category: "possession_territory",
    explanation: "Wins achieved while having less than 50% possession.",
    calculationMethod: "Filters wins where possessionPct < 0.5.",
    requiredData: ["team_match_stats", "fixtures", "match_scores"],
    metricLabel: "Low-poss wins",
  }),
  def({
    id: "losing_more_possession",
    label: "Losing With More Possession",
    category: "possession_territory",
    explanation: "Losses suffered while having more than 50% possession.",
    calculationMethod: "Filters losses where possessionPct > 0.5.",
    requiredData: ["team_match_stats", "fixtures", "match_scores"],
    metricLabel: "High-poss losses",
  }),

  // Discipline
  def({
    id: "penalties_conceded",
    label: "Penalties Conceded",
    category: "discipline",
    explanation: "Teams ranked by penalties conceded.",
    calculationMethod: "Sums discipline.penalties_conceded from SDMS sections or card/penalty events.",
    requiredData: ["team_match_stats", "match_events"],
    metricLabel: "Pens",
  }),
  def({
    id: "yellow_cards",
    label: "Yellow Cards",
    category: "discipline",
    explanation: "Teams ranked by yellow cards.",
    calculationMethod: "Counts yellow_card match events per team.",
    requiredData: ["match_events", "fixtures"],
    metricLabel: "Yellows",
  }),
  def({
    id: "red_cards",
    label: "Red Cards",
    category: "discipline",
    explanation: "Teams ranked by red cards.",
    calculationMethod: "Counts red_card match events per team.",
    requiredData: ["match_events", "fixtures"],
    metricLabel: "Reds",
  }),
  def({
    id: "cards_per_match",
    label: "Cards Per Match",
    category: "discipline",
    explanation: "Average cards per match.",
    calculationMethod: "(yellow cards + red cards) / matches played.",
    requiredData: ["match_events", "fixtures"],
    metricLabel: "Cards/match",
  }),
  def({
    id: "discipline_score",
    label: "Discipline Score",
    category: "discipline",
    explanation: "Composite discipline score — lower is better.",
    calculationMethod: "Weighted sum of penalties conceded, yellow cards and red cards.",
    requiredData: ["team_match_stats", "match_events"],
    metricLabel: "Discipline",
  }),
];

const byId = new Map(RUGBY_TABLE_DEFINITIONS.map((row) => [row.id, row]));
const bySlug = new Map(RUGBY_TABLE_DEFINITIONS.map((row) => [row.slug, row]));

export function listRugbyTableDefinitions(
  category?: RugbyTableDefinition["category"],
  options?: { includeHidden?: boolean },
) {
  const includeHidden = options?.includeHidden === true;
  const definitions = includeHidden
    ? RUGBY_TABLE_DEFINITIONS
    : RUGBY_TABLE_DEFINITIONS.filter((row) => !row.hiddenFromMenu);
  if (!category) return definitions;
  return definitions.filter((row) => row.category === category);
}

export function getRugbyTableDefinition(idOrSlug: string): RugbyTableDefinition | null {
  return byId.get(idOrSlug) ?? bySlug.get(idOrSlug) ?? null;
}

export function rugbyTableCategories(): Array<{ id: RugbyTableDefinition["category"]; label: string }> {
  return [
    { id: "standard", label: "Standard Tables" },
    { id: "match_period", label: "Match period" },
    { id: "opposition", label: "Opposition" },
    { id: "game_state", label: "Game state" },
    { id: "rugby_scoring", label: "Rugby scoring" },
    { id: "set_piece", label: "Set piece" },
    { id: "attack", label: "Attack" },
    { id: "defence", label: "Defence" },
    { id: "possession_territory", label: "Possession / territory" },
    { id: "discipline", label: "Discipline" },
  ];
}
