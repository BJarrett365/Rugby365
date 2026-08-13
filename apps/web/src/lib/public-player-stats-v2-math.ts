/**
 * Pure Player Stats V2 calculations. No DB. UI must not re-implement these.
 * 0 is a verified zero; null is unknown. Percentages are never averaged naively.
 */

import {
  PLAYER_STATS_PER80_MIN_MINUTES,
  PLAYER_STATS_RANK_MIN_APPEARANCES,
  PLAYER_STATS_RANK_MIN_MINUTES,
  type DefensiveStats,
  type PlayerStatsAvailableSeason,
  type PlayerStatsPeriod,
  type PointsBreakdown,
  type PointsBreakdownSegment,
} from "./public-player-stats-v2-types";
import {
  currentDomesticSeasonStartYear,
  formatSeasonRangeLabel,
  seasonSlugFromStartYear,
} from "./season-label-utils";

export {
  PLAYER_STATS_PER80_MIN_MINUTES,
  PLAYER_STATS_RANK_MIN_APPEARANCES,
  PLAYER_STATS_RANK_MIN_MINUTES,
};

/** Below this many paired tackle attempts, the defence card warns about limited sample. */
export const PLAYER_STATS_DEFENCE_LIMITED_ATTEMPTS = 10;
export type KnownCount = { total: number; sample: number } | null;

export function extraNumber(extras: unknown, ...keys: string[]): number | null {
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) return null;
  const obj = extras as Record<string, unknown>;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const n = Number(obj[key]);
    if (Number.isFinite(n)) return n;
    return null;
  }
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const actual = lower.get(key.toLowerCase());
    if (!actual) continue;
    const n = Number(obj[actual]);
    if (Number.isFinite(n)) return n;
    return null;
  }
  return null;
}

export const CONVERSION_ATTEMPT_EXTRAS_KEYS = [
  "conversionAttempts",
  "conversion_attempts",
  "conversionsAttempted",
  "Conversion attempts",
] as const;

export const PENALTY_ATTEMPT_EXTRAS_KEYS = [
  "penaltyAttempts",
  "penalty_attempts",
  "penaltiesAttempted",
  "Penalty attempts",
] as const;

export const DROP_GOAL_ATTEMPT_EXTRAS_KEYS = [
  "dropGoalAttempts",
  "drop_goal_attempts",
  "dropGoalsAttempted",
  "Drop goal attempts",
] as const;

export const CONVERSION_MISS_EXTRAS_KEYS = [
  "missedConversions",
  "missed_conversions",
  "Missed conversions",
] as const;

export const PENALTY_MISS_EXTRAS_KEYS = [
  "missedPenalties",
  "missed_penalties",
  "Missed penalties",
] as const;

export const DROP_GOAL_MISS_EXTRAS_KEYS = [
  "missedDropGoals",
  "missed_drop_goals",
  "Missed drop goals",
] as const;

export const MISSED_GOAL_KICK_EXTRAS_KEYS = [
  "missedGoals",
  "missed_goals",
  "Missed goals",
] as const;

/** "Handre Pollard" matches "Pollard Handre" (Rugby Data name order). */
export function playerNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const tokens = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  const left = tokens(a ?? "");
  const right = tokens(b ?? "");
  return Boolean(left && right && left === right);
}

export function kickMissAttributedToPlayer(
  event: {
    playerId?: string | null;
    payload?: unknown;
  },
  player: {
    id: string;
    name?: string | null;
    externalProviderId?: string | null;
  },
): boolean {
  if (event.playerId && event.playerId === player.id) return true;
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : null;
  if (!payload) return false;
  const payloadPlayerId = typeof payload.player_id === "string" ? payload.player_id : null;
  if (payloadPlayerId && payloadPlayerId === player.id) return true;
  const providerId =
    typeof payload.player_provider_id === "string"
      ? payload.player_provider_id
      : typeof payload.player_external_id === "string"
        ? payload.player_external_id
        : payload.player_external_id != null
          ? String(payload.player_external_id)
          : null;
  if (providerId && player.externalProviderId && providerId === player.externalProviderId) {
    return true;
  }
  const payloadName =
    (typeof payload.player === "string" ? payload.player : null) ??
    (typeof payload.player_name === "string" ? payload.player_name : null) ??
    (typeof payload.playerName === "string" ? payload.playerName : null);
  return playerNamesMatch(payloadName, player.name);
}

