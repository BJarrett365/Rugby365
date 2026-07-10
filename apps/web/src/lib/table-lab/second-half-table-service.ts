import { formatFormDateRange } from "./form-table-service";
import {
  scoringPointsFromMatchEvent,
  type FirstHalfScoreSource,
} from "./first-half-table-service";
import {
  buildLeagueStandingsFromPerspectives,
  filterBySide,
} from "./rugby-table-metrics-service";
import { filterByMinimumMatchesPlayed, parseMinMatchesPlayed } from "./home-table-service";
import { uniqueFixtureCount } from "./calendar-year-table-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

const SCORING_EVENT_TYPES = new Set(["try", "conversion", "penalty", "drop_goal"]);
const SECOND_HALF_MIN_MINUTE = 41;

export type SecondHalfScoreSource = "derived" | "calculated" | null;

type MatchEventLike = {
  eventType: string;
  teamId: string | null;
  minute: number;
  payload?: Record<string, unknown> | null;
};

export function secondHalfScoresFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeScore: number; awayScore: number } | null {
  const scoringEvents = input.events
    .filter((event) => SCORING_EVENT_TYPES.has(event.eventType))
    .filter((event) => event.minute >= SECOND_HALF_MIN_MINUTE)
    .sort((a, b) => a.minute - b.minute);

  if (scoringEvents.length === 0) return null;

  let homeScore = 0;
  let awayScore = 0;
  for (const event of scoringEvents) {
    const points = scoringPointsFromMatchEvent((event.payload ?? {}) as Record<string, unknown>);
    if (event.teamId === input.homeTeamId) homeScore += points;
    else if (event.teamId === input.awayTeamId) awayScore += points;
  }

  return { homeScore, awayScore };
}

export function secondHalfTriesFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeTries: number | null; awayTries: number | null } {
  const secondHalfTries = input.events.filter(
    (event) => event.eventType === "try" && event.minute >= SECOND_HALF_MIN_MINUTE,
  );
  if (secondHalfTries.length === 0) {
    return { homeTries: null, awayTries: null };
  }
  return {
    homeTries: secondHalfTries.filter((event) => event.teamId === input.homeTeamId).length,
    awayTries: secondHalfTries.filter((event) => event.teamId === input.awayTeamId).length,
  };
}

export function resolveSecondHalfScores(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
  homeFullScore: number;
  awayFullScore: number;
  firstHalfHome: number | null;
  firstHalfAway: number | null;
  firstHalfSource?: FirstHalfScoreSource;
}): {
  homeScore: number | null;
  awayScore: number | null;
  homeTries: number | null;
  awayTries: number | null;
  source: SecondHalfScoreSource;
} {
  const tries = secondHalfTriesFromEvents(input);

  if (input.firstHalfHome != null && input.firstHalfAway != null) {
    return {
      homeScore: input.homeFullScore - input.firstHalfHome,
      awayScore: input.awayFullScore - input.firstHalfAway,
      homeTries: tries.homeTries,
      awayTries: tries.awayTries,
      source: "derived",
    };
  }

  const calculated = secondHalfScoresFromEvents(input);
  if (calculated) {
    return {
      homeScore: calculated.homeScore,
      awayScore: calculated.awayScore,
      homeTries: tries.homeTries,
      awayTries: tries.awayTries,
      source: "calculated",
    };
  }

  return {
    homeScore: null,
    awayScore: null,
    homeTries: null,
    awayTries: null,
    source: null,
  };
}

export function hasSecondHalfScores(row: TeamFixturePerspective): boolean {
  return row.secondHalfFor != null && row.secondHalfAgainst != null;
}

export function secondHalfCoverageLabel(
  withDataCount: number,
  completedCount: number,
): string {
  if (completedCount <= 0) {
    return "Second-half data available for 0 of 0 matches — 0% coverage.";
  }
  const pct = Math.round((withDataCount / completedCount) * 100);
  return `Second-half data available for ${withDataCount} of ${completedCount} matches — ${pct}% coverage.`;
}

export function secondHalfCalculationNote(): string {
  return "This table treats second-half scores as the result.";
}

export function toSecondHalfScoringPerspective(
  row: TeamFixturePerspective,
): TeamFixturePerspective {
  return {
    ...row,
    pointsFor: row.secondHalfFor ?? 0,
    pointsAgainst: row.secondHalfAgainst ?? 0,
    triesFor: row.secondHalfTriesFor ?? null,
    triesAgainst: row.secondHalfTriesAgainst ?? null,
  };
}

export function buildSecondHalfTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  minMatchesPlayed?: number;
}): {
  rows: RugbyTableStandingRow[];
  scopedPerspectives: TeamFixturePerspective[];
  scoringPerspectives: TeamFixturePerspective[];
  dateRangeLabel: string | null;
  completedMatchCount: number;
  secondHalfMatchCount: number;
  secondHalfCoveragePct: number;
  coverageLabel: string;
  calculationNote: string;
} {
  let scoped = input.perspectives;
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const completedMatchCount = uniqueFixtureCount(scoped);
  const scoringPerspectives = scoped
    .filter(hasSecondHalfScores)
    .map(toSecondHalfScoringPerspective);

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(scoringPerspectives, input.rules);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const secondHalfMatchCount = uniqueFixtureCount(scoringPerspectives);
  const secondHalfCoveragePct =
    completedMatchCount > 0
      ? Math.round((secondHalfMatchCount / completedMatchCount) * 100)
      : 0;

  return {
    rows,
    scopedPerspectives: scoped,
    scoringPerspectives,
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    completedMatchCount,
    secondHalfMatchCount,
    secondHalfCoveragePct,
    coverageLabel: secondHalfCoverageLabel(secondHalfMatchCount, completedMatchCount),
    calculationNote: secondHalfCalculationNote(),
  };
}
