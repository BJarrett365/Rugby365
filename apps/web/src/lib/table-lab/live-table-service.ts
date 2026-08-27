import {
  formResultForPerspective,
  recentFormMatchesByTeam,
} from "./form-table-service";
import {
  buildLeagueStandingsFromPerspectives,
  filterBySide,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import type {
  FormResult,
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

/** Default club-competition form window. World Cup pool stage overrides to 3 or 4. */
const DEFAULT_LIVE_FORM_SLOTS = 5;

export { parseLiveTableBoolean } from "./table-lab-param-parsers";

export type LiveTableMovement = "up" | "down" | "same";

const COMPLETED_STATUSES = new Set(["full_time", "finished", "completed", "ft"]);
const LIVE_STATUSES = new Set([
  "live",
  "in_progress",
  "first_half",
  "second_half",
  "ht",
  "half_time",
  "halftime",
]);
const SCHEDULED_STATUSES = new Set(["scheduled", "not_started", "fixture", "upcoming"]);
const IGNORED_STATUSES = new Set(["postponed", "cancelled", "suspended"]);

export function isCompletedFixtureStatus(status: string): boolean {
  return COMPLETED_STATUSES.has(status.toLowerCase());
}

export function isLiveFixtureStatus(status: string): boolean {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (COMPLETED_STATUSES.has(normalized) || IGNORED_STATUSES.has(normalized)) return false;
  if (LIVE_STATUSES.has(normalized) || normalized === "live") return true;
  // SDMS phrases e.g. "First Half", "Second Half", "In Play"
  return /\b(first_half|second_half|half_time|in_play|live)\b/.test(normalized);
}

export function isScheduledFixtureStatus(status: string): boolean {
  return SCHEDULED_STATUSES.has(status.toLowerCase());
}

export function formatMatchClock(minute: number, period: string): string {
  const normalized = period.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "ht" || normalized === "half_time") return "HT";
  if (normalized === "ft" || normalized === "full_time") return "FT";
  if (normalized === "first_half" && minute > 40) return `40+${minute - 40}'`;
  if (normalized === "second_half" && minute > 80) return `80+${minute - 80}'`;
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
  /** Cap form sequence length (RWC pools: 3 or 4). */
  formSlots?: number;
}): {
  rows: RugbyTableStandingRow[];
  preMatchRows: RugbyTableStandingRow[];
  liveFixtureCount: number;
  scheduledFixtureCount: number;
} {
  let scoped = input.perspectives;
  if (input.tableView === "home") scoped = filterBySide(scoped, "home");
  if (input.tableView === "away") scoped = filterBySide(scoped, "away");

  const formSlots = input.formSlots ?? DEFAULT_LIVE_FORM_SLOTS;
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

  // Newest-first form from completed + in-play results.
  const formByTeam = new Map<string, FormResult[]>();
  for (const [teamId, matches] of recentFormMatchesByTeam(
    standingPerspectives,
    formSlots,
    input.tableView,
  )) {
    formByTeam.set(teamId, matches.map(formResultForPerspective));
  }

  const preRankByTeam = new Map(preMatchRows.map((row) => [row.teamId, row.rank]));

  rows = rows.map((row) => {
    const livePerspective = liveByTeam.get(row.teamId);
    const previousRank = preRankByTeam.get(row.teamId);
    const movement = input.showMovement
      ? movementFromRanks(row.rank, previousRank)
      : null;
    const liveForm = formByTeam.get(row.teamId) ?? [];
    const syncedRaw = row.formSequence ?? [];
    // Drop synced all-draw placeholders (0–0 imports) so they never win over empty live form.
    const syncedForm =
      syncedRaw.length >= 4 && syncedRaw.every((letter) => letter === "D") ? [] : syncedRaw;
    // Prefer fixture-derived form when it has a full last-N window; otherwise keep
    // synced standing form (often already last-5 from SDMS/wiki recompute).
    const expected = Math.min(Math.max(row.played ?? 0, 0), formSlots);
    const formSequence =
      liveForm.length >= expected && liveForm.length >= syncedForm.length
        ? liveForm
        : syncedForm.length >= liveForm.length
          ? syncedForm
          : liveForm;
    return {
      ...row,
      formSequence,
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