/** Sum known numbers. Empty input → null (unknown), not 0. */
export function sumKnown(values: Array<number | null | undefined>): KnownCount {
  let total = 0;
  let sample = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    total += v;
    sample += 1;
  }
  if (sample === 0) return null;
  return { total, sample };
}

export function knownValue(sum: KnownCount): number | null {
  return sum ? sum.total : null;
}

export function per80(total: number | null, minutes: number | null): number | null {
  if (total == null || minutes == null) return null;
  if (minutes < PLAYER_STATS_PER80_MIN_MINUTES) return null;
  return round1((total / minutes) * 80);
}

/** Rate from successes / attempts. Never infers attempts from successes. */
export function successPct(made: number | null, attempts: number | null): number | null {
  if (made == null || attempts == null) return null;
  if (attempts <= 0) return null;
  if (made > attempts) return null;
  return round1((made / attempts) * 100);
}

/**
 * Pass success from total passes + bad passes.
 * Treats `passes` as the attempt pool when both keys are known.
 */
export function passSuccessPct(passes: number | null, badPasses: number | null): number | null {
  if (passes == null || badPasses == null) return null;
  if (passes <= 0) return null;
  const good = passes - badPasses;
  if (good < 0) return null;
  return round1((good / passes) * 100);
}

/** Tackle success only when completed + missed are both known. */
export function tackleSuccessPct(
  completed: number | null,
  missed: number | null,
): number | null {
  if (completed == null || missed == null) return null;
  const attempts = completed + missed;
  if (attempts <= 0) return null;
  return round1((completed / attempts) * 100);
}

export type DefenceMatchGrain = {
  tacklesCompleted: number | null;
  tacklesMade: number | null;
  missedTackles: number | null;
  dominantTackles: number | null;
  turnoversWon: number | null;
  hasPerf?: boolean;
};

/**
 * Aggregate defence from match grains.
 * Success % uses only matches where both made and missed are known (never assumes 0 missed).
 * Displayed made/missed totals are those same paired sums so the gauge reconciles with the rows.
 */
export function aggregateDefensiveStats(grains: DefenceMatchGrain[]): DefensiveStats {
  let madePaired = 0;
  let missedPaired = 0;
  let pairSample = 0;
  let madeKnown = 0;
  let madeSample = 0;
  let missedSample = 0;
  let dominantTotal = 0;
  let dominantSample = 0;
  let turnoversTotal = 0;
  let turnoversSample = 0;
  let matchesWithPerf = 0;

  for (const g of grains) {
    if (g.hasPerf) matchesWithPerf += 1;
    // Prefer provider "completed" (successful). Some feeds store attempts in tackles_made
    // (= completed + missed); never treat that attempts column as made for success %.
    const completed =
      g.tacklesCompleted != null && Number.isFinite(g.tacklesCompleted)
        ? g.tacklesCompleted
        : g.tacklesMade != null && Number.isFinite(g.tacklesMade)
          ? g.tacklesMade
          : null;
    const missed =
      g.missedTackles != null && Number.isFinite(g.missedTackles) ? g.missedTackles : null;

    if (completed != null) {
      madeKnown += completed;
      madeSample += 1;
    }
    if (missed != null) missedSample += 1;

    if (completed != null && missed != null) {
      madePaired += completed;
      missedPaired += missed;
      pairSample += 1;
    }

    if (g.dominantTackles != null && Number.isFinite(g.dominantTackles)) {
      dominantTotal += g.dominantTackles;
      dominantSample += 1;
    }
    if (g.turnoversWon != null && Number.isFinite(g.turnoversWon)) {
      turnoversTotal += g.turnoversWon;
      turnoversSample += 1;
    }
  }

  const matchesInScope = grains.length;
  const attempts = pairSample > 0 ? madePaired + missedPaired : null;
  const tackleSuccessPctValue =
    pairSample > 0 ? tackleSuccessPct(madePaired, missedPaired) : null;
  const limitedSample =
    attempts != null && attempts > 0 && attempts < PLAYER_STATS_DEFENCE_LIMITED_ATTEMPTS;
  const coveragePct =
    matchesInScope > 0 ? round1((pairSample / matchesInScope) * 100) : null;

  let message: string | null = null;
  if (tackleSuccessPctValue == null && madeSample > 0 && missedSample === 0) {
    message = "Tackle success requires made and missed tackles";
  } else if (limitedSample) {
    message = `Limited sample — only ${attempts} tackle attempts in this period`;
  }

  return {
    tackleSuccessPct: tackleSuccessPctValue,
    // Prefer paired totals so rows reconcile with the gauge; fall back to unpaired known made.
    tacklesMade: pairSample > 0 ? madePaired : madeSample > 0 ? madeKnown : null,
    missedTackles: pairSample > 0 ? missedPaired : null,
    dominantTackles: dominantSample > 0 ? dominantTotal : null,
    turnoversWon: turnoversSample > 0 ? turnoversTotal : null,
    attempts,
    matchesInScope,
    matchesWithPerf,
    matchesWithTackleSample: pairSample,
    coveragePct,
    metricCoverage: {
      tacklesMade: madeSample,
      missedTackles: missedSample,
      dominantTackles: dominantSample,
      turnoversWon: turnoversSample,
    },
    limitedSample,
    message,
  };
}

