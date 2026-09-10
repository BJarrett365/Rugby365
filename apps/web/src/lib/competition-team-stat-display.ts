/** Pure helpers for competition team leaderboards. */

/** Try value became 5 points from 1992; RWC 1987–1991 used 4. */
export function tryPointsForSeasonYear(year: number | null | undefined): number {
  return year != null && year < 1992 ? 4 : 5;
}

export function teamMatchScoringPoints(
  input: {
    tries: number;
    conversions: number;
    penalties: number;
    dropGoals: number;
  },
  options?: { seasonYear?: number | null; sections?: unknown },
): number {
  const fromSections = teamStatSectionNumber(options?.sections, ["scoring", "match_points"]);
  if (fromSections > 0) return fromSections;

  const tryPts = tryPointsForSeasonYear(options?.seasonYear);
  return (
    input.tries * tryPts +
    input.conversions * 2 +
    input.penalties * 3 +
    input.dropGoals * 3
  );
}

export function teamStatSectionNumber(sections: unknown, path: string[]): number {
  let cur: unknown = sections;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return 0;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
}

/** Higher wins when multiple provider rows exist for the same fixture+team. */
export function teamMatchStatsProviderPriority(provider: string | null | undefined): number {
  switch (provider) {
    case "sdms":
      return 100;
    case "rugby_data":
      return 90;
    case "manual":
      return 80;
    case "trc_event_rollup":
      return 75;
    case "sa_event_rollup":
      return 60;
    case "rwc_player_rollup":
      return 50;
    default:
      return 10;
  }
}

export const TEAM_ADVANCED_LEADERBOARD_METRICS = [
  "tackles",
  "metres",
  "carries",
  "offloads",
  "turnoversWon",
  "cleanBreaks",
  "defendersBeaten",
] as const;

export type TeamMatchStatMergeInput = {
  sourceProvider: string | null;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  metres: number;
  carries: number;
  tackles: number;
  turnoversWon: number;
  sections: unknown;
};

function pickPositive(current: number, next: number): number {
  return current > 0 ? current : next > 0 ? next : current;
}

function pickMax(current: number, next: number): number {
  return Math.max(current, next);
}

function mergeSectionNumber(
  current: unknown,
  next: unknown,
  path: string[],
  combine: (current: number, next: number) => number = pickPositive,
): number {
  return combine(teamStatSectionNumber(current, path), teamStatSectionNumber(next, path));
}

/**
 * Combine provider rows for the same match+team.
 * Empty SDMS shells (all zeros) must not hide Wikipedia/event scoring.
 * Scoring counts take the max across providers so incomplete Opta kick tallies
 * cannot replace match-sheet conversions/penalties.
 * Non-zero SDMS Opta metrics still win tackle/metre/carry fields.
 */
export function mergeTeamMatchStatRows(rows: TeamMatchStatMergeInput[]): TeamMatchStatMergeInput {
  const sorted = [...rows].sort(
    (a, b) =>
      teamMatchStatsProviderPriority(b.sourceProvider) -
      teamMatchStatsProviderPriority(a.sourceProvider),
  );
  const merged: TeamMatchStatMergeInput = {
    sourceProvider: sorted[0]?.sourceProvider ?? null,
    tries: 0,
    conversions: 0,
    penalties: 0,
    dropGoals: 0,
    metres: 0,
    carries: 0,
    tackles: 0,
    turnoversWon: 0,
    sections: {},
  };
  for (const row of sorted) {
    merged.tries = pickMax(merged.tries, row.tries);
    merged.conversions = pickMax(merged.conversions, row.conversions);
    merged.penalties = pickMax(merged.penalties, row.penalties);
    merged.dropGoals = pickMax(merged.dropGoals, row.dropGoals);
    merged.metres = pickPositive(merged.metres, row.metres);
    merged.carries = pickPositive(merged.carries, row.carries);
    merged.tackles = pickPositive(merged.tackles, row.tackles);
    merged.turnoversWon = pickPositive(merged.turnoversWon, row.turnoversWon);
    merged.sections = {
      scoring: {
        match_points: mergeSectionNumber(
          merged.sections,
          row.sections,
          ["scoring", "match_points"],
          pickMax,
        ),
      },
      attack: {
        offloads: mergeSectionNumber(merged.sections, row.sections, ["attack", "offloads"]),
        clean_breaks: mergeSectionNumber(merged.sections, row.sections, ["attack", "clean_breaks"]),
        defenders_beaten: mergeSectionNumber(merged.sections, row.sections, [
          "attack",
          "defenders_beaten",
        ]),
      },
    };
  }
  return merged;
}

export function teamAdvancedCoverageComplete(input: {
  teamCount: number;
  teamsTracked: number;
  participantCount?: number;
  matches?: number;
  matchesTracked?: number;
}): boolean {
  if (input.teamsTracked <= 0) return false;
  if (input.teamsTracked !== input.teamCount) return false;
  if (input.participantCount != null && input.teamCount !== input.participantCount) return false;
  if (
    input.matches != null &&
    input.matchesTracked != null &&
    (input.matches === 0 || input.matchesTracked !== input.matches)
  ) {
    return false;
  }
  return true;
}

export function teamLeaderboardEmptyMessage(input: {
  hasTrackedData: boolean;
  teamCount: number;
  notHeld?: boolean;
}): string {
  if (input.notHeld) {
    return "The Rugby Championship was not held this season.";
  }
  if (input.teamCount === 0) {
    return "No team statistics available for this season.";
  }
  if (!input.hasTrackedData) {
    return "These statistics were not recorded for this season.";
  }
  return "No data yet for this leaderboard.";
}
