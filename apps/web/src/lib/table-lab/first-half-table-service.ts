import { formatFormDateRange } from "./form-table-service";
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
const FIRST_HALF_MAX_MINUTE = 40;

export type FirstHalfScoreSource = "verified" | "calculated" | null;

type MatchEventLike = {
  eventType: string;
  teamId: string | null;
  minute: number;
  payload?: unknown;
};

export function scoringPointsFromMatchEvent(payload: Record<string, unknown>): number {
  const points = Number(payload.points ?? payload.scoreValue ?? 0);
  if (Number.isFinite(points) && points > 0) return points;
  const eventType = String(payload.eventType ?? payload.type ?? "").toLowerCase();
  if (eventType.includes("try")) return 5;
  if (eventType.includes("conversion")) return 2;
  if (eventType.includes("penalty")) return 3;
  if (eventType.includes("drop")) return 3;
  return 0;
}

export function firstHalfScoresFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeScore: number; awayScore: number } | null {
  const scoringEvents = input.events
    .filter((event) => SCORING_EVENT_TYPES.has(event.eventType))
    .filter((event) => event.minute <= FIRST_HALF_MAX_MINUTE)
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

export function firstHalfTriesFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeTries: number | null; awayTries: number | null } {
  const firstHalfTries = input.events.filter(
    (event) => event.eventType === "try" && event.minute <= FIRST_HALF_MAX_MINUTE,
  );
  if (firstHalfTries.length === 0) {
    return { homeTries: null, awayTries: null };
  }
  return {
    homeTries: firstHalfTries.filter((event) => event.teamId === input.homeTeamId).length,
    awayTries: firstHalfTries.filter((event) => event.teamId === input.awayTeamId).length,
  };
}

export function resolveFirstHalfScores(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): {
  homeScore: number | null;
  awayScore: number | null;
  homeTries: number | null;
  awayTries: number | null;
  source: FirstHalfScoreSource;
} {
  const halfTime = input.events.find((event) => event.eventType === "half_time");
  const halfPayload = (halfTime?.payload ?? {}) as Record<string, unknown>;
  const verifiedHome =
    halfPayload.homeScore != null ? Number(halfPayload.homeScore) : null;
  const verifiedAway =
    halfPayload.awayScore != null ? Number(halfPayload.awayScore) : null;

  const tries = firstHalfTriesFromEvents(input);

  if (verifiedHome != null && verifiedAway != null) {
    return {
      homeScore: verifiedHome,
      awayScore: verifiedAway,
      homeTries: tries.homeTries,
      awayTries: tries.awayTries,
      source: "verified",
    };
  }

  const calculated = firstHalfScoresFromEvents(input);
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

export function hasFirstHalfScores(row: TeamFixturePerspective): boolean {
  return row.firstHalfFor != null && row.firstHalfAgainst != null;
}

export function fixturesWithFirstHalfData(perspectives: TeamFixturePerspective[]): number {
  const fixtureIds = new Set<string>();
  for (const row of perspectives) {
    if (hasFirstHalfScores(row)) fixtureIds.add(row.fixtureId);
  }
  return fixtureIds.size;
}

export function firstHalfCoverageLabel(
  withDataCount: number,
  completedCount: number,
): string {
  if (completedCount <= 0) {
    return "First-half data available for 0 of 0 matches — 0% coverage.";
  }
  const pct = Math.round((withDataCount / completedCount) * 100);
  return `First-half data available for ${withDataCount} of ${completedCount} matches — ${pct}% coverage.`;
}

export function firstHalfCalculationNote(): string {
  return "This table treats the half-time score as the final result.";
}

export function toFirstHalfScoringPerspective(
  row: TeamFixturePerspective,
): TeamFixturePerspective {
  return {
    ...row,
    pointsFor: row.firstHalfFor ?? 0,
    pointsAgainst: row.firstHalfAgainst ?? 0,
    triesFor: row.firstHalfTriesFor ?? null,
    triesAgainst: row.firstHalfTriesAgainst ?? null,
  };
}

export function buildFirstHalfTableStandings(input: {
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
  firstHalfMatchCount: number;
  firstHalfCoveragePct: number;
  coverageLabel: string;
  calculationNote: string;
} {
  let scoped = input.perspectives;
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const completedMatchCount = uniqueFixtureCount(scoped);
  const scoringPerspectives = scoped
    .filter(hasFirstHalfScores)
    .map(toFirstHalfScoringPerspective);

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(scoringPerspectives, input.rules);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const firstHalfMatchCount = uniqueFixtureCount(scoringPerspectives);
  const firstHalfCoveragePct =
    completedMatchCount > 0
      ? Math.round((firstHalfMatchCount / completedMatchCount) * 100)
      : 0;

  return {
    rows,
    scopedPerspectives: scoped,
    scoringPerspectives,
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    completedMatchCount,
    firstHalfMatchCount,
    firstHalfCoveragePct,
    coverageLabel: firstHalfCoverageLabel(firstHalfMatchCount, completedMatchCount),
    calculationNote: firstHalfCalculationNote(),
  };
}