/** Map Game Log rows (same season filter) into defence grains for reconciliation tests. */
export function defenceGrainsFromGameLog(
  rows: Array<{
    tacklesMade?: number | null;
    missedTackles?: number | null;
    dominantTackles?: number | null;
    turnoversWon?: number | null;
  }>,
): DefenceMatchGrain[] {
  return rows.map((row) => {
    const made = row.tacklesMade != null && Number.isFinite(row.tacklesMade) ? row.tacklesMade : null;
    const missed =
      row.missedTackles != null && Number.isFinite(row.missedTackles) ? row.missedTackles : null;
    const dominant =
      row.dominantTackles != null && Number.isFinite(row.dominantTackles)
        ? row.dominantTackles
        : null;
    const turnovers =
      row.turnoversWon != null && Number.isFinite(row.turnoversWon) ? row.turnoversWon : null;
    return {
      tacklesCompleted: made,
      tacklesMade: made,
      missedTackles: missed,
      dominantTackles: dominant,
      turnoversWon: turnovers,
      hasPerf: made != null || missed != null || dominant != null || turnovers != null,
    };
  });
}

/** True when defence card totals match Game Log sums under the same season filter. */
export function defenceMatchesGameLog(
  defence: DefensiveStats,
  gameLogRows: Parameters<typeof defenceGrainsFromGameLog>[0],
): boolean {
  const fromLog = aggregateDefensiveStats(defenceGrainsFromGameLog(gameLogRows));
  return (
    fromLog.tackleSuccessPct === defence.tackleSuccessPct &&
    fromLog.tacklesMade === defence.tacklesMade &&
    fromLog.missedTackles === defence.missedTackles &&
    fromLog.dominantTackles === defence.dominantTackles &&
    fromLog.turnoversWon === defence.turnoversWon &&
    fromLog.attempts === defence.attempts
  );
}

export function pointsFromScoring(input: {
  tries: number | null;
  conversions: number | null;
  penalties: number | null;
  dropGoals: number | null;
}): number | null {
  const parts = [input.tries, input.conversions, input.penalties, input.dropGoals];
  if (parts.every((v) => v == null)) return null;
  const tries = input.tries ?? 0;
  const conversions = input.conversions ?? 0;
  const penalties = input.penalties ?? 0;
  const dropGoals = input.dropGoals ?? 0;
  return tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3;
}

