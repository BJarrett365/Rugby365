/**
 * Live Betting Intelligence commentary — minute-by-minute lean updates.
 */

import { probabilitiesFromEdge } from "./match-betting-intelligence-math";

export type NarrativeBettingPrematch = {
  favoriteName: string;
  homePercent: number;
  awayPercent: number;
  drawPercent?: number;
  /** Optional bookmaker implied % (0–100). */
  bookHomePercent?: number | null;
  bookAwayPercent?: number | null;
  bookDrawPercent?: number | null;
};

export type NarrativeBettingLiveLean = {
  homePercent: number;
  awayPercent: number;
  drawPercent: number;
  favoriteSide: "home" | "away" | "draw";
};

export type NarrativeBettingLine = {
  minute: number;
  second: number;
  outputType: string;
  segment: string;
  body: string;
};

/** Approx inverse of probabilitiesFromEdge for re-basing live. */
export function edgeFromWinPercents(homeWinPct: number, awayWinPct: number): number {
  const h = Math.max(1, homeWinPct) / 100;
  const a = Math.max(1, awayWinPct) / 100;
  return 0.5 * Math.log(h / a);
}

/**
 * Adjust pre-match model for current score and clock.
 * Leads matter more as time runs out.
 */
export function liveBettingLean(input: {
  homePercent: number;
  awayPercent: number;
  drawPercent?: number;
  homeScore: number;
  awayScore: number;
  minute: number;
}): NarrativeBettingLiveLean {
  const minute = Math.max(0, Math.min(90, input.minute));
  const remaining = Math.max(0, 80 - minute) / 80;
  const margin = input.homeScore - input.awayScore;
  const baseEdge = edgeFromWinPercents(input.homePercent, input.awayPercent);
  // ~0.08 per point early; ~0.30 late — keeps live tips reactive.
  const scoreWeight = 0.08 + 0.22 * (1 - remaining);
  const live = probabilitiesFromEdge(baseEdge + margin * scoreWeight);

  let favoriteSide: "home" | "away" | "draw" = "home";
  if (live.homeWinPct === live.awayWinPct) favoriteSide = "draw";
  else if (live.awayWinPct > live.homeWinPct) favoriteSide = "away";

  return {
    homePercent: live.homeWinPct,
    awayPercent: live.awayWinPct,
    drawPercent: live.drawPct,
    favoriteSide,
  };
}

function favoriteName(
  side: "home" | "away" | "draw",
  homeName: string,
  awayName: string,
  prematchFavorite: string,
): string {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  return prematchFavorite;
}

function formatPctTrio(
  homeName: string,
  awayName: string,
  lean: NarrativeBettingLiveLean,
): string {
  return `${lean.homePercent}% ${homeName}, ${lean.drawPercent}% draw, ${lean.awayPercent}% ${awayName}`;
}

/** Rotate copy so every-minute updates don't read identical. */
export function formatBettingIntelligenceBody(input: {
  minute: number;
  homeName: string;
  awayName: string;
  prematchFavorite: string;
  lean: NarrativeBettingLiveLean;
  homeScore: number;
  awayScore: number;
}): string {
  const { minute, homeName, awayName, lean, homeScore, awayScore } = input;
  const tip = favoriteName(lean.favoriteSide, homeName, awayName, input.prematchFavorite);
  const trio = formatPctTrio(homeName, awayName, lean);
  const score = `${homeName} ${homeScore}–${awayScore} ${awayName}`;
  const variant = minute % 5;

  switch (variant) {
    case 0:
      return `${minute}' — Betting Intelligence: we tip ${tip} from here (${trio}).`;
    case 1:
      return `${minute}' — Live model update (${score}): ${tip} ${lean.favoriteSide === "draw" ? "still the lean in a tight one" : "to come out on top"} — ${trio}.`;
    case 2:
      return `${minute}' — Market lean: ${tip}. Betting Intelligence has it ${trio}.`;
    case 3:
      return `${minute}' — BI pulse: ${trio}. Tip remains ${tip}.`;
    default:
      return `${minute}' — Betting Intelligence at ${minute}' — ${tip} favoured on ${score} (${trio}).`;
  }
}

