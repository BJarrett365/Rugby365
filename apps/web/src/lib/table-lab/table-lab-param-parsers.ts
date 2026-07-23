/**
 * Client-safe param parsers for Table Lab.
 *
 * These are pure functions (string/number/boolean parsing + labels) with no
 * dependency on the database or any *table-service module that pulls in a
 * heavy calculation chain. This lets client components (e.g. the admin
 * Table Lab view page) import parsing/formatting helpers without
 * accidentally bundling server-only calculation code.
 *
 * Only import from: table-types, first-score-utils, and other pure
 * client-safe modules. Never import from a *table-service module here.
 */
import { parseFirstScoreTypeFilter } from "./first-score-utils";
import type {
  AllTimePremiershipSortBy,
  AllTimeSeasonRangeMode,
  AllTimeTeamStatus,
  OppositionPositionRule,
} from "./table-types";

// ---------------------------------------------------------------------------
// Form table (form-table-service.ts)
// ---------------------------------------------------------------------------

export const FORM_MATCH_COUNT_PRESETS = [3, 5, 6, 10] as const;
export const DEFAULT_FORM_MATCH_COUNT = 5;

export function parseFormMatchCount(value: string | number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_FORM_MATCH_COUNT;
  return Math.min(Math.floor(parsed), 50);
}

export function isPresetFormMatchCount(
  value: number,
): value is (typeof FORM_MATCH_COUNT_PRESETS)[number] {
  return (FORM_MATCH_COUNT_PRESETS as readonly number[]).includes(value);
}

// ---------------------------------------------------------------------------
// Home / venue table (home-table-service.ts)
// ---------------------------------------------------------------------------

export function parseMinMatchesPlayed(value: string | number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), 50);
}

// ---------------------------------------------------------------------------
// Calendar year table (calendar-year-table-service.ts)
// ---------------------------------------------------------------------------

export function parseCalendarYear(value: string | number | null | undefined): number {
  const current = new Date().getFullYear();
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) return current;
  return Math.floor(parsed);
}

// ---------------------------------------------------------------------------
// Live table (live-table-service.ts)
// ---------------------------------------------------------------------------

export function parseLiveTableBoolean(
  value: string | boolean | null | undefined,
  defaultValue: boolean,
): boolean {
  if (value == null) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Final 20 minutes table (final-twenty-minutes-table-service.ts)
// ---------------------------------------------------------------------------

export function parseIncludeExtraTime(
  value: string | boolean | null | undefined,
  defaultValue = false,
): boolean {
  if (value == null) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Opposition position (v-top-half-table-service.ts / v-bottom-half)
// ---------------------------------------------------------------------------

export function parseOppositionPositionRule(
  value: string | null | undefined,
): OppositionPositionRule {
  const normalized = (value ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "at_match" || normalized === "position_at_match") {
    return "position_at_match";
  }
  if (
    normalized === "final" ||
    normalized === "final_season" ||
    normalized === "final_season_position"
  ) {
    return "final_season_position";
  }
  return "current_position";
}

export function oppositionPositionRuleLabel(rule: OppositionPositionRule): string {
  if (rule === "position_at_match") return "Position at time of match";
  if (rule === "final_season_position") return "Final season position";
  return "Current position";
}

// ---------------------------------------------------------------------------
// Points gained from losing positions (points-gained-losing-table-service.ts)
// ---------------------------------------------------------------------------

export type LosingPositionFilter = "any_time" | "half_time" | "after_sixty";

export type PointsGainedLosingSortBy =
  | "points_gained"
  | "comeback_wins"
  | "comeback_win_pct"
  | "avg_points_gained";

export function parseLosingPositionFilter(
  value: string | null | undefined,
): LosingPositionFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "half_time" || normalized === "behind_at_half_time" || normalized === "ht") {
    return "half_time";
  }
  if (
    normalized === "after_sixty" ||
    normalized === "behind_after_60" ||
    normalized === "sixty" ||
    normalized === "60"
  ) {
    return "after_sixty";
  }
  return "any_time";
}

export function parsePointsGainedLosingSortBy(
  value: string | null | undefined,
): PointsGainedLosingSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "comeback_wins" || normalized === "comeback_wins_count") {
    return "comeback_wins";
  }
  if (normalized === "comeback_win_pct" || normalized === "comeback%") {
    return "comeback_win_pct";
  }
  if (normalized === "avg_points_gained" || normalized === "avg_points") {
    return "avg_points_gained";
  }
  return "points_gained";
}

