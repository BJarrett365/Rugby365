import { formatFormDateRange } from "./form-table-service";
import { scoringPointsFromMatchEvent } from "./first-half-table-service";
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
export const FINAL_TWENTY_MIN_MINUTE = 60;

export type FinalTwentyScoreSource = "events" | "derived" | null;

export type MatchEventLike = {
  eventType: string;
  teamId: string | null;
  minute: number;
  second?: number;
  payload?: Record<string, unknown> | null;
};

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

export function isExtraTimeEvent(event: MatchEventLike): boolean {
  const payload = event.payload ?? {};
  const period = String(payload.period ?? payload.phase ?? payload.matchPeriod ?? "").toLowerCase();
  if (period.includes("extra")) return true;
  if (event.eventType === "extra_time") return true;
  return false;
}

export function isFinalTwentyScoringEvent(
  event: MatchEventLike,
  includeExtraTime: boolean,
): boolean {
  if (!SCORING_EVENT_TYPES.has(event.eventType)) return false;
  if (isExtraTimeEvent(event)) return includeExtraTime;
  return event.minute >= FINAL_TWENTY_MIN_MINUTE;
}

export function finalTwentyScoresFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
  includeExtraTime?: boolean;
}): { homeScore: number; awayScore: number } | null {
  const includeExtraTime = input.includeExtraTime === true;
  const scoringEvents = input.events
    .filter((event) => isFinalTwentyScoringEvent(event, includeExtraTime))
    .sort((a, b) => a.minute - b.minute || (a.second ?? 0) - (b.second ?? 0));

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

export function finalTwentyTriesFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
  includeExtraTime?: boolean;
}): { homeTries: number | null; awayTries: number | null } {
  const includeExtraTime = input.includeExtraTime === true;
  const tries = input.events.filter(
    (event) =>
      event.eventType === "try" && isFinalTwentyScoringEvent(event, includeExtraTime),
  );
  if (tries.length === 0) {
    return { homeTries: null, awayTries: null };
  }
  return {
    homeTries: tries.filter((event) => event.teamId === input.homeTeamId).length,
    awayTries: tries.filter((event) => event.teamId === input.awayTeamId).length,
  };
}

export function scoreAtSixtyFromSnapshot(events: MatchEventLike[]): {
  homeScore: number;
  awayScore: number;
} | null {
  const snapshot = events.find((event) => {
    if (event.eventType === "sixty_minute" || event.eventType === "score_at_60") return true;
    if (event.eventType === "period_break" && event.minute === FINAL_TWENTY_MIN_MINUTE) return true;
    return false;
  });
  if (!snapshot) return null;
  const payload = (snapshot.payload ?? {}) as Record<string, unknown>;
  const homeScore = payload.homeScore != null ? Number(payload.homeScore) : null;
  const awayScore = payload.awayScore != null ? Number(payload.awayScore) : null;
  if (homeScore == null || awayScore == null || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return null;
  }
  return { homeScore, awayScore };
}

export function scoreAtSixtyFromEvents(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeScore: number; awayScore: number } | null {
  const scoringEvents = input.events
    .filter((event) => SCORING_EVENT_TYPES.has(event.eventType))
    .filter((event) => event.minute < FINAL_TWENTY_MIN_MINUTE)
    .sort((a, b) => a.minute - b.minute || (a.second ?? 0) - (b.second ?? 0));

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

export function resolveScoreAtSixty(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
}): { homeScore: number; awayScore: number; source: "snapshot" | "events" } | null {
  const snapshot = scoreAtSixtyFromSnapshot(input.events);
  if (snapshot) {
    return { ...snapshot, source: "snapshot" };
  }
  const fromEvents = scoreAtSixtyFromEvents(input);
  if (fromEvents) {
    return { ...fromEvents, source: "events" };
  }
  return null;
}

