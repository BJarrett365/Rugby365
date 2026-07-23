import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
  venueWinPct,
} from "./home-table-service";
import { matchCompletionInstant } from "./on-this-date-table-service";
import {
  buildLeagueStandingsFromPerspectives,
  filterByKickoffRange,
  filterBySide,
} from "./rugby-table-metrics-service";
import type {
  OppositionPositionRule,
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { OppositionPositionRule };

export {
  oppositionPositionRuleLabel,
  parseOppositionPositionRule,
} from "./table-lab-param-parsers";

export function topHalfCutoff(teamCount: number): number {
  if (teamCount <= 0) return 0;
  return Math.ceil(teamCount / 2);
}

function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const mod10 = rank % 10;
  if (mod10 === 1) return `${rank}st`;
  if (mod10 === 2) return `${rank}nd`;
  if (mod10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

export function formatTopHalfRankRange(cutoff: number): string {
  if (cutoff <= 0) return "—";
  if (cutoff === 1) return ordinal(1);
  return `${ordinal(1)}–${ordinal(cutoff)}`;
}

export function formatBottomHalfRankRange(topHalfCutoff: number, teamCount: number): string {
  if (teamCount <= 0 || topHalfCutoff >= teamCount) return "—";
  const start = topHalfCutoff + 1;
  if (start === teamCount) return ordinal(teamCount);
  return `${ordinal(start)}–${ordinal(teamCount)}`;
}

export function bottomHalfTeamIdsFromStandings(
  rows: RugbyTableStandingRow[],
  topHalfCutoff: number,
): Set<string> {
  return new Set(rows.filter((row) => row.rank > topHalfCutoff).map((row) => row.teamId));
}

export function rankMapFromStandings(rows: RugbyTableStandingRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.teamId, row.rank]));
}

export function topHalfTeamIdsFromStandings(
  rows: RugbyTableStandingRow[],
  cutoff: number,
): Set<string> {
  return new Set(rows.filter((row) => row.rank <= cutoff).map((row) => row.teamId));
}

export function isSeasonIncompleteFromStandings(rows: RugbyTableStandingRow[]): boolean {
  if (rows.length === 0) return true;
  const maxPlayed = Math.max(...rows.map((row) => row.played));
  if (maxPlayed === 0) return true;
  return rows.some((row) => row.played < maxPlayed);
}

export function perspectivesCompletedBeforeKickoff(
  perspectives: TeamFixturePerspective[],
  kickoffAt: Date,
): TeamFixturePerspective[] {
  return perspectives.filter((row) => {
    const completed = matchCompletionInstant(row);
    if (!completed || !kickoffAt) return false;
    return completed < kickoffAt;
  });
}

export function opponentRankBeforeMatch(input: {
  allPerspectives: TeamFixturePerspective[];
  opponentId: string;
  kickoffAt: Date;
  rules: RugbyScoringRules;
}): number | null {
  const before = perspectivesCompletedBeforeKickoff(input.allPerspectives, input.kickoffAt);
  if (before.length === 0) return null;
  const standings = buildLeagueStandingsFromPerspectives(before, input.rules);
  return standings.find((row) => row.teamId === input.opponentId)?.rank ?? null;
}

export function isOpponentInTopHalf(input: {
  perspective: TeamFixturePerspective;
  rule: OppositionPositionRule;
  topHalfCutoff: number;
  topHalfTeamIds: Set<string>;
  referencePerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
}): boolean {
  if (input.topHalfCutoff <= 0) return false;

  if (input.rule === "position_at_match") {
    if (!input.perspective.kickoffAt) return false;
    const rank = opponentRankBeforeMatch({
      allPerspectives: input.referencePerspectives,
      opponentId: input.perspective.opponentId,
      kickoffAt: input.perspective.kickoffAt,
      rules: input.rules,
    });
    return rank != null && rank <= input.topHalfCutoff;
  }

  return input.topHalfTeamIds.has(input.perspective.opponentId);
}

export function filterVsTopHalfPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  referencePerspectives: TeamFixturePerspective[];
  rule: OppositionPositionRule;
  topHalfCutoff: number;
  topHalfTeamIds: Set<string>;
  rules: RugbyScoringRules;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((perspective) =>
    isOpponentInTopHalf({
      perspective,
      rule: input.rule,
      topHalfCutoff: input.topHalfCutoff,
      topHalfTeamIds: input.topHalfTeamIds,
      referencePerspectives: input.referencePerspectives,
      rules: input.rules,
    }),
  );
}

