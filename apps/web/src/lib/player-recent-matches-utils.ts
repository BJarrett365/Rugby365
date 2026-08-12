/**
 * Pure helpers for Player Recent Matches eligibility / labels (unit-testable).
 */
import { isStarterSquadRole } from "./match-stats-gap-fill";

export function isEligibleRecentAppearance(input: {
  squadRole: string | null | undefined;
  jerseyNumber: number | null | undefined;
  minutesPlayed: number | null | undefined;
  rating: number | null | undefined;
}): boolean {
  const starter = isStarterSquadRole(input.squadRole, input.jerseyNumber);
  const minutes =
    input.minutesPlayed != null && Number.isFinite(input.minutesPlayed)
      ? input.minutesPlayed
      : null;
  const rated = input.rating != null && Number.isFinite(input.rating);
  if (starter) {
    if (minutes === 0 && !rated) return false;
    return true;
  }
  return (minutes != null && minutes > 0) || rated;
}

export function buildRecentMatchLabel(input: {
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
}): string {
  const home = input.homeTeamName?.trim() || "Home";
  const away = input.awayTeamName?.trim() || "Away";
  if (input.homeScore != null && input.awayScore != null) {
    return `${home} ${input.homeScore} - ${input.awayScore} ${away}`;
  }
  return `${home} vs ${away}`;
}