export function resolveFinalTwentyScores(input: {
  events: MatchEventLike[];
  homeTeamId: string;
  awayTeamId: string;
  homeFullScore: number;
  awayFullScore: number;
  includeExtraTime?: boolean;
}): {
  homeScore: number | null;
  awayScore: number | null;
  homeTries: number | null;
  awayTries: number | null;
  source: FinalTwentyScoreSource;
  scoreAtSixtyHome: number | null;
  scoreAtSixtyAway: number | null;
} {
  const tries = finalTwentyTriesFromEvents(input);
  const fromPeriodEvents = finalTwentyScoresFromEvents(input);
  if (fromPeriodEvents) {
    return {
      homeScore: fromPeriodEvents.homeScore,
      awayScore: fromPeriodEvents.awayScore,
      homeTries: tries.homeTries,
      awayTries: tries.awayTries,
      source: "events",
      scoreAtSixtyHome: null,
      scoreAtSixtyAway: null,
    };
  }

  const scoreAtSixty = resolveScoreAtSixty(input);
  if (scoreAtSixty) {
    return {
      homeScore: input.homeFullScore - scoreAtSixty.homeScore,
      awayScore: input.awayFullScore - scoreAtSixty.awayScore,
      homeTries: tries.homeTries,
      awayTries: tries.awayTries,
      source: "derived",
      scoreAtSixtyHome: scoreAtSixty.homeScore,
      scoreAtSixtyAway: scoreAtSixty.awayScore,
    };
  }

  return {
    homeScore: null,
    awayScore: null,
    homeTries: null,
    awayTries: null,
    source: null,
    scoreAtSixtyHome: null,
    scoreAtSixtyAway: null,
  };
}

export function hasFinalTwentyScores(row: TeamFixturePerspective): boolean {
  return row.finalTwentyFor != null && row.finalTwentyAgainst != null;
}

export function finalTwentyCoverageLabel(
  withDataCount: number,
  completedCount: number,
): string {
  if (completedCount <= 0) {
    return "Final 20 minutes data available for 0 of 0 matches — 0% coverage.";
  }
  const pct = Math.round((withDataCount / completedCount) * 100);
  return `Final 20 minutes data available for ${withDataCount} of ${completedCount} matches — ${pct}% coverage.`;
}

export function finalTwentyCalculationNote(): string {
  return "This table treats points scored from 60 minutes to full-time as the result.";
}

export function toFinalTwentyScoringPerspective(
  row: TeamFixturePerspective,
): TeamFixturePerspective {
  return {
    ...row,
    pointsFor: row.finalTwentyFor ?? 0,
    pointsAgainst: row.finalTwentyAgainst ?? 0,
    triesFor: row.finalTwentyTriesFor ?? null,
    triesAgainst: row.finalTwentyTriesAgainst ?? null,
  };
}

export function buildFinalTwentyTableStandings(input: {
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
  finalTwentyMatchCount: number;
  finalTwentyCoveragePct: number;
  coverageLabel: string;
  calculationNote: string;
} {
  let scoped = input.perspectives;
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const completedMatchCount = uniqueFixtureCount(scoped);
  const scoringPerspectives = scoped
    .filter(hasFinalTwentyScores)
    .map(toFinalTwentyScoringPerspective);

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  let rows = buildLeagueStandingsFromPerspectives(scoringPerspectives, input.rules);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const finalTwentyMatchCount = uniqueFixtureCount(scoringPerspectives);
  const finalTwentyCoveragePct =
    completedMatchCount > 0
      ? Math.round((finalTwentyMatchCount / completedMatchCount) * 100)
      : 0;

  return {
    rows,
    scopedPerspectives: scoped,
    scoringPerspectives,
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
    completedMatchCount,
    finalTwentyMatchCount,
    finalTwentyCoveragePct,
    coverageLabel: finalTwentyCoverageLabel(finalTwentyMatchCount, completedMatchCount),
    calculationNote: finalTwentyCalculationNote(),
  };
}