export function buildPointsBreakdown(input: {
  storedPoints: number | null;
  tries: number | null;
  conversions: number | null;
  penalties: number | null;
  dropGoals: number | null;
}): PointsBreakdown {
  const computedPoints = pointsFromScoring(input);
  const storedPoints = input.storedPoints;
  const mismatch =
    storedPoints != null && computedPoints != null && storedPoints !== computedPoints;
  const denom = storedPoints != null && storedPoints > 0 ? storedPoints : computedPoints;
  const tryPts = input.tries != null ? input.tries * 5 : null;
  const convPts = input.conversions != null ? input.conversions * 2 : null;
  const penPts = input.penalties != null ? input.penalties * 3 : null;
  const dgPts = input.dropGoals != null ? input.dropGoals * 3 : null;

  const segment = (
    key: PointsBreakdownSegment["key"],
    label: string,
    count: number | null,
    points: number | null,
  ): PointsBreakdownSegment => ({
    key,
    label,
    count,
    points,
    percent:
      points != null && denom != null && denom > 0 ? round1((points / denom) * 100) : null,
  });

  return {
    storedPoints,
    computedPoints,
    mismatch,
    segments: [
      segment("tries", "Tries", input.tries, tryPts),
      segment("conversions", "Conversions", input.conversions, convPts),
      segment("penalties", "Penalties", input.penalties, penPts),
      segment("dropGoals", "Drop Goals", input.dropGoals, dgPts),
    ],
  };
}

/** Per-appearance mean for count metrics. Never use this for percentages. */
export function averagePerAppearance(
  total: number | null,
  appearances: number,
): number | null {
  if (total == null || appearances <= 0) return null;
  return round1(total / appearances);
}

export function sharePct(player: number | null, team: number | null): number | null {
  if (player == null || team == null || team <= 0) return null;
  return round1((player / team) * 100);
}

export function eligibleForRank(input: {
  minutes: number | null;
  appearances: number;
}): boolean {
  const mins = input.minutes ?? 0;
  return mins >= PLAYER_STATS_RANK_MIN_MINUTES || input.appearances >= PLAYER_STATS_RANK_MIN_APPEARANCES;
}

/** Preferred peer pool size before a rank is marked provisional (#N*). */
export const PLAYER_STATS_RANK_PREFERRED_PEERS = 10;

/** 1-based rank; ties share the best rank. Null when the player is ineligible. */
export function rankAmong(
  playerValue: number | null,
  peers: Array<{ value: number | null; minutes: number | null; appearances: number }>,
  playerSample: { minutes: number | null; appearances: number },
): number | null {
  return rankAmongDetailed(playerValue, peers, playerSample).rank;
}

export type RankResult = {
  rank: number | null;
  eligibleCount: number;
  provisional: boolean;
};

/** Rank plus pool size for tooltips / provisional markers. */
export function rankAmongDetailed(
  playerValue: number | null,
  peers: Array<{ value: number | null; minutes: number | null; appearances: number }>,
  playerSample: { minutes: number | null; appearances: number },
): RankResult {
  if (playerValue == null || !eligibleForRank(playerSample)) {
    return { rank: null, eligibleCount: 0, provisional: false };
  }
  const eligible = peers.filter(
    (p) => p.value != null && eligibleForRank({ minutes: p.minutes, appearances: p.appearances }),
  );
  if (eligible.length === 0) {
    return { rank: null, eligibleCount: 0, provisional: false };
  }
  const better = eligible.filter((p) => (p.value as number) > playerValue).length;
  const rank = better + 1;
  // Pool includes the player.
  const eligibleCount = eligible.length + 1;
  return {
    rank,
    eligibleCount,
    provisional: eligibleCount < PLAYER_STATS_RANK_PREFERRED_PEERS,
  };
}

export function formatRankLabel(rank: number | null, provisional = false): string | null {
  if (rank == null) return null;
  return provisional ? `#${rank}*` : `#${rank}`;
}

