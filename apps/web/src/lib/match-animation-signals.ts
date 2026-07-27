/** Public Match Animation signals, field zones, and clock helpers. */

export type AnimationSignalKind =
  | "scrum_awarded"
  | "lineout"
  | "penalty_awarded"
  | "try_awarded"
  | "conversion_awarded"
  | "conversion_missed"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "tmo_review"
  | "tmo_decision"
  | "tmo_overturned"
  | "kick_off"
  | "half_time"
  | "full_time"
  | "generic";

export type FieldZone = "own_22" | "midfield" | "opp_22" | "ingoal";

/** Front-on posts camera for try / conversion sequences. */
export type GoalCameraMode = "try" | "conversion" | "miss" | null;

export type AnimationSignal = {
  kind: AnimationSignalKind;
  title: string;
  teamSide: "home" | "away" | "neutral";
  playerName: string | null;
  playerOff: string | null;
  playerOn: string | null;
  jerseyNumber: number | null;
  playerImageUrl: string | null;
  /** Show conversion ball-between-posts simulation before/with signal. */
  simulateConversion: boolean;
  /** Show line-out arrow graphic. */
  showLineoutArrow: boolean;
  /** Switch pitch to front-on goal posts view. */
  frontGoalView: GoalCameraMode;
};

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveAnimationSignal(input: {
  eventType: string;
  label?: string | null;
  teamSide: "home" | "away" | "neutral";
  playerName?: string | null;
  jerseyNumber?: number | null;
  playerImageUrl?: string | null;
}): AnimationSignal {
  const t = normalize(input.eventType);
  const label = (input.label ?? "").trim();
  const playerName = input.playerName?.trim() || extractPlayerFromLabel(label);
  const base = {
    teamSide: input.teamSide,
    playerName,
    playerOff: null as string | null,
    playerOn: null as string | null,
    jerseyNumber: input.jerseyNumber ?? null,
    playerImageUrl: input.playerImageUrl ?? null,
    simulateConversion: false,
    showLineoutArrow: false,
    frontGoalView: null as GoalCameraMode,
  };

  if (t.includes("lineout") || t.includes("line_out") || /\bline.?out\b/i.test(label)) {
    return { ...base, kind: "lineout", title: "LINE-OUT", showLineoutArrow: true };
  }
  if (t.includes("scrum")) {
    return { ...base, kind: "scrum_awarded", title: "SCRUM AWARDED" };
  }
  if (t.includes("penalty_try")) {
    return { ...base, kind: "try_awarded", title: "PENALTY TRY", frontGoalView: "try" };
  }
  if (t.includes("try") && !t.includes("conversion")) {
    return { ...base, kind: "try_awarded", title: "TRY AWARDED", frontGoalView: "try" };
  }
  if (t.includes("missed_conversion") || (t.includes("conversion") && t.includes("miss"))) {
    return {
      ...base,
      kind: "conversion_missed",
      title: "CONVERSION MISSED",
      simulateConversion: true,
      frontGoalView: "miss",
    };
  }
  if (t.includes("conversion") || t.includes("con_")) {
    return {
      ...base,
      kind: "conversion_awarded",
      title: "CONVERSION AWARDED",
      simulateConversion: true,
      frontGoalView: "conversion",
    };
  }
  if (t.includes("penalty") || t.includes("pen_")) {
    return { ...base, kind: "penalty_awarded", title: "PENALTY AWARDED" };
  }
  if (t.includes("yellow") || t.includes("sin_bin") || t.includes("sinbin")) {
    return { ...base, kind: "yellow_card", title: "YELLOW CARD" };
  }
  if (t.includes("red")) {
    return { ...base, kind: "red_card", title: "RED CARD" };
  }
  if (
    t.includes("tmo_overturn") ||
    t.includes("decision_overturn") ||
    t.includes("overturned")
  ) {
    return { ...base, kind: "tmo_overturned", title: "DECISION OVERTURNED" };
  }
  if (
    t.includes("tmo_decision") ||
    t.includes("tmo_confirmed") ||
    t === "decision" ||
    (t.includes("tmo") && t.includes("decision"))
  ) {
    return { ...base, kind: "tmo_decision", title: "TMO DECISION" };
  }
  if (
    t.includes("tmo") ||
    t.includes("television_match") ||
    t.includes("tv_referee") ||
    t.includes("fourth_official") ||
    t.includes("referee_review")
  ) {
    return { ...base, kind: "tmo_review", title: "TMO REVIEW" };
  }
  if (t.includes("sub") || t.includes("replacement") || t.includes("interchange")) {
    const sub = parseSubstitutionNames(label, playerName);
    return {
      ...base,
      kind: "substitution",
      title: "SUBSTITUTION",
      playerOff: sub.off,
      playerOn: sub.on,
      playerName: sub.on ?? sub.off ?? playerName,
    };
  }
  if (t.includes("kick_off") || t.includes("kickoff")) {
    return { ...base, kind: "kick_off", title: "KICK-OFF" };
  }
  if (t.includes("half_time") || t.includes("halftime")) {
    return { ...base, kind: "half_time", title: "HALF-TIME" };
  }
  if (t.includes("full_time") || t === "ft" || t.includes("full-time")) {
    return { ...base, kind: "full_time", title: "FULL-TIME" };
  }

  const pretty = input.eventType.replace(/[_-]+/g, " ").toUpperCase() || "MATCH EVENT";
  return { ...base, kind: "generic", title: pretty };
}