// ---------------------------------------------------------------------------
// Points lost from winning positions (points-lost-winning-table-service.ts)
// ---------------------------------------------------------------------------

export type WinningPositionFilter = LosingPositionFilter;

export type PointsLostWinningSortBy =
  | "points_lost"
  | "losses_after_leading"
  | "draws_after_leading"
  | "lead_protection_pct"
  | "fewest_points_lost"
  | "most_wins_after_leading";

export function parseWinningPositionFilter(
  value: string | null | undefined,
): WinningPositionFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "ahead_at_half_time" ||
    normalized === "ahead_at_ht" ||
    normalized === "leading_at_half_time"
  ) {
    return "half_time";
  }
  if (
    normalized === "ahead_after_60" ||
    normalized === "leading_after_60" ||
    normalized === "ahead_after_sixty"
  ) {
    return "after_sixty";
  }
  if (normalized === "ahead_at_any_time" || normalized === "leading_at_any_time") {
    return "any_time";
  }
  return parseLosingPositionFilter(value);
}

export function parsePointsLostWinningSortBy(
  value: string | null | undefined,
): PointsLostWinningSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "losses_after_leading" || normalized === "losses") {
    return "losses_after_leading";
  }
  if (normalized === "draws_after_leading" || normalized === "draws") {
    return "draws_after_leading";
  }
  if (
    normalized === "lead_protection_pct" ||
    normalized === "lead_protection" ||
    normalized === "best_lead_protection"
  ) {
    return "lead_protection_pct";
  }
  if (normalized === "fewest_points_lost" || normalized === "fewest_lost") {
    return "fewest_points_lost";
  }
  if (
    normalized === "most_wins_after_leading" ||
    normalized === "wins_after_leading"
  ) {
    return "most_wins_after_leading";
  }
  return "points_lost";
}

export function winningPositionFilterLabel(filter: WinningPositionFilter): string {
  if (filter === "half_time") return "Ahead at half-time";
  if (filter === "after_sixty") return "Ahead after 60 minutes";
  return "Ahead at any time";
}

// ---------------------------------------------------------------------------
// Comeback table (comeback-table-service.ts)
// ---------------------------------------------------------------------------

export type ComebackFromFilter = LosingPositionFilter;

export type MinimumDeficitPreset = "any" | "3" | "7" | "10" | "14" | "custom";

export type ComebackSortBy =
  | "comeback_wins"
  | "total_successful_comebacks"
  | "comeback_success_pct"
  | "largest_deficit_overcome"
  | "table_points_gained"
  | "largest_comeback"
  | "final_20_comebacks";

export function parseComebackFromFilter(value: string | null | undefined): ComebackFromFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "comeback_from_half_time" ||
    normalized === "behind_at_half_time"
  ) {
    return "half_time";
  }
  if (normalized === "comeback_from_after_sixty" || normalized === "behind_after_60") {
    return "after_sixty";
  }
  return parseLosingPositionFilter(value);
}

export function parseMinimumDeficitPreset(
  value: string | null | undefined,
): MinimumDeficitPreset {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "3" || normalized === "3_plus" || normalized === "3+") return "3";
  if (normalized === "7" || normalized === "7_plus" || normalized === "7+") return "7";
  if (normalized === "10" || normalized === "10_plus" || normalized === "10+") return "10";
  if (normalized === "14" || normalized === "14_plus" || normalized === "14+") return "14";
  if (normalized === "custom") return "custom";
  return "any";
}

export function parseMinimumDeficitPoints(
  preset: MinimumDeficitPreset,
  customValue: string | number | null | undefined,
): number {
  if (preset === "custom") {
    const parsed = Number(customValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }
  if (preset === "any") return 0;
  return Number(preset);
}

export function parseComebackSortBy(value: string | null | undefined): ComebackSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "total_successful_comebacks" || normalized === "total_comebacks") {
    return "total_successful_comebacks";
  }
  if (normalized === "comeback_success_pct" || normalized === "success_pct") {
    return "comeback_success_pct";
  }
  if (normalized === "largest_deficit_overcome" || normalized === "largest_comeback") {
    return normalized === "largest_comeback" ? "largest_comeback" : "largest_deficit_overcome";
  }
  if (normalized === "table_points_gained" || normalized === "points_gained") {
    return "table_points_gained";
  }
  if (normalized === "final_20_comebacks" || normalized === "final_twenty_comebacks") {
    return "final_20_comebacks";
  }
  return "comeback_wins";
}

