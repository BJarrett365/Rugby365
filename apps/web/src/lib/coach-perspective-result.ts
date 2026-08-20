/**
 * Canonical coach-perspective match result helper.
 *
 * Score display is ALWAYS pointsFor–pointsAgainst from the coach's team,
 * never raw home–away order. Use this everywhere in the Coach platform.
 */

export type CoachVenueType = "H" | "A" | "N";
export type CoachResultCode = "W" | "D" | "L";

export type CoachPerspectiveMatchInput = {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeCrestUrl?: string | null;
  awayCrestUrl?: string | null;
  isNeutralVenue?: boolean | null;
  competitionName?: string | null;
  competition?: string | null;
  kickoffAt?: string | Date | null;
  matchDate?: string | Date | null;
  /** Optional stored W/D/L — compared against score-derived result. */
  storedResult?: CoachResultCode | string | null;
};

export type CoachPerspectiveResult = {
  coachTeamId: string | null;
  coachTeamName: string | null;
  opponentTeamId: string | null;
  opponentName: string | null;
  opponentCrest: string | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  result: CoachResultCode | null;
  venueType: CoachVenueType | null;
  competition: string | null;
  matchDate: string | null;
  /** True when coachTeamId matches both home and away (data corruption). */
  ambiguousTeamLink: boolean;
  /** True when a stored W/D/L conflicts with score-derived result. */
  resultConflict: boolean;
  /** Human-readable data issues for audits / CMS flags. */
  dataIssues: string[];
};

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function deriveResult(pointsFor: number, pointsAgainst: number): CoachResultCode {
  if (pointsFor > pointsAgainst) return "W";
  if (pointsFor < pointsAgainst) return "L";
  return "D";
}

/**
 * Resolve a fixture from the coach's team perspective.
 *
 * @param match Fixture fields (home/away scores + teams)
 * @param coachTeamId The team the coach was appointed to for this match
 */
export function getCoachPerspectiveResult(
  match: CoachPerspectiveMatchInput,
  coachTeamId: string | null | undefined,
): CoachPerspectiveResult {
  const dataIssues: string[] = [];
  const competition = match.competitionName ?? match.competition ?? null;
  const matchDate = toIsoDate(match.matchDate ?? match.kickoffAt);

  const homeId = match.homeTeamId ?? null;
  const awayId = match.awayTeamId ?? null;
  const teamId = coachTeamId?.trim() ? coachTeamId.trim() : null;

  if (!teamId) {
    dataIssues.push("unknown_coach_team");
    return {
      coachTeamId: null,
      coachTeamName: null,
      opponentTeamId: null,
      opponentName: null,
      opponentCrest: null,
      pointsFor: null,
      pointsAgainst: null,
      result: null,
      venueType: null,
      competition,
      matchDate,
      ambiguousTeamLink: false,
      resultConflict: false,
      dataIssues,
    };
  }

  const isHome = homeId != null && homeId === teamId;
  const isAway = awayId != null && awayId === teamId;
  const ambiguousTeamLink = isHome && isAway;

  if (ambiguousTeamLink) {
    dataIssues.push("coach_linked_to_both_teams");
  }

  if (!isHome && !isAway) {
    dataIssues.push("coach_team_not_in_fixture");
    return {
      coachTeamId: teamId,
      coachTeamName: null,
      opponentTeamId: null,
      opponentName: null,
      opponentCrest: null,
      pointsFor: null,
      pointsAgainst: null,
      result: null,
      venueType: match.isNeutralVenue ? "N" : null,
      competition,
      matchDate,
      ambiguousTeamLink: false,
      resultConflict: false,
      dataIssues,
    };
  }

  // Prefer home link if somehow both match (flagged above).
  const side: "home" | "away" = isHome ? "home" : "away";

  const coachTeamName = side === "home" ? match.homeTeamName ?? null : match.awayTeamName ?? null;
  const opponentTeamId = side === "home" ? awayId : homeId;
  const opponentName = side === "home" ? match.awayTeamName ?? null : match.homeTeamName ?? null;
  const opponentCrest =
    side === "home" ? match.awayCrestUrl ?? null : match.homeCrestUrl ?? null;

  const homeScore = match.homeScore;
  const awayScore = match.awayScore;
  const hasScores = homeScore != null && awayScore != null && Number.isFinite(homeScore) && Number.isFinite(awayScore);

  let pointsFor: number | null = null;
  let pointsAgainst: number | null = null;
  let result: CoachResultCode | null = null;

  if (!hasScores) {
    dataIssues.push("missing_score");
  } else {
    pointsFor = side === "home" ? Number(homeScore) : Number(awayScore);
    pointsAgainst = side === "home" ? Number(awayScore) : Number(homeScore);
    result = deriveResult(pointsFor, pointsAgainst);
  }

  const venueType: CoachVenueType = match.isNeutralVenue ? "N" : side === "home" ? "H" : "A";

  let resultConflict = false;
  const stored = match.storedResult
    ? String(match.storedResult).trim().toUpperCase()
    : null;
  if (result && stored && (stored === "W" || stored === "D" || stored === "L") && stored !== result) {
    resultConflict = true;
    dataIssues.push(`result_conflict:stored=${stored}:derived=${result}`);
  }

  return {
    coachTeamId: teamId,
    coachTeamName,
    opponentTeamId,
    opponentName,
    opponentCrest,
    pointsFor,
    pointsAgainst,
    result,
    venueType,
    competition,
    matchDate,
    ambiguousTeamLink,
    resultConflict,
    dataIssues,
  };
}

/** Compact overview date: 08 AUG 26 */
export function formatCoachResultDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = d
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day} ${mon} ${year}`;
}
