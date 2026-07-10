import {
  buildLeagueStandingsFromPerspectives,
  filterBySide,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type LiveTableMovement = "up" | "down" | "same";

const COMPLETED_STATUSES = new Set(["full_time", "finished", "completed", "ft"]);
const LIVE_STATUSES = new Set([
  "live",
  "in_progress",
  "first_half",
  "second_half",
  "ht",
  "half_time",
]);
const SCHEDULED_STATUSES = new Set(["scheduled", "not_started", "fixture", "upcoming"]);
const IGNORED_STATUSES = new Set(["postponed", "cancelled", "suspended"]);

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

export function isCompletedFixtureStatus(status: string): boolean {
  return COMPLETED_STATUSES.has(status.toLowerCase());
}

export function isLiveFixtureStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  if (COMPLETED_STATUSES.has(normalized) || IGNORED_STATUSES.has(normalized)) return false;
  return LIVE_STATUSES.has(normalized) || normalized === "live";
}

export function isScheduledFixtureStatus(status: string): boolean {
  return SCHEDULED_STATUSES.has(status.toLowerCase());
}

export function formatMatchClock(minute: number, period: string): string {
  const normalized = period.toLowerCase();
  if (normalized === "ht" || normalized === "half_time") return "HT";
  if (minute > 0) return `${minute}'`;
  return "Live";
}

export function liveTableCalculationNote(): string {
  return "Live table is calculated from completed matches plus current in-play scores.";
}

export function liveScoreLabel(pointsFor: number, pointsAgainst: number): string {
  return `${pointsFor}–${pointsAgainst}`;
}

export function liveMatchLabel(row: TeamFixturePerspective): string {
  return `vs ${row.opponentName} ${liveScoreLabel(row.pointsFor, row.pointsAgainst)}`;
}

export function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

export function formatMovementLabel(
  rank: number,
  previousRank: number,
  movement: LiveTableMovement,
): string {
  if (movement === "up") return `${ordinal(rank)} ↑ from ${ordinal(previousRank)}`;
  if (movement === "down") return `${ordinal(rank)} ↓ from ${ordinal(previousRank)}`;
  return `${ordinal(rank)} —`;
}

export function movementFromRanks(
  rank: number,
  previousRank: number | undefined,
): LiveTableMovement | null {
  if (previousRank == null) return null;
  if (rank < previousRank) return "up";
  if (rank > previousRank) return "down";
  return "same";
}

/** Live in-play result from current scoreline (0–0 is a draw at kick-off). */
export function liveResultFromScores(
  pointsFor: number,
  pointsAgainst: number,
): "won" | "drawn" | "lost" {
  return matchLeaguePoints(pointsFor, pointsAgainst, null).result;
}

export function buildLiveTableStandings(input: {
  perspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  showMovement: boolean;
}): {
  rows: RugbyTableStandingRow[];
  preMatchRows: RugbyTableStandingRow[];
  liveFixtureCount: number;
  scheduledFixtureCount: number;
} {
  let scoped = input.perspectives;
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const standingPerspectives = scoped.filter((row) => row.countsTowardStandings !== false);
  const preMatchPerspectives = standingPerspectives.filter((row) => !row.isLive);
  const liveFixtureCount = new Set(
    standingPerspectives.filter((row) => row.isLive).map((row) => row.fixtureId),
  ).size;
  const scheduledFixtureCount = new Set(
    scoped.filter((row) => row.isScheduled).map((row) => row.fixtureId),
  ).size;

  const preMatchRows = buildLeagueStandingsFromPerspectives(preMatchPerspectives, input.rules);
  let rows = buildLeagueStandingsFromPerspectives(standingPerspectives, input.rules);

  const liveByTeam = new Map<string, TeamFixturePerspective>();
  for (const row of standingPerspectives) {
    if (row.isLive) liveByTeam.set(row.teamId, row);
  }

  const preRankByTeam = new Map(preMatchRows.map((row) => [row.teamId, row.rank]));

  rows = rows.map((row) => {
    const livePerspective = liveByTeam.get(row.teamId);
    const previousRank = preRankByTeam.get(row.teamId);
    const movement = input.showMovement
      ? movementFromRanks(row.rank, previousRank)
      : null;
    return {
      ...row,
      previousRank: previousRank ?? null,
      movement,
      movementLabel:
        movement && previousRank != null
          ? formatMovementLabel(row.rank, previousRank, movement)
          : null,
      liveMatchLabel: livePerspective ? liveMatchLabel(livePerspective) : null,
      liveCurrentScore: livePerspective
        ? liveScoreLabel(livePerspective.pointsFor, livePerspective.pointsAgainst)
        : null,
      liveMatchClock: livePerspective?.matchClockLabel ?? null,
      liveStatus: livePerspective?.isLive ? livePerspective.fixtureStatus ?? "live" : null,
    };
  });

  return {
    rows,
    preMatchRows,
    liveFixtureCount,
    scheduledFixtureCount,
  };
}