export function isOpponentInBottomHalf(input: {
  perspective: TeamFixturePerspective;
  rule: OppositionPositionRule;
  topHalfCutoff: number;
  bottomHalfTeamIds: Set<string>;
  referencePerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
}): boolean {
  if (input.topHalfCutoff <= 0) return false;

  if (input.rule === "position_at_match") {
    if (!input.perspective.kickoffAt) return false;
    const rank = opponentRankBeforeMatch({
      allPerspectives: input.referencePerspectives,
      opponentId: input.perspective.opponentId,
      kickoffAt: input.perspective.kickoffAt,
      rules: input.rules,
    });
    return rank != null && rank > input.topHalfCutoff;
  }

  return input.bottomHalfTeamIds.has(input.perspective.opponentId);
}

export function filterVsBottomHalfPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  referencePerspectives: TeamFixturePerspective[];
  rule: OppositionPositionRule;
  topHalfCutoff: number;
  bottomHalfTeamIds: Set<string>;
  rules: RugbyScoringRules;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((perspective) =>
    isOpponentInBottomHalf({
      perspective,
      rule: input.rule,
      topHalfCutoff: input.topHalfCutoff,
      bottomHalfTeamIds: input.bottomHalfTeamIds,
      referencePerspectives: input.referencePerspectives,
      rules: input.rules,
    }),
  );
}

export function enrichVTopHalfRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  return rows.map((row) => ({
    ...row,
    winPct: row.played > 0 ? venueWinPct(row.won, row.played) : undefined,
  }));
}