export function comebackFromFilterLabel(filter: ComebackFromFilter): string {
  if (filter === "half_time") return "Behind at half-time";
  if (filter === "after_sixty") return "Behind after 60 minutes";
  return "Behind at any time";
}

export function minimumDeficitLabel(preset: MinimumDeficitPreset, points: number): string {
  if (preset === "custom" && points > 0) return `${points}+ points`;
  if (preset === "any") return "Any deficit";
  return `${preset}+ points`;
}

// ---------------------------------------------------------------------------
// Lead protection table (lead-protection-table-service.ts)
// ---------------------------------------------------------------------------

export type LeadPositionFilter = WinningPositionFilter;
export type MinimumLeadPreset = MinimumDeficitPreset;

export type LeadProtectionSortBy =
  | "lead_protection_pct"
  | "most_wins_after_leading"
  | "fewest_points_lost"
  | "fewest_losses_after_leading"
  | "largest_lead_lost"
  | "sixty_minute_lead_protection_pct";

export function parseLeadPositionFilter(value: string | null | undefined): LeadPositionFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "lead_position_half_time" || normalized === "lead_at_half_time") {
    return "half_time";
  }
  if (normalized === "lead_position_after_sixty" || normalized === "lead_after_60") {
    return "after_sixty";
  }
  return parseWinningPositionFilter(value);
}

export function parseMinimumLeadPreset(value: string | null | undefined): MinimumLeadPreset {
  return parseMinimumDeficitPreset(value);
}

export function parseMinimumLeadPoints(
  preset: MinimumLeadPreset,
  customValue: string | number | null | undefined,
): number {
  return parseMinimumDeficitPoints(preset, customValue);
}

export function parseLeadProtectionSortBy(
  value: string | null | undefined,
): LeadProtectionSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "most_wins_after_leading" ||
    normalized === "wins_after_leading"
  ) {
    return "most_wins_after_leading";
  }
  if (normalized === "fewest_points_lost" || normalized === "fewest_lost") {
    return "fewest_points_lost";
  }
  if (
    normalized === "fewest_losses_after_leading" ||
    normalized === "fewest_losses"
  ) {
    return "fewest_losses_after_leading";
  }
  if (normalized === "largest_lead_lost" || normalized === "largest_lead") {
    return "largest_lead_lost";
  }
  if (
    normalized === "sixty_minute_lead_protection_pct" ||
    normalized === "sixty_minute_protection" ||
    normalized === "best_60_minute_lead_protection"
  ) {
    return "sixty_minute_lead_protection_pct";
  }
  return "lead_protection_pct";
}

export function minimumLeadLabel(preset: MinimumLeadPreset, points: number): string {
  if (preset === "custom" && points > 0) return `${points}+ points`;
  if (preset === "any") return "Any lead";
  return `${preset}+ points`;
}

// ---------------------------------------------------------------------------
// Tries scored table (tries-scored-table-service.ts)
// ---------------------------------------------------------------------------

export type TriesScoredPeriod = "full_match" | "first_half" | "second_half" | "final_20";

export type TriesMatchRangePreset = "all" | "3" | "5" | "10" | "custom";

export type TriesScoredSortBy =
  | "tries_scored"
  | "tries_per_match"
  | "try_scoring_rate_pct"
  | "two_plus_tries_pct"
  | "three_plus_tries_pct"
  | "four_plus_tries_pct"
  | "five_plus_tries_pct";

export function parseTriesScoredPeriod(value: string | null | undefined): TriesScoredPeriod {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "first_half" || normalized === "first-half" || normalized === "1h") {
    return "first_half";
  }
  if (normalized === "second_half" || normalized === "second-half" || normalized === "2h") {
    return "second_half";
  }
  if (
    normalized === "final_20" ||
    normalized === "final-20" ||
    normalized === "final_20_minutes" ||
    normalized === "f20"
  ) {
    return "final_20";
  }
  return "full_match";
}

export function parseTriesMatchRangePreset(
  value: string | null | undefined,
): TriesMatchRangePreset {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "3" || normalized === "last_3") return "3";
  if (normalized === "5" || normalized === "last_5") return "5";
  if (normalized === "10" || normalized === "last_10") return "10";
  if (normalized === "custom") return "custom";
  return "all";
}