function extractPlayerFromLabel(label: string): string | null {
  const m = label.match(/—\s*(.+)$/) || label.match(/-\s*(.+)$/);
  return m?.[1]?.trim() || null;
}

/** Parse "Off X / On Y" style substitution labels when present. */
export function parseSubstitutionNames(
  label: string,
  fallbackPlayer: string | null,
): { off: string | null; on: string | null } {
  const offMatch = label.match(/\b(?:off|out)\s*[:–-]?\s*([^,/|]+)/i);
  const onMatch = label.match(/\b(?:on|in)\s*[:–-]?\s*([^,/|]+)/i);
  if (offMatch || onMatch) {
    return {
      off: offMatch?.[1]?.trim() || null,
      on: onMatch?.[1]?.trim() || null,
    };
  }
  // "Smith → Jones" or "Smith > Jones"
  const arrow = label.match(/([^—>\-]+)\s*(?:→|->|>)\s*([^—]+)/);
  if (arrow) {
    return { off: arrow[1]!.trim(), on: arrow[2]!.trim() };
  }
  return { off: fallbackPlayer, on: null };
}

/** Field zone for highlight tint from ball X (0 home try-line → 100 away). */
export function fieldZoneFromBallX(
  ballX: number,
  possession: "home" | "away" | "neutral",
): FieldZone {
  const x = Math.min(100, Math.max(0, ballX));
  if (possession === "home") {
    if (x >= 95) return "ingoal";
    if (x >= 78) return "opp_22";
    if (x <= 22) return "own_22";
    return "midfield";
  }
  if (possession === "away") {
    if (x <= 5) return "ingoal";
    if (x <= 22) return "opp_22";
    if (x >= 78) return "own_22";
    return "midfield";
  }
  if (x <= 8 || x >= 92) return "ingoal";
  if (x <= 22 || x >= 78) return "opp_22";
  return "midfield";
}

/** Zone band as SVG x/width for a translucent highlight. */
export function fieldZoneBand(zone: FieldZone, possession: "home" | "away" | "neutral"): {
  x: number;
  width: number;
} {
  if (zone === "midfield") return { x: 22, width: 56 };
  if (zone === "ingoal") {
    if (possession === "away") return { x: 0, width: 8 };
    return { x: 92, width: 8 };
  }
  if (zone === "opp_22") {
    if (possession === "away") return { x: 5, width: 17 };
    return { x: 78, width: 17 };
  }
  // own_22
  if (possession === "away") return { x: 78, width: 17 };
  return { x: 5, width: 17 };
}