export function scoreAsOfMinute(
  events: Array<{
    minute: number;
    eventType: string;
    teamName?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
  }>,
  homeName: string,
  awayName: string,
  minute: number,
): { home: number; away: number } {
  const running = { home: 0, away: 0 };
  for (const event of events) {
    if (event.minute > minute) break;
    const type = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");
    let delta = 0;
    if (type.includes("penalty_try")) delta = 7;
    else if (type === "try" || (type.includes("try") && !type.includes("conversion"))) delta = 5;
    else if (type.includes("conversion") && !type.includes("miss")) delta = 2;
    else if (type.includes("penalty_goal") || type.includes("drop_goal")) delta = 3;
    else continue;

    if (typeof event.homeScore === "number" && typeof event.awayScore === "number") {
      running.home = event.homeScore;
      running.away = event.awayScore;
      continue;
    }
    const team = (event.teamName ?? "").trim();
    if (team === homeName) running.home += delta;
    else if (team === awayName) running.away += delta;
  }
  return running;
}

export function buildPrematchBettingIntelligenceLine(input: {
  homeName: string;
  awayName: string;
  prematch: NarrativeBettingPrematch;
}): NarrativeBettingLine {
  const homePct = Math.round(input.prematch.homePercent);
  const awayPct = Math.round(input.prematch.awayPercent);
  const drawPct =
    input.prematch.drawPercent != null
      ? Math.round(input.prematch.drawPercent)
      : Math.max(0, 100 - homePct - awayPct);
  let body = `Betting Intelligence tip: we tip ${input.prematch.favoriteName} to win — model ${homePct}% ${input.homeName}, ${drawPct}% draw, ${awayPct}% ${input.awayName}.`;
  if (
    input.prematch.bookHomePercent != null &&
    input.prematch.bookAwayPercent != null
  ) {
    const bh = Math.round(input.prematch.bookHomePercent);
    const ba = Math.round(input.prematch.bookAwayPercent);
    const bd =
      input.prematch.bookDrawPercent != null
        ? Math.round(input.prematch.bookDrawPercent)
        : Math.max(0, 100 - bh - ba);
    body += ` Bookmakers imply ${bh}% / ${bd}% / ${ba}%.`;
  }
  return {
    minute: 0,
    second: 0,
    outputType: "match_fact",
    segment: "betting_intelligence_prematch",
    body,
  };
}

/**
 * One Betting Intelligence update per match minute (1..maxMinute).
 */
export function buildMinuteBettingIntelligenceLines(input: {
  homeName: string;
  awayName: string;
  prematch: NarrativeBettingPrematch;
  events: Array<{
    minute: number;
    eventType: string;
    teamName?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
  }>;
  maxMinute?: number;
  finalHomeScore?: number;
  finalAwayScore?: number;
}): NarrativeBettingLine[] {
  const eventMax = input.events.reduce((m, e) => Math.max(m, e.minute), 0);
  const maxMinute = Math.max(
    1,
    Math.min(80, input.maxMinute ?? Math.max(eventMax, 1)),
  );

  const lines: NarrativeBettingLine[] = [];
  for (let minute = 1; minute <= maxMinute; minute += 1) {
    const score = scoreAsOfMinute(input.events, input.homeName, input.awayName, minute);
    // After FT-ish, prefer final scores if provided
    if (minute >= 80 && input.finalHomeScore != null && input.finalAwayScore != null) {
      score.home = input.finalHomeScore;
      score.away = input.finalAwayScore;
    }
    const lean = liveBettingLean({
      homePercent: input.prematch.homePercent,
      awayPercent: input.prematch.awayPercent,
      drawPercent: input.prematch.drawPercent,
      homeScore: score.home,
      awayScore: score.away,
      minute,
    });
    lines.push({
      minute,
      second: 45,
      outputType: "match_fact",
      segment: "betting_intelligence",
      body: formatBettingIntelligenceBody({
        minute,
        homeName: input.homeName,
        awayName: input.awayName,
        prematchFavorite: input.prematch.favoriteName,
        lean,
        homeScore: score.home,
        awayScore: score.away,
      }),
    });
  }
  return lines;
}