export function parseTriesMatchRangeCount(
  preset: TriesMatchRangePreset,
  customValue: string | number | null | undefined,
): number | null {
  if (preset === "all") return null;
  if (preset === "custom") {
    const parsed = Number(customValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : null;
  }
  return Number(preset);
}

export function parseTriesScoredSortBy(value: string | null | undefined): TriesScoredSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "tries_per_match" || normalized === "avg_tries") {
    return "tries_per_match";
  }
  if (normalized === "try_scoring_rate_pct" || normalized === "try_scoring_rate") {
    return "try_scoring_rate_pct";
  }
  if (normalized === "two_plus_tries_pct" || normalized === "2_plus_pct") {
    return "two_plus_tries_pct";
  }
  if (normalized === "three_plus_tries_pct" || normalized === "3_plus_pct") {
    return "three_plus_tries_pct";
  }
  if (normalized === "four_plus_tries_pct" || normalized === "4_plus_pct") {
    return "four_plus_tries_pct";
  }
  if (normalized === "five_plus_tries_pct" || normalized === "5_plus_pct") {
    return "five_plus_tries_pct";
  }
  return "tries_scored";
}

export function triesScoredPeriodLabel(period: TriesScoredPeriod): string {
  if (period === "first_half") return "First half";
  if (period === "second_half") return "Second half";
  if (period === "final_20") return "Final 20 minutes";
  return "Full match";
}

export function triesMatchRangeLabel(
  preset: TriesMatchRangePreset,
  count: number | null,
): string {
  if (preset === "all") return "All matches";
  if (preset === "custom" && count) return `Last ${count} matches`;
  if (count) return `Last ${count} matches`;
  return "All matches";
}

// ---------------------------------------------------------------------------
// Tries conceded table (tries-conceded-table-service.ts)
// ---------------------------------------------------------------------------

export type TriesConcededSortBy =
  | "fewest_tries_conceded"
  | "lowest_tries_conceded_per_match"
  | "lowest_try_conceding_rate_pct"
  | "two_plus_conceded_pct"
  | "three_plus_conceded_pct"
  | "four_plus_conceded_pct"
  | "five_plus_conceded_pct";

export function parseTriesConcededSortBy(value: string | null | undefined): TriesConcededSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "lowest_tries_conceded_per_match" ||
    normalized === "tries_conceded_per_match"
  ) {
    return "lowest_tries_conceded_per_match";
  }
  if (
    normalized === "lowest_try_conceding_rate_pct" ||
    normalized === "try_conceding_rate_pct"
  ) {
    return "lowest_try_conceding_rate_pct";
  }
  if (normalized === "two_plus_conceded_pct" || normalized === "2_plus_conceded_pct") {
    return "two_plus_conceded_pct";
  }
  if (normalized === "three_plus_conceded_pct" || normalized === "3_plus_conceded_pct") {
    return "three_plus_conceded_pct";
  }
  if (normalized === "four_plus_conceded_pct" || normalized === "4_plus_conceded_pct") {
    return "four_plus_conceded_pct";
  }
  if (normalized === "five_plus_conceded_pct" || normalized === "5_plus_conceded_pct") {
    return "five_plus_conceded_pct";
  }
  return "fewest_tries_conceded";
}

// ---------------------------------------------------------------------------
// Both teams scored tries table (both-teams-scored-tries-table-service.ts)
// ---------------------------------------------------------------------------

export type BothTeamsScoredTriesSortBy =
  | "yes_pct"
  | "no_pct"
  | "both_teams_2_plus_pct"
  | "both_teams_3_plus_pct"
  | "both_teams_4_plus_pct";

export function parseBothTeamsScoredTriesSortBy(
  value: string | null | undefined,
): BothTeamsScoredTriesSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "no_pct" || normalized === "no_percent") return "no_pct";
  if (normalized === "both_teams_2_plus_pct" || normalized === "2_plus_pct") {
    return "both_teams_2_plus_pct";
  }
  if (normalized === "both_teams_3_plus_pct" || normalized === "3_plus_pct") {
    return "both_teams_3_plus_pct";
  }
  if (normalized === "both_teams_4_plus_pct" || normalized === "4_plus_pct") {
    return "both_teams_4_plus_pct";
  }
  return "yes_pct";
}

// ---------------------------------------------------------------------------
// Winning bonus points table (winning-bonus-points-table-service.ts)
// ---------------------------------------------------------------------------

export type WinningBonusTypeFilter =
  | "all"
  | "try_bonus"
  | "losing_bonus"
  | "maximum_point_wins";

export type WinningBonusPointsSortBy =
  | "total_bonus_points"
  | "try_bonus_points"
  | "losing_bonus_points"
  | "maximum_point_wins"
  | "bonus_point_rate_pct"
  | "bonus_points_per_match";