export function formatRankTooltip(input: {
  rank: number | null;
  eligibleCount: number;
  provisional: boolean;
  peerPlural: string;
  periodLabel: string;
  metricBasis: string;
}): string | null {
  if (input.rank == null || input.eligibleCount <= 0) return null;
  const mark = input.provisional ? "*" : "";
  const thin = input.provisional ? " · provisional (thin peer pool)" : "";
  return `#${input.rank}${mark} of ${input.eligibleCount} eligible ${input.peerPlural} · ${input.periodLabel} · min ${PLAYER_STATS_RANK_MIN_MINUTES} mins or ${PLAYER_STATS_RANK_MIN_APPEARANCES} apps · ${input.metricBasis}${thin}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round0(n: number): number {
  return Math.round(n);
}

/** Northern-hemisphere rugby season start year from kickoff (Jul–Jun). */
export function rugbySeasonStartFromKickoff(kickoffAt: Date | string | null): number | null {
  if (!kickoffAt) return null;
  const d = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

export function rugbySeasonSlugFromKickoff(kickoffAt: Date | string | null): string | null {
  const start = rugbySeasonStartFromKickoff(kickoffAt);
  return start == null ? null : seasonSlugFromStartYear(start);
}

export function rugbySeasonLabelFromStart(startYear: number): string {
  return formatSeasonRangeLabel(startYear);
}

/** Seasons the player appeared in, newest first, plus the current (and selected) season. */
export function buildAvailableSeasons(input: {
  appearanceCountsByStart: Record<number, number>;
  currentStartYear: number;
  selectedStartYear?: number | null;
}): PlayerStatsAvailableSeason[] {
  const starts = new Set<number>();
  for (const [key, count] of Object.entries(input.appearanceCountsByStart)) {
    const start = Number(key);
    if (!Number.isFinite(start) || count <= 0) continue;
    starts.add(start);
  }
  starts.add(input.currentStartYear);
  if (input.selectedStartYear != null) starts.add(input.selectedStartYear);
  return [...starts]
    .sort((a, b) => b - a)
    .map((start) => ({
      slug: seasonSlugFromStartYear(start),
      label: rugbySeasonLabelFromStart(start),
      appearances: input.appearanceCountsByStart[start] ?? 0,
    }));
}

export function defaultGameLogSeasonSlug(input: {
  period: PlayerStatsPeriod;
  selectedSeasonSlug: string;
  availableSeasons: Array<{ slug: string; appearances: number }>;
}): string {
  if (input.period === "season" && input.selectedSeasonSlug) {
    return input.selectedSeasonSlug;
  }
  const latestWithApps = input.availableSeasons.find((s) => s.appearances > 0);
  return latestWithApps?.slug ?? input.availableSeasons[0]?.slug ?? input.selectedSeasonSlug;
}

export const GAME_LOG_CAREER_SLUG = "career";

export function filterGameLogBySeason<T extends { seasonSlug?: string | null }>(
  rows: T[],
  seasonSlug: string,
): T[] {
  if (!seasonSlug) return [];
  if (seasonSlug === GAME_LOG_CAREER_SLUG) return rows;
  return rows.filter((row) => row.seasonSlug === seasonSlug);
}

/** Goal-kick cell: "2 / 2" when attempts known; made-only when no attempts; "—" when unknown. */
export function formatKickStat(made: number | null, attempts: number | null): string {
  if (made == null && attempts == null) return "—";
  if (attempts != null) {
    const m = made ?? 0;
    return `${formatStatNumber(m, { digits: 0, compact: true })} / ${formatStatNumber(attempts, { digits: 0, compact: true })}`;
  }
  return formatStatNumber(made, { digits: 0 });
}

export function resolveDefaultSeasonStart(input: {
  appearanceSeasonStarts: number[];
  /** Appearances per season start year — used when current season is thin. */
  appearanceCountsByStart?: Record<number, number>;
  referenceDate?: Date;
  /** Prefer another recent season when current has fewer than this many apps. */
  minCurrentSample?: number;
}): number | null {
  if (input.appearanceSeasonStarts.length === 0) return null;
  const current = currentDomesticSeasonStartYear(input.referenceDate);
  const counts = input.appearanceCountsByStart ?? {};
  const minSample = input.minCurrentSample ?? 3;
  const currentCount = counts[current] ?? 0;
  if (input.appearanceSeasonStarts.includes(current) && currentCount >= minSample) {
    return current;
  }
  // Prefer the most recent season with the richest sample (still data-driven).
  const ranked = [...input.appearanceSeasonStarts].sort((a, b) => {
    const byCount = (counts[b] ?? 0) - (counts[a] ?? 0);
    if (byCount !== 0) return byCount;
    return b - a;
  });
  return ranked[0] ?? null;
}

export function formatStatNumber(
  value: number | null,
  opts: { digits?: number; percent?: boolean; compact?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = opts.digits ?? (Number.isInteger(value) ? 0 : 1);
  if (digits === 0) {
    const rounded = Math.round(value);
    const text = opts.compact
      ? String(rounded)
      : rounded.toLocaleString("en-GB");
    return opts.percent ? `${text}%` : text;
  }
  const text = value.toFixed(digits);
  return opts.percent ? `${text}%` : text;
}

/** Goal-kick style when attempts are known: "23 / 25 (92%)". Made-only otherwise (caller shows number). */
export function formatAccuracyDetail(
  made: number | null,
  attempts: number | null,
  pct: number | null,
): string | null {
  if (made == null || attempts == null || pct == null) return null;
  return `${formatStatNumber(made, { digits: 0, compact: true })} / ${formatStatNumber(attempts, { digits: 0, compact: true })} (${formatStatNumber(pct, { digits: 0, percent: true, compact: true })})`;
}

/** Small samples (e.g. 1/1) are shown but flagged provisional. */
export const KICKING_ACCURACY_PROVISIONAL_MAX_ATTEMPTS = 4;

export type KickingAccuracyMathInput = {
  conversions: number | null;
  conversionAttempts: number | null;
  penalties: number | null;
  penaltyAttempts: number | null;
  dropGoals: number | null;
  dropGoalAttempts: number | null;
  /** Combined missed conversions+penalties from extras ("Missed goals"). */
  missedGoalKicks?: number | null;
  matches: number;
  matchesWithAttemptData: number;
  /** When true (fly-half etc.), show the card even with empty accuracy. */
  goalKickRole: boolean;
  periodLabel: string;
  coverageNotes?: string[];
};

export type KickingAccuracyMathRow = {
  key: "overall" | "penalties" | "conversions" | "dropGoals";
  label: string;
  made: number | null;
  attempts: number | null;
  /** Exact rate for bar width; null when unknown. */
  percent: number | null;
  /** Display value — rounded integer percent. */
  displayPercent: number | null;
  provisional: boolean;
  tooltip: string | null;
};

export type KickingAccuracyMathResult = {
  available: boolean;
  applicable: boolean;
  rows: KickingAccuracyMathRow[];
  message: string | null;
  matches: number;
  matchesWithAttemptData: number;
  coverageTooltip: string;
};

/**
 * Prefer stored attempt totals; fall back to made+missed when the provider
 * recorded misses (including verified 0 in extras). Event misses of 0 are
 * unknown coverage — never invent attempts from successes alone.
 */
export function resolveGoalKickAttempts(
  extrasAttempts: number | null,
  made: number | null,
  missedEvents: number | null,
  extrasMissed?: number | null,
): number | null {
  if (extrasAttempts != null && Number.isFinite(extrasAttempts) && extrasAttempts >= 0) {
    return extrasAttempts;
  }
  if (extrasMissed != null && Number.isFinite(extrasMissed) && extrasMissed >= 0) {
    const madeSafe = made != null && Number.isFinite(made) ? Math.max(0, made) : 0;
    return madeSafe + extrasMissed;
  }
  if (missedEvents != null && missedEvents > 0) {
    const madeSafe = made != null && Number.isFinite(made) ? Math.max(0, made) : 0;
    return madeSafe + missedEvents;
  }
  return null;
}

function kickingRow(input: {
  key: KickingAccuracyMathRow["key"];
  label: string;
  made: number | null;
  attempts: number | null;
  periodLabel: string;
  matches: number;
  matchesWithAttemptData: number;
}): KickingAccuracyMathRow {
  const percent = successPct(input.made, input.attempts);
  const displayPercent = percent == null ? null : Math.round(percent);
  const provisional =
    input.attempts != null &&
    input.attempts > 0 &&
    input.attempts <= KICKING_ACCURACY_PROVISIONAL_MAX_ATTEMPTS &&
    percent != null;
  const detail = formatAccuracyDetail(input.made, input.attempts, displayPercent);
  const tipParts: string[] = [];
  if (detail) tipParts.push(detail);
  else if (input.made != null && input.attempts == null) {
    tipParts.push(
      `${formatStatNumber(input.made, { digits: 0, compact: true })} made — attempts not stored`,
    );
  } else {
    tipParts.push("Attempts not stored for this period");
  }
  tipParts.push(`${input.matches} matches`);
  tipParts.push(input.periodLabel);
  if (input.matchesWithAttemptData > 0) {
    tipParts.push(`${input.matchesWithAttemptData} with attempt data`);
  }
  if (provisional) {
    tipParts.push("PROVISIONAL — small sample");
  }
  return {
    key: input.key,
    label: input.label,
    made: input.made,
    attempts: input.attempts,
    percent,
    displayPercent,
    provisional,
    tooltip: tipParts.join(" · "),
  };
}

/**
 * Goal-kicking accuracy from raw made/attempted totals.
 * OVERALL = (conv + pen) / (convAtt + penAtt) — drop goals are separate.
 */
export function buildKickingAccuracy(input: KickingAccuracyMathInput): KickingAccuracyMathResult {
  const conv = kickingRow({
    key: "conversions",
    label: "Conversions",
    made: input.conversions,
    attempts: input.conversionAttempts,
    periodLabel: input.periodLabel,
    matches: input.matches,
    matchesWithAttemptData: input.matchesWithAttemptData,
  });
  const pen = kickingRow({
    key: "penalties",
    label: "Penalties",
    made: input.penalties,
    attempts: input.penaltyAttempts,
    periodLabel: input.periodLabel,
    matches: input.matches,
    matchesWithAttemptData: input.matchesWithAttemptData,
  });
  const dg = kickingRow({
    key: "dropGoals",
    label: "Drop Goals",
    made: input.dropGoals,
    attempts: input.dropGoalAttempts,
    periodLabel: input.periodLabel,
    matches: input.matches,
    matchesWithAttemptData: input.matchesWithAttemptData,
  });

  // OVERALL excludes drop goals. Need both attempt denominators — never blend known + unknown.
  const overallMade = sumKnown([input.conversions, input.penalties])?.total ?? null;
  const overallAttempts =
    input.conversionAttempts != null && input.penaltyAttempts != null
      ? input.conversionAttempts + input.penaltyAttempts
      : input.missedGoalKicks != null && overallMade != null
        ? overallMade + input.missedGoalKicks
        : null;
  const overall = kickingRow({
    key: "overall",
    label: "Overall Kicking",
    made: overallMade,
    attempts: overallAttempts,
    periodLabel: input.periodLabel,
    matches: input.matches,
    matchesWithAttemptData: input.matchesWithAttemptData,
  });

  const rows = [overall, pen, conv, dg];
  const available = rows.some((r) => r.percent != null);
  const madeAny =
    (input.conversions ?? 0) + (input.penalties ?? 0) + (input.dropGoals ?? 0) > 0;
  const applicable = input.goalKickRole || madeAny || available;

  const coverageBits = [
    `${input.matches} matches in ${input.periodLabel}`,
    input.matchesWithAttemptData > 0
      ? `${input.matchesWithAttemptData} with goal-kick attempt data`
      : "goal-kick attempts not stored",
    ...(input.coverageNotes ?? []),
  ];

  return {
    available,
    applicable,
    rows,
    message: available
      ? null
      : applicable
        ? "Goal-kick attempts are not stored — accuracy is not inferred from successes."
        : "Goal-kicking accuracy is not applicable for this position.",
    matches: input.matches,
    matchesWithAttemptData: input.matchesWithAttemptData,
    coverageTooltip: coverageBits.join(" · "),
  };
}

/** Fly-halves are primary goal-kickers; others only when they actually kick. */
export function isGoalKickRolePosition(positionGroup: string | null | undefined): boolean {
  return positionGroup === "fly_half";
}

export function formatRank(rank: number | null): string {
  if (rank == null) return "—";
  return `#${rank}`;
}

export function isCompletedMatchStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  return (
    s.includes("complete") ||
    s.includes("finish") ||
    s === "result" ||
    s === "ft" ||
    s === "full_time" ||
    s.includes("full_time")
  );
}
