/**
 * Pure Coach / Referee Match Rating helpers (1.0–10.0).
 * Separate from player match-v1 and career coach/referee intelligence scores.
 */

import {
  bandLabel,
  clampMatchRating10,
  performanceBandFor,
  type PerformanceBand,
  type PerformanceTrend,
} from "./match-rating-math";

export const COACH_MATCH_RATING_MODEL = "coach-match-v1" as const;
export const REFEREE_MATCH_RATING_MODEL = "referee-match-v1" as const;

export type StaffMatchSide = "home" | "away";

export type CoachMatchRatingInput = {
  side: StaffMatchSide;
  homeScore: number;
  awayScore: number;
  teamTries: number;
  oppTries: number;
  teamMetres: number;
  oppMetres: number;
  teamTackles: number;
  teamTurnoversWon: number;
  yellowCards: number;
  redCards: number;
};

export type RefereeMatchRatingInput = {
  homeScore: number;
  awayScore: number;
  yellowCards: number;
  redCards: number;
  penaltyEvents: number;
};

export type StaffRatingResult = {
  rating: number;
  band: PerformanceBand;
  explanation: string;
  positiveImpacts: string[];
  deductions: string[];
  matchContext: string[];
};

function resultDelta(side: StaffMatchSide, homeScore: number, awayScore: number): {
  outcome: "win" | "draw" | "loss";
  margin: number;
  for: number;
  against: number;
} {
  const forScore = side === "home" ? homeScore : awayScore;
  const against = side === "home" ? awayScore : homeScore;
  const margin = forScore - against;
  if (margin > 0) return { outcome: "win", margin, for: forScore, against };
  if (margin < 0) return { outcome: "loss", margin, for: forScore, against };
  return { outcome: "draw", margin: 0, for: forScore, against };
}

export function computeCoachMatchRating(input: CoachMatchRatingInput): StaffRatingResult {
  const result = resultDelta(input.side, input.homeScore, input.awayScore);
  const positive: string[] = [];
  const deductions: string[] = [];
  const context: string[] = [
    `${input.side === "home" ? "Home" : "Away"} coach`,
    `Scoreline ${result.for}–${result.against}`,
  ];

  let raw = 5.8;
  if (result.outcome === "win") {
    raw += 1.1;
    positive.push("Won the match");
    raw += Math.min(0.9, result.margin * 0.06);
    if (result.margin >= 15) positive.push("Comfortable winning margin");
  } else if (result.outcome === "draw") {
    raw += 0.25;
    positive.push("Shared the points");
  } else {
    raw -= 0.85;
    deductions.push("Lost the match");
    raw -= Math.min(0.7, Math.abs(result.margin) * 0.05);
    if (Math.abs(result.margin) >= 20) deductions.push("Heavy defeat");
  }

  const tryDiff = input.teamTries - input.oppTries;
  if (tryDiff > 0) {
    raw += Math.min(0.6, tryDiff * 0.15);
    positive.push(`Outscored opponents on tries (${input.teamTries}–${input.oppTries})`);
  } else if (tryDiff < 0) {
    raw -= Math.min(0.5, Math.abs(tryDiff) * 0.12);
    deductions.push(`Conceded more tries (${input.oppTries}–${input.teamTries})`);
  }

  if (input.teamMetres > 0 || input.oppMetres > 0) {
    const metresShare =
      input.teamMetres + input.oppMetres > 0
        ? input.teamMetres / (input.teamMetres + input.oppMetres)
        : 0.5;
    if (metresShare >= 0.55) {
      raw += 0.25;
      positive.push("Strong metre gain share");
    } else if (metresShare <= 0.42) {
      raw -= 0.2;
      deductions.push("Limited attacking metres");
    }
  }

  if (input.teamTackles >= 120) {
    raw += 0.15;
    positive.push("High tackle workload");
  }
  if (input.teamTurnoversWon >= 6) {
    raw += 0.2;
    positive.push("Turnovers won");
  }

  if (input.yellowCards > 0) {
    raw -= input.yellowCards * 0.2;
    deductions.push(`${input.yellowCards} yellow card${input.yellowCards === 1 ? "" : "s"}`);
  }
  if (input.redCards > 0) {
    raw -= input.redCards * 0.55;
    deductions.push(`${input.redCards} red card${input.redCards === 1 ? "" : "s"}`);
  }

  const rating = clampMatchRating10(raw);
  const band = performanceBandFor(rating);
  return {
    rating,
    band,
    explanation: `${bandLabel(band)} coaching performance (${rating.toFixed(1)}) from result, attack shape, and discipline.`,
    positiveImpacts: positive,
    deductions,
    matchContext: context,
  };
}

export function computeRefereeMatchRating(input: RefereeMatchRatingInput): StaffRatingResult {
  const positive: string[] = [];
  const deductions: string[] = [];
  const totalPoints = input.homeScore + input.awayScore;
  const margin = Math.abs(input.homeScore - input.awayScore);
  const context: string[] = [
    `Final score ${input.homeScore}–${input.awayScore}`,
    `${input.yellowCards} yellow / ${input.redCards} red`,
  ];

  let raw = 6.4;

  // Competitive contests are harder to manage well.
  if (margin <= 7 && totalPoints >= 30) {
    raw += 0.35;
    positive.push("Managed a competitive contest");
  } else if (margin >= 30) {
    raw -= 0.1;
    context.push("One-sided scoreline");
  }

  // Sensible card volume = control without chaos.
  if (input.yellowCards >= 1 && input.yellowCards <= 4) {
    raw += 0.25;
    positive.push("Clear card management");
  } else if (input.yellowCards === 0 && input.redCards === 0) {
    raw += 0.1;
    positive.push("Clean disciplinary game");
  } else if (input.yellowCards >= 7) {
    raw -= 0.35;
    deductions.push("High yellow-card count");
  }

  if (input.redCards === 1) {
    raw += 0.15;
    positive.push("Issued a red card for a serious foul");
  } else if (input.redCards >= 2) {
    raw -= 0.25;
    deductions.push("Multiple red cards");
  }

  if (input.penaltyEvents >= 8 && input.penaltyEvents <= 20) {
    raw += 0.15;
    positive.push("Consistent penalty enforcement");
  } else if (input.penaltyEvents > 28) {
    raw -= 0.25;
    deductions.push("Very high penalty count");
  }

  const rating = clampMatchRating10(raw);
  const band = performanceBandFor(rating);
  return {
    rating,
    band,
    explanation: `${bandLabel(band)} refereeing performance (${rating.toFixed(1)}) from contest control and disciplinary balance.`,
    positiveImpacts: positive,
    deductions,
    matchContext: context,
  };
}

export function staffPerformanceTrend(
  previous: number | null | undefined,
  current: number,
): { trend: PerformanceTrend; change: number | null } {
  if (previous == null || !Number.isFinite(previous)) {
    return { trend: "new", change: null };
  }
  const change = Math.round((current - previous) * 10) / 10;
  if (Math.abs(change) < 0.05) return { trend: "flat", change };
  if (change > 0) return { trend: "up", change };
  return { trend: "down", change };
}