export function parseWinningBonusTypeFilter(
  value: string | null | undefined,
): WinningBonusTypeFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "try_bonus" || normalized === "try") return "try_bonus";
  if (normalized === "losing_bonus" || normalized === "losing") return "losing_bonus";
  if (
    normalized === "maximum_point_wins" ||
    normalized === "maximum_point_win" ||
    normalized === "max_point_wins"
  ) {
    return "maximum_point_wins";
  }
  return "all";
}

export function parseWinningBonusPointsSortBy(
  value: string | null | undefined,
): WinningBonusPointsSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "try_bonus_points" || normalized === "try_bonus") {
    return "try_bonus_points";
  }
  if (normalized === "losing_bonus_points" || normalized === "losing_bonus") {
    return "losing_bonus_points";
  }
  if (normalized === "maximum_point_wins" || normalized === "max_point_wins") {
    return "maximum_point_wins";
  }
  if (normalized === "bonus_point_rate_pct" || normalized === "bonus_rate") {
    return "bonus_point_rate_pct";
  }
  if (normalized === "bonus_points_per_match" || normalized === "bonus_per_match") {
    return "bonus_points_per_match";
  }
  return "total_bonus_points";
}

// ---------------------------------------------------------------------------
// Conceding first table (conceding-first-table-service.ts)
// ---------------------------------------------------------------------------

export type ConcedingFirstSortBy =
  | "league_points"
  | "comeback_wins"
  | "comeback_win_pct"
  | "points_gained_after_conceding_first";

export function parseConcedingFirstSortBy(
  value: string | null | undefined,
): ConcedingFirstSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "comeback_wins" || normalized === "comeback_wins_count") {
    return "comeback_wins";
  }
  if (normalized === "comeback_win_pct" || normalized === "comeback%") {
    return "comeback_win_pct";
  }
  if (
    normalized === "points_gained_after_conceding_first" ||
    normalized === "points_gained"
  ) {
    return "points_gained_after_conceding_first";
  }
  return "league_points";
}

export function concedingFirstSortByLabel(sortBy: ConcedingFirstSortBy): string {
  if (sortBy === "comeback_wins") return "Comeback wins";
  if (sortBy === "comeback_win_pct") return "Comeback win %";
  if (sortBy === "points_gained_after_conceding_first") {
    return "Points gained after conceding first";
  }
  return "Table points";
}

// ---------------------------------------------------------------------------
// Scoring first table (scoring-first-table-service.ts)
// ---------------------------------------------------------------------------

export type ScoringFirstSortBy =
  | "league_points"
  | "win_pct"
  | "lead_converted_win_pct"
  | "matches_scoring_first_pct";

export function parseScoringFirstSortBy(value: string | null | undefined): ScoringFirstSortBy {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "win_pct" || normalized === "win%") return "win_pct";
  if (normalized === "lead_converted_win_pct" || normalized === "lead_converted") {
    return "lead_converted_win_pct";
  }
  if (normalized === "matches_scoring_first_pct" || normalized === "scoring_first_pct") {
    return "matches_scoring_first_pct";
  }
  return "league_points";
}

export function scoringFirstSortByLabel(sortBy: ScoringFirstSortBy): string {
  if (sortBy === "win_pct") return "Win %";
  if (sortBy === "lead_converted_win_pct") return "Lead converted into win %";
  if (sortBy === "matches_scoring_first_pct") return "Matches scoring first %";
  return "Table points";
}

export { parseFirstScoreTypeFilter };

// ---------------------------------------------------------------------------
// All-time premiership table (all-time-premiership-service.ts)
// ---------------------------------------------------------------------------

export function parseAllTimeSeasonRangeMode(
  value: string | null | undefined,
): AllTimeSeasonRangeMode {
  if (value === "from" || value === "to" || value === "custom") return value;
  return "all";
}

export function parseAllTimeTeamStatus(value: string | null | undefined): AllTimeTeamStatus {
  if (value === "current" || value === "former") return value;
  return "all";
}

export function parseAllTimeSortBy(value: string | null | undefined): AllTimePremiershipSortBy {
  const allowed: AllTimePremiershipSortBy[] = [
    "league_points",
    "seasons",
    "played",
    "won",
    "win_pct",
    "points_for",
    "tries_for",
    "team_name",
  ];
  return allowed.includes(value as AllTimePremiershipSortBy)
    ? (value as AllTimePremiershipSortBy)
    : "league_points";
}

export function parseSeasonYearParam(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1987) return null;
  return Math.floor(parsed);
}
