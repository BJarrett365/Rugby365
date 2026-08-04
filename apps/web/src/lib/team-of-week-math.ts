/**
 * Team of the Week v1 — pure selection math (no DB).
 * Does not replace Rugby365 match ratings; adds selectionScore on top.
 */

import {
  normalizePositionFamily,
  type RadarPositionFamily,
} from "./player-radar-positions";

export const TOTW_METHOD_VERSION = "totw-v1";

export type TotwSelectionType =
  | "STARTING"
  | "BENCH"
  | "CLOSE_CALL"
  | "DROPPED_OUT";

export type TotwPlayerStats = {
  tries: number;
  tryAssists: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  carries: number;
  metresCarried: number;
  lineBreaks: number;
  defendersBeaten: number;
  points: number;
  minutesPlayed: number;
  missedTackles: number | null;
  offloads: number | null;
  passes: number | null;
  kicksFromHand: number | null;
};

export type TotwCandidate = {
  playerId: string;
  playerName: string;
  playerSlug: string | null;
  imageUrl: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string | null;
  teamImageUrl: string | null;
  fixtureId: string;
  positionName: string | null;
  jerseyNumber: number | null;
  squadRole: string | null;
  matchRating: number;
  stats: TotwPlayerStats;
  wonMatch: boolean;
};

export type TotwSlotDef = {
  shirt: number;
  code: string;
  label: string;
  families: RadarPositionFamily[];
  /** Preferred jersey numbers that auto-qualify */
  jerseyMatch?: number[];
};

export const XV_SLOTS: TotwSlotDef[] = [
  {
    shirt: 1,
    code: "loosehead_prop",
    label: "Loosehead Prop",
    families: ["loosehead_prop", "prop"],
    jerseyMatch: [1],
  },
  {
    shirt: 2,
    code: "hooker",
    label: "Hooker",
    families: ["hooker"],
    jerseyMatch: [2],
  },
  {
    shirt: 3,
    code: "tighthead_prop",
    label: "Tighthead Prop",
    families: ["tighthead_prop", "prop"],
    jerseyMatch: [3],
  },
  {
    shirt: 4,
    code: "lock",
    label: "Lock",
    families: ["lock"],
    jerseyMatch: [4, 5],
  },
  {
    shirt: 5,
    code: "lock",
    label: "Lock",
    families: ["lock"],
    jerseyMatch: [4, 5],
  },
  {
    shirt: 6,
    code: "blindside_flanker",
    label: "Blindside Flanker",
    families: ["blindside_flanker", "flanker"],
    jerseyMatch: [6],
  },
  {
    shirt: 7,
    code: "openside_flanker",
    label: "Openside Flanker",
    families: ["openside_flanker", "flanker"],
    jerseyMatch: [7],
  },
  {
    shirt: 8,
    code: "number_eight",
    label: "Number Eight",
    families: ["number_eight", "flanker"],
    jerseyMatch: [8],
  },
  {
    shirt: 9,
    code: "scrum_half",
    label: "Scrum-half",
    families: ["scrum_half"],
    jerseyMatch: [9],
  },
  {
    shirt: 10,
    code: "fly_half",
    label: "Fly-half",
    families: ["fly_half"],
    jerseyMatch: [10],
  },
  {
    shirt: 11,
    code: "left_wing",
    label: "Left Wing",
    families: ["left_wing", "wing"],
    jerseyMatch: [11],
  },
  {
    shirt: 12,
    code: "inside_centre",
    label: "Inside Centre",
    families: ["inside_centre", "centre"],
    jerseyMatch: [12],
  },
  {
    shirt: 13,
    code: "outside_centre",
    label: "Outside Centre",
    families: ["outside_centre", "centre"],
    jerseyMatch: [13],
  },
  {
    shirt: 14,
    code: "right_wing",
    label: "Right Wing",
    families: ["right_wing", "wing"],
    jerseyMatch: [14],
  },
  {
    shirt: 15,
    code: "full_back",
    label: "Full-back",
    families: ["full_back", "wing"],
    jerseyMatch: [15],
  },
];