export function sortVTopHalfRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    const aWinPct = a.winPct ?? (a.played > 0 ? a.won / a.played : 0);
    const bWinPct = b.winPct ?? (b.played > 0 ? b.won / b.played : 0);
    if (bWinPct !== aWinPct) return bWinPct - aWinPct;
    return a.teamName.localeCompare(b.teamName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function applyVTopHalfPostProcessing(
  rows: RugbyTableStandingRow[],
  minMatchesPlayed?: number,
): RugbyTableStandingRow[] {
  const minimum = parseMinMatchesPlayed(minMatchesPlayed);
  let processed = enrichVTopHalfRows(rows);
  processed = sortVTopHalfRows(processed);
  if (minimum > 1) {
    processed = filterByMinimumMatchesPlayed(processed, minimum);
  }
  return processed;
}

export function uniqueFixtureCount(perspectives: TeamFixturePerspective[]): number {
  return new Set(perspectives.map((row) => row.fixtureId)).size;
}

export function buildTopHalfFilterSummary(input: {
  rule: OppositionPositionRule;
  rankRangeLabel: string;
  tableView: RugbyTableView;
  seasonIncomplete: boolean;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";

  if (input.rule === "position_at_match") {
    return `This table includes ${venue}matches played against opponents ranked ${input.rankRangeLabel} immediately before kick-off.`;
  }

  const positionWord =
    input.rule === "final_season_position"
      ? input.seasonIncomplete
        ? "provisionally ranked"
        : "that finished"
      : "currently ranked";

  return `This table includes ${venue}matches played against teams ${positionWord} ${input.rankRangeLabel}.`;
}

export function buildBottomHalfFilterSummary(input: {
  rule: OppositionPositionRule;
  rankRangeLabel: string;
  tableView: RugbyTableView;
  seasonIncomplete: boolean;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";

  if (input.rule === "position_at_match") {
    return `This table includes ${venue}matches played against opponents ranked ${input.rankRangeLabel} immediately before kick-off.`;
  }

  const positionWord =
    input.rule === "final_season_position"
      ? input.seasonIncomplete
        ? "provisionally ranked"
        : "that finished"
      : "currently ranked";

  return `This table includes ${venue}matches played against teams ${positionWord} ${input.rankRangeLabel}.`;
}

export function buildVTopHalfTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  oppositionPositionRule: OppositionPositionRule;
  minMatchesPlayed?: number;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  referenceRows: RugbyTableStandingRow[];
  topHalfCutoff: number;
  topHalfRankRangeLabel: string;
  topHalfTeamCount: number;
  topHalfMatchCount: number;
  filterSummary: string;
  dateRangeLabel: string | null;
  seasonIncomplete: boolean;
  provisionalFinalSeason: boolean;
} {
  const referenceRows = buildLeagueStandingsFromPerspectives(input.seasonPerspectives, input.rules);
  const cutoff = topHalfCutoff(referenceRows.length);
  const topHalfTeamIds = topHalfTeamIdsFromStandings(referenceRows, cutoff);
  const rankRangeLabel = formatTopHalfRankRange(cutoff);
  const seasonIncomplete = isSeasonIncompleteFromStandings(referenceRows);
  const provisionalFinalSeason =
    input.oppositionPositionRule === "final_season_position" && seasonIncomplete;

  let scoped = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scoped = filterByKickoffRange(scoped, input.dateFrom, input.dateTo);
  }

  const vsTopHalf = filterVsTopHalfPerspectives({
    perspectives: scoped,
    referencePerspectives: input.seasonPerspectives,
    rule: input.oppositionPositionRule,
    topHalfCutoff: cutoff,
    topHalfTeamIds,
    rules: input.rules,
  });

  let scoringPerspectives = vsTopHalf;
  if (input.tableView === "home") scoringPerspectives = filterBySide(scoringPerspectives, "home");
  if (input.tableView === "away") scoringPerspectives = filterBySide(scoringPerspectives, "away");

  let rows = buildLeagueStandingsFromPerspectives(scoringPerspectives, input.rules);
  rows = applyVTopHalfPostProcessing(rows, input.minMatchesPlayed);

  return {
    rows,
    scoringPerspectives,
    referenceRows,
    topHalfCutoff: cutoff,
    topHalfRankRangeLabel: rankRangeLabel,
    topHalfTeamCount: topHalfTeamIds.size,
    topHalfMatchCount: uniqueFixtureCount(scoringPerspectives),
    filterSummary: buildTopHalfFilterSummary({
      rule: input.oppositionPositionRule,
      rankRangeLabel,
      tableView: input.tableView,
      seasonIncomplete,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    seasonIncomplete,
    provisionalFinalSeason,
  };
}

export function buildVBottomHalfTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  oppositionPositionRule: OppositionPositionRule;
  minMatchesPlayed?: number;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  referenceRows: RugbyTableStandingRow[];
  topHalfCutoff: number;
  bottomHalfRankRangeLabel: string;
  bottomHalfTeamCount: number;
  bottomHalfMatchCount: number;
  filterSummary: string;
  dateRangeLabel: string | null;
  seasonIncomplete: boolean;
  provisionalFinalSeason: boolean;
} {
  const referenceRows = buildLeagueStandingsFromPerspectives(input.seasonPerspectives, input.rules);
  const cutoff = topHalfCutoff(referenceRows.length);
  const bottomHalfTeamIds = bottomHalfTeamIdsFromStandings(referenceRows, cutoff);
  const rankRangeLabel = formatBottomHalfRankRange(cutoff, referenceRows.length);
  const seasonIncomplete = isSeasonIncompleteFromStandings(referenceRows);
  const provisionalFinalSeason =
    input.oppositionPositionRule === "final_season_position" && seasonIncomplete;

  let scoped = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scoped = filterByKickoffRange(scoped, input.dateFrom, input.dateTo);
  }

  const vsBottomHalf = filterVsBottomHalfPerspectives({
    perspectives: scoped,
    referencePerspectives: input.seasonPerspectives,
    rule: input.oppositionPositionRule,
    topHalfCutoff: cutoff,
    bottomHalfTeamIds,
    rules: input.rules,
  });

  let scoringPerspectives = vsBottomHalf;
  if (input.tableView === "home") scoringPerspectives = filterBySide(scoringPerspectives, "home");
  if (input.tableView === "away") scoringPerspectives = filterBySide(scoringPerspectives, "away");

  let rows = buildLeagueStandingsFromPerspectives(scoringPerspectives, input.rules);
  rows = applyVTopHalfPostProcessing(rows, input.minMatchesPlayed);

  return {
    rows,
    scoringPerspectives,
    referenceRows,
    topHalfCutoff: cutoff,
    bottomHalfRankRangeLabel: rankRangeLabel,
    bottomHalfTeamCount: bottomHalfTeamIds.size,
    bottomHalfMatchCount: uniqueFixtureCount(scoringPerspectives),
    filterSummary: buildBottomHalfFilterSummary({
      rule: input.oppositionPositionRule,
      rankRangeLabel,
      tableView: input.tableView,
      seasonIncomplete,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    seasonIncomplete,
    provisionalFinalSeason,
  };
}
