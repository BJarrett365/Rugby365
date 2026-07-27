/** Full-time result helpers — scores always from confirmed fixture, never clock-only. */

export type MatchResultKind =
  | "home_win"
  | "away_win"
  | "draw"
  | "extra_time"
  | "abandoned"
  | "cancelled"
  | "awarded";

export type FullTimeHeadline =
  | "FULL-TIME"
  | "MATCH ABANDONED"
  | "RESULT AWARDED"
  | "MATCH CANCELLED"
  | "EXTRA TIME";

/** CMS / approved feed confirmation — never infer FT from 80:00 alone. */
export function isFullTimeConfirmed(input: {
  fixtureStatus: string;
  period?: string | null;
  fullTimeConfirmedAt?: string | null;
  /** Explicit published full-time / result event from approved feed. */
  hasFullTimeEvent?: boolean;
}): boolean {
  if (input.fullTimeConfirmedAt) return true;
  if (input.hasFullTimeEvent) return true;
  const s = input.fixtureStatus.trim().toLowerCase();
  if (
    s === "result" ||
    s === "finished" ||
    s === "complete" ||
    s === "ft" ||
    s === "full_time" ||
    s === "full-time" ||
    s.includes("abandon") ||
    s.includes("award") ||
    s.includes("cancel")
  ) {
    return true;
  }
  const p = (input.period ?? "").toLowerCase();
  return p === "full_time" || p === "ft" || p === "complete";
}

/**
 * Official final score: prefer confirmed CMS fixture scores.
 * Does not invent a separate animation-only score.
 */
export function officialFinalScore(input: {
  cmsHomeScore: number | null | undefined;
  cmsAwayScore: number | null | undefined;
  fallbackHomeScore: number;
  fallbackAwayScore: number;
}): { home: number; away: number; source: "cms" | "fallback" } {
  if (
    typeof input.cmsHomeScore === "number" &&
    Number.isFinite(input.cmsHomeScore) &&
    typeof input.cmsAwayScore === "number" &&
    Number.isFinite(input.cmsAwayScore)
  ) {
    return { home: input.cmsHomeScore, away: input.cmsAwayScore, source: "cms" };
  }
  return {
    home: input.fallbackHomeScore,
    away: input.fallbackAwayScore,
    source: "fallback",
  };
}

export function resolveMatchResultKind(input: {
  fixtureStatus: string;
  homeScore: number;
  awayScore: number;
  extraTime?: boolean;
}): MatchResultKind {
  const s = input.fixtureStatus.trim().toLowerCase();
  if (s.includes("abandon")) return "abandoned";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("award")) return "awarded";
  if (input.extraTime || s.includes("extra") || s.includes("aet") || s.includes("et ")) {
    return "extra_time";
  }
  if (input.homeScore > input.awayScore) return "home_win";
  if (input.awayScore > input.homeScore) return "away_win";
  return "draw";
}

export function fullTimeHeadline(kind: MatchResultKind): FullTimeHeadline {
  switch (kind) {
    case "abandoned":
      return "MATCH ABANDONED";
    case "awarded":
      return "RESULT AWARDED";
    case "cancelled":
      return "MATCH CANCELLED";
    case "extra_time":
      return "EXTRA TIME";
    default:
      return "FULL-TIME";
  }
}

/** Only completed regulation/extra-time results use the word FULL-TIME. */
export function showsFullTimeLabel(kind: MatchResultKind): boolean {
  return kind === "home_win" || kind === "away_win" || kind === "draw" || kind === "extra_time";
}

export function fullTimeAnnouncement(input: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  kind: MatchResultKind;
}): string {
  const score = `${input.homeName} ${input.homeScore}, ${input.awayName} ${input.awayScore}`;
  if (input.kind === "abandoned") return `Match abandoned: ${score}.`;
  if (input.kind === "awarded") return `Result awarded: ${score}.`;
  if (input.kind === "cancelled") return `Match cancelled: ${score}.`;
  if (input.kind === "extra_time") return `Full-time after extra time: ${score}.`;
  return `Full-time: ${score}.`;
}

/** Hold full-time screen long enough to read at high replay speeds (ms). */
export function fullTimeHoldMs(speed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (speed >= 10) return 3200;
  if (speed >= 5) return 2400;
  return 900;
}

export function defaultAnimationViewAfterLoad(input: {
  fullTimeConfirmed: boolean;
  hasDeepLinkEvent: boolean;
  showReplayControls: boolean;
}): "full_time" | "replay" | "other" {
  if (!input.fullTimeConfirmed) return "other";
  if (input.hasDeepLinkEvent) return "replay";
  return "full_time";
}