export const BENCH_SLOTS: TotwSlotDef[] = [
  { shirt: 16, code: "hooker", label: "Hooker", families: ["hooker"], jerseyMatch: [2, 16] },
  {
    shirt: 17,
    code: "loosehead_prop",
    label: "Loosehead Prop",
    families: ["loosehead_prop", "prop"],
    jerseyMatch: [1, 17],
  },
  {
    shirt: 18,
    code: "tighthead_prop",
    label: "Tighthead Prop",
    families: ["tighthead_prop", "prop"],
    jerseyMatch: [3, 18],
  },
  { shirt: 19, code: "lock", label: "Lock", families: ["lock"], jerseyMatch: [4, 5, 19] },
  {
    shirt: 20,
    code: "back_row",
    label: "Back-row",
    families: ["blindside_flanker", "openside_flanker", "number_eight", "flanker"],
    jerseyMatch: [6, 7, 8, 20],
  },
  {
    shirt: 21,
    code: "scrum_half",
    label: "Scrum-half",
    families: ["scrum_half"],
    jerseyMatch: [9, 21],
  },
  {
    shirt: 22,
    code: "playmaker",
    label: "Fly-half / Centre",
    families: ["fly_half", "inside_centre", "outside_centre", "centre"],
    jerseyMatch: [10, 12, 13, 22],
  },
  {
    shirt: 23,
    code: "outside_back",
    label: "Outside Back",
    families: ["left_wing", "right_wing", "full_back", "wing"],
    jerseyMatch: [11, 14, 15, 23],
  },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function candidateFamily(c: TotwCandidate): RadarPositionFamily {
  if (c.jerseyNumber != null && c.jerseyNumber >= 1 && c.jerseyNumber <= 15) {
    const byJersey = XV_SLOTS.find((s) => s.jerseyMatch?.includes(c.jerseyNumber!));
    if (byJersey) return byJersey.families[0]!;
  }
  return normalizePositionFamily(c.positionName);
}

export function isEligibleForSlot(c: TotwCandidate, slot: TotwSlotDef): boolean {
  if (c.jerseyNumber != null && slot.jerseyMatch?.includes(c.jerseyNumber)) return true;
  const family = candidateFamily(c);
  return slot.families.includes(family);
}

/** Position-weighted stat contribution 0–10-ish, then blended with match rating. */
export function calculatePositionStatScore(
  slotCode: string,
  stats: TotwPlayerStats,
): number {
  const t = stats;
  const tackleBase = t.tacklesMade || t.tacklesCompleted;
  switch (slotCode) {
    case "loosehead_prop":
    case "tighthead_prop":
      return (
        tackleBase * 0.35 +
        t.carries * 0.25 +
        t.metresCarried * 0.02 +
        t.dominantTackles * 0.4 +
        t.turnoversWon * 0.3
      );
    case "hooker":
      return (
        tackleBase * 0.3 +
        t.carries * 0.2 +
        t.tries * 1.2 +
        t.turnoversWon * 0.35 +
        t.metresCarried * 0.015
      );
    case "lock":
      return (
        tackleBase * 0.35 +
        t.carries * 0.22 +
        t.turnoversWon * 0.4 +
        t.metresCarried * 0.02 +
        t.dominantTackles * 0.3
      );
    case "blindside_flanker":
    case "openside_flanker":
    case "number_eight":
    case "back_row":
      return (
        tackleBase * 0.28 +
        t.turnoversWon * 0.7 +
        t.dominantTackles * 0.45 +
        t.carries * 0.18 +
        t.metresCarried * 0.02 +
        t.tries * 1.1
      );
    case "scrum_half":
      return (
        t.tryAssists * 1.4 +
        t.lineBreaks * 0.9 +
        tackleBase * 0.25 +
        (t.passes ?? 0) * 0.04 +
        t.tries * 1.0
      );
    case "fly_half":
    case "playmaker":
      return (
        t.points * 0.12 +
        t.tryAssists * 1.3 +
        t.lineBreaks * 0.85 +
        (t.kicksFromHand ?? 0) * 0.08 +
        t.tries * 1.0
      );
    case "inside_centre":
    case "outside_centre":
      return (
        t.carries * 0.22 +
        t.metresCarried * 0.03 +
        t.defendersBeaten * 0.55 +
        t.lineBreaks * 0.9 +
        tackleBase * 0.28 +
        t.tryAssists * 0.9
      );
    case "left_wing":
    case "right_wing":
    case "outside_back":
      return (
        t.tries * 1.5 +
        t.metresCarried * 0.035 +
        t.lineBreaks * 1.0 +
        t.defendersBeaten * 0.5 +
        t.carries * 0.12
      );
    case "full_back":
      return (
        t.metresCarried * 0.035 +
        t.lineBreaks * 0.9 +
        t.tries * 1.2 +
        tackleBase * 0.25 +
        (t.kicksFromHand ?? 0) * 0.1 +
        t.defendersBeaten * 0.4
      );
    default:
      return (
        tackleBase * 0.2 +
        t.carries * 0.15 +
        t.metresCarried * 0.02 +
        t.tries * 1.0 +
        t.turnoversWon * 0.4
      );
  }
}

export function calculateSelectionScore(
  slotCode: string,
  candidate: TotwCandidate,
): number {
  const ratingPart = candidate.matchRating; // 1–10
  const statRaw = calculatePositionStatScore(slotCode, candidate.stats);
  const minutesFactor = clamp(candidate.stats.minutesPlayed / 60, 0.35, 1.05);
  const starterBonus = candidate.squadRole === "starter" ? 0.15 : 0;
  const winBonus = candidate.wonMatch ? 0.12 : 0;
  // Blend: rating dominates; stats add position colour; scale stats into ~0–2 band.
  const statPart = clamp(statRaw * 0.08, 0, 2.2);
  return Math.round((ratingPart * 0.72 + statPart * minutesFactor + starterBonus + winBonus) * 100) / 100;
}

export function calculateConfidencePct(input: {
  matchRating: number | null;
  minutesPlayed: number;
  hasStats: boolean;
  positionConfirmed: boolean;
  gapToNext: number | null;
}): number {
  let c = 48;
  if (input.matchRating != null) c += 18;
  if (input.minutesPlayed >= 60) c += 12;
  else if (input.minutesPlayed >= 40) c += 6;
  if (input.hasStats) c += 10;
  if (input.positionConfirmed) c += 8;
  if (input.gapToNext != null) {
    if (input.gapToNext >= 0.8) c += 10;
    else if (input.gapToNext >= 0.3) c += 5;
  }
  return clamp(Math.round(c), 35, 96);
}

export function buildShortReason(stats: TotwPlayerStats, matchRating: number): string {
  const bits: string[] = [];
  if (stats.tries > 0) bits.push(`${stats.tries} tr${stats.tries === 1 ? "y" : "ies"}`);
  const tackles = stats.tacklesMade || stats.tacklesCompleted;
  if (tackles > 0) bits.push(`${tackles} tackles`);
  if (stats.turnoversWon > 0) bits.push(`${stats.turnoversWon} turnovers`);
  if (stats.metresCarried >= 40) bits.push(`${stats.metresCarried}m`);
  if (stats.lineBreaks > 0) bits.push(`${stats.lineBreaks} breaks`);
  if (stats.tryAssists > 0) bits.push(`${stats.tryAssists} assists`);
  if (!bits.length) return `Match rating ${matchRating.toFixed(1)}`;
  return bits.slice(0, 4).join(", ");
}

export function buildFullReason(input: {
  playerName: string;
  positionLabel: string;
  teamName: string;
  matchRating: number;
  stats: TotwPlayerStats;
  wonMatch: boolean;
}): string {
  const short = buildShortReason(input.stats, input.matchRating);
  const result = input.wonMatch ? "in a winning side" : "despite the result";
  return `${input.playerName} earned the ${input.positionLabel} berth for ${input.teamName} with a ${input.matchRating.toFixed(1)} match rating ${result}. Key numbers: ${short}.`;
}

export type TotwPick = {
  candidate: TotwCandidate;
  slot: TotwSlotDef;
  selectionType: TotwSelectionType;
  selectionScore: number;
  confidencePct: number;
  shortReason: string;
  fullReason: string;
  rankAtPosition: number;
  gapToNext: number | null;
};

function rankForSlot(
  candidates: TotwCandidate[],
  slot: TotwSlotDef,
  used: Set<string>,
): Array<{ c: TotwCandidate; score: number }> {
  return candidates
    .filter((c) => !used.has(c.playerId) && isEligibleForSlot(c, slot))
    .map((c) => ({ c, score: calculateSelectionScore(slot.code, c) }))
    .sort((a, b) => b.score - a.score || b.c.matchRating - a.c.matchRating);
}

export function selectStartingXv(candidates: TotwCandidate[]): {
  starting: TotwPick[];
  closeCalls: TotwPick[];
  usedIds: Set<string>;
} {
  const used = new Set<string>();
  const starting: TotwPick[] = [];
  const closeCalls: TotwPick[] = [];

  for (const slot of XV_SLOTS) {
    const ranked = rankForSlot(candidates, slot, used);
    const best = ranked[0];
    if (!best) continue;
    used.add(best.c.playerId);
    const next = ranked[1];
    const gap = next ? Math.round((best.score - next.score) * 100) / 100 : null;
    const positionConfirmed =
      (best.c.jerseyNumber != null && slot.jerseyMatch?.includes(best.c.jerseyNumber)) ||
      slot.families.includes(normalizePositionFamily(best.c.positionName));
    starting.push({
      candidate: best.c,
      slot,
      selectionType: "STARTING",
      selectionScore: best.score,
      confidencePct: calculateConfidencePct({
        matchRating: best.c.matchRating,
        minutesPlayed: best.c.stats.minutesPlayed,
        hasStats: best.c.stats.tacklesMade + best.c.stats.carries + best.c.stats.tries > 0,
        positionConfirmed,
        gapToNext: gap,
      }),
      shortReason: buildShortReason(best.c.stats, best.c.matchRating),
      fullReason: buildFullReason({
        playerName: best.c.playerName,
        positionLabel: slot.label,
        teamName: best.c.teamName,
        matchRating: best.c.matchRating,
        stats: best.c.stats,
        wonMatch: best.c.wonMatch,
      }),
      rankAtPosition: 1,
      gapToNext: gap,
    });
    if (next) {
      closeCalls.push({
        candidate: next.c,
        slot,
        selectionType: "CLOSE_CALL",
        selectionScore: next.score,
        confidencePct: calculateConfidencePct({
          matchRating: next.c.matchRating,
          minutesPlayed: next.c.stats.minutesPlayed,
          hasStats: true,
          positionConfirmed: true,
          gapToNext: gap,
        }),
        shortReason: `Missed by ${gap?.toFixed(2) ?? "—"} pts`,
        fullReason: `${next.c.playerName} was next-best at ${slot.label} (${next.score.toFixed(2)} vs ${best.score.toFixed(2)}). ${buildShortReason(next.c.stats, next.c.matchRating)}.`,
        rankAtPosition: 2,
        gapToNext: gap,
      });
    }
  }

  return { starting, closeCalls, usedIds: used };
}

export function selectImpactBench(
  candidates: TotwCandidate[],
  usedIds: Set<string>,
): TotwPick[] {
  const used = new Set(usedIds);
  const bench: TotwPick[] = [];
  for (const slot of BENCH_SLOTS) {
    const ranked = rankForSlot(candidates, slot, used);
    const best = ranked[0];
    if (!best) continue;
    used.add(best.c.playerId);
    bench.push({
      candidate: best.c,
      slot,
      selectionType: "BENCH",
      selectionScore: best.score,
      confidencePct: calculateConfidencePct({
        matchRating: best.c.matchRating,
        minutesPlayed: best.c.stats.minutesPlayed,
        hasStats: true,
        positionConfirmed: true,
        gapToNext: ranked[1] ? best.score - ranked[1].score : null,
      }),
      shortReason: buildShortReason(best.c.stats, best.c.matchRating),
      fullReason: buildFullReason({
        playerName: best.c.playerName,
        positionLabel: `Impact ${slot.label}`,
        teamName: best.c.teamName,
        matchRating: best.c.matchRating,
        stats: best.c.stats,
        wonMatch: best.c.wonMatch,
      }),
      rankAtPosition: 1,
      gapToNext: ranked[1] ? Math.round((best.score - ranked[1].score) * 100) / 100 : null,
    });
  }
  return bench;
}

export function selectPlayerOfWeek(starting: TotwPick[]): TotwPick | null {
  if (!starting.length) return null;
  return [...starting].sort(
    (a, b) =>
      b.selectionScore - a.selectionScore ||
      b.candidate.matchRating - a.candidate.matchRating,
  )[0]!;
}

export function validateStartingXv(picks: TotwPick[]): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const shirts = picks.map((p) => p.slot.shirt);
  const ids = picks.map((p) => p.candidate.playerId);
  if (new Set(ids).size !== ids.length) errors.push("Duplicate players in XV");
  if (new Set(shirts).size !== shirts.length) errors.push("Duplicate shirt numbers");
  for (const shirt of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    if (!shirts.includes(shirt)) errors.push(`Missing shirt ${shirt}`);
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeRoundKey(round: string | null | undefined): string | null {
  if (!round?.trim()) return null;
  const t = round.trim().toLowerCase().replace(/\s+/g, " ");
  const m = t.match(/round\s*0*(\d+)/i);
  if (m) return `round-${m[1]}`;
  const week = t.match(/(?:match\s*)?week\s*0*(\d+)/i);
  if (week) return `week-${week[1]}`;
  return t
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || null;
}

export function extractRoundNumber(round: string | null | undefined): number | null {
  if (!round) return null;
  const m = round.match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

export function formatRoundName(roundKey: string, roundNameRaw?: string | null): string {
  if (roundNameRaw?.trim()) return roundNameRaw.trim();
  const m = roundKey.match(/^round-(\d+)$/);
  if (m) return `Round ${m[1]}`;
  const w = roundKey.match(/^week-(\d+)$/);
  if (w) return `Week ${w[1]}`;
  return roundKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function attackBiasScore(stats: TotwPlayerStats): number {
  return (
    stats.tries * 2 +
    stats.metresCarried * 0.03 +
    stats.lineBreaks * 1.2 +
    stats.defendersBeaten * 0.6 +
    stats.tryAssists * 1.1
  );
}

export function defenceBiasScore(stats: TotwPlayerStats): number {
  return (
    (stats.tacklesMade || stats.tacklesCompleted) * 0.35 +
    stats.dominantTackles * 0.6 +
    stats.turnoversWon * 0.9 -
    (stats.missedTackles ?? 0) * 0.4
  );
}