export function formatMatchClock(minute: number, second = 0): string {
  const m = Math.max(0, Math.floor(minute));
  const s = Math.max(0, Math.min(59, Math.floor(second)));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clockTotalSeconds(minute: number, second: number): number {
  return Math.max(0, Math.floor(minute)) * 60 + Math.max(0, Math.min(59, Math.floor(second)));
}

function maxEventClock(events: Array<{ minute?: number | null; second?: number | null }>): {
  minute: number;
  second: number;
} {
  let best = { minute: 0, second: 0 };
  for (const e of events) {
    const minute = Number(e.minute ?? 0);
    const second = Number(e.second ?? 0);
    if (!Number.isFinite(minute)) continue;
    const s = Number.isFinite(second) ? second : 0;
    if (clockTotalSeconds(minute, s) > clockTotalSeconds(best.minute, best.second)) {
      best = { minute: Math.max(0, Math.floor(minute)), second: Math.max(0, Math.min(59, Math.floor(s))) };
    }
  }
  return best;
}

/** Rough live clock when CMS match_minute is stale — wall elapsed with a simple HT gap. */
export function estimateMatchClockFromKickoff(input: {
  scheduledKickoffAt?: string | null;
  serverNowIso?: string | null;
  period?: string | null;
}): { minute: number; second: number } | null {
  const kick = input.scheduledKickoffAt ? Date.parse(input.scheduledKickoffAt) : NaN;
  const now = input.serverNowIso ? Date.parse(input.serverNowIso) : Date.now();
  if (!Number.isFinite(kick) || !Number.isFinite(now) || now < kick) return null;

  const period = (input.period ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (period === "half_time" || period === "ht") return { minute: 40, second: 0 };

  const elapsedSec = Math.floor((now - kick) / 1000);
  const htBreakSec = 15 * 60;
  const firstHalfSec = 40 * 60;

  if (period === "second_half" || elapsedSec > firstHalfSec + htBreakSec) {
    const secondHalfElapsed = Math.max(0, elapsedSec - firstHalfSec - htBreakSec);
    const total = firstHalfSec + secondHalfElapsed;
    const capped = Math.min(100 * 60, total);
    return { minute: Math.floor(capped / 60), second: capped % 60 };
  }

  const capped = Math.min(firstHalfSec, elapsedSec);
  return { minute: Math.floor(capped / 60), second: capped % 60 };
}

/**
 * Live / display match clock: CMS clock, else latest event, else kick-off estimate.
 * Replay should pass the scrubbed event via `currentEvent` instead.
 */
export function resolveAnimationMatchClock(input: {
  matchMinute?: number | null;
  matchSecond?: number | null;
  period?: string | null;
  events?: Array<{ minute?: number | null; second?: number | null }>;
  scheduledKickoffAt?: string | null;
  serverNowIso?: string | null;
  currentEvent?: { minute?: number | null; second?: number | null } | null;
  mode?: "live" | "replay";
}): { minute: number; second: number; label: string } {
  if (input.mode === "replay" && input.currentEvent) {
    const minute = Math.max(0, Math.floor(Number(input.currentEvent.minute ?? 0)));
    const second = Math.max(0, Math.min(59, Math.floor(Number(input.currentEvent.second ?? 0))));
    return { minute, second, label: formatMatchClock(minute, second) };
  }

  const period = (input.period ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (period === "half_time" || period === "ht") {
    return { minute: 40, second: 0, label: "HT" };
  }

  const cmsMinute = Number(input.matchMinute ?? 0);
  const cmsSecond = Number(input.matchSecond ?? 0);
  const cms =
    Number.isFinite(cmsMinute) && (cmsMinute > 0 || cmsSecond > 0)
      ? {
          minute: Math.max(0, Math.floor(cmsMinute)),
          second: Math.max(0, Math.min(59, Math.floor(cmsSecond || 0))),
        }
      : null;

  const fromEvents = maxEventClock(input.events ?? []);
  const estimated = estimateMatchClockFromKickoff({
    scheduledKickoffAt: input.scheduledKickoffAt,
    serverNowIso: input.serverNowIso,
    period: input.period,
  });

  const candidates = [cms, fromEvents, estimated].filter(Boolean) as Array<{
    minute: number;
    second: number;
  }>;
  let best = { minute: 0, second: 0 };
  for (const c of candidates) {
    if (clockTotalSeconds(c.minute, c.second) > clockTotalSeconds(best.minute, best.second)) {
      best = c;
    }
  }
  return { ...best, label: formatMatchClock(best.minute, best.second) };
}

export function signalAnnouncement(input: {
  title: string;
  teamName: string | null;
  playerName?: string | null;
  playerOff?: string | null;
  playerOn?: string | null;
}): string {
  const team = input.teamName?.trim();
  if (input.playerOff || input.playerOn) {
    const bits = [
      input.title,
      team,
      input.playerOff ? `Player off: ${input.playerOff}` : null,
      input.playerOn ? `Player on: ${input.playerOn}` : null,
    ].filter(Boolean);
    return `${bits.join(". ")}.`;
  }
  if (input.playerName && team) return `${input.title}: ${team}, ${input.playerName}.`;
  if (team) return `${input.title}: ${team}.`;
  return `${input.title}.`;
}

/** How long to show a signal at the given replay speed (ms). */
export function signalHoldMs(speed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 2200;
  if (speed >= 10) return 900;
  if (speed >= 5) return 1200;
  if (speed >= 2) return 1800;
  return 2400;
}
