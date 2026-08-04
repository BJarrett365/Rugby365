/**
 * Pure helpers to grade Betting Intelligence win-probability leans vs results.
 */

export type ModelFavoredSide = "home" | "away";

export function favoredSideFromWinPct(
  homeWinPct: number,
  awayWinPct: number,
): ModelFavoredSide | null {
  if (homeWinPct > awayWinPct) return "home";
  if (awayWinPct > homeWinPct) return "away";
  return null;
}

export function gradeModelPick(input: {
  homeWinPct: number;
  awayWinPct: number;
  homeScore: number;
  awayScore: number;
}): { favored: ModelFavoredSide; correct: boolean } | null {
  const favored = favoredSideFromWinPct(input.homeWinPct, input.awayWinPct);
  if (!favored) return null;
  if (input.homeScore === input.awayScore) {
    return { favored, correct: false };
  }
  const homeWon = input.homeScore > input.awayScore;
  const correct = favored === "home" ? homeWon : !homeWon;
  return { favored, correct };
}
