/**
 * Central position-group config for Player Intelligence / Performance Radar.
 * Determines radar axes, weights, peer rules, and sample thresholds.
 * Also owns the canonical rugby-position → 3×3 passing-zone mapping (not React).
 */

import type { PlayerIntelKey } from "./player-intelligence-engine";
import {
  normalizePositionFamily,
  type RadarPositionFamily,
} from "./player-radar-positions";
import type { PitchZoneKey } from "./public-player-spatial-stats-types";

export type IntelligencePositionGroup =
  | "fly_half"
  | "prop"
  | "hooker"
  | "lock"
  | "back_row"
  | "scrum_half"
  | "centre"
  | "wing"
  | "fullback"
  | "generic";

export type RadarAxisKey =
  | "attack"
  | "playmaking"
  | "kicking"
  | "gameManagement"
  | "defence"
  | "physical"
  | "scrummaging"
  | "setPiece"
  | "carryImpact"
  | "breakdown"
  | "lineout"
  | "workRate"
  | "passing"
  | "speed"
  | "finishing";

export type RadarAxisConfig = {
  key: RadarAxisKey;
  label: string;
  /** Maps to stored intelligence / rating column when available. */
  intelKey?: PlayerIntelKey;
};

export type PositionIntelligenceConfig = {
  group: IntelligencePositionGroup;
  modelVersion: string;
  label: string;
  /** Peer cohort label fragment e.g. "Fly-Half". */
  peerLabel: string;
  radarAxes: RadarAxisConfig[];
  /** Minimum valid radar metrics (of radarAxes.length) before drawing polygon. */
  minRadarMetrics: number;
  minPeerAppearances: number;
  minPeerMinutes: number;
  minPeerCoverage: number;
};

const FLY_HALF_AXES: RadarAxisConfig[] = [
  { key: "attack", label: "Attack", intelKey: "attack" },
  { key: "playmaking", label: "Playmaking", intelKey: "playmaking" },
  { key: "kicking", label: "Kicking", intelKey: "kicking" },
  { key: "gameManagement", label: "Game Management", intelKey: "game_management" },
  { key: "defence", label: "Defence", intelKey: "defence" },
  { key: "physical", label: "Physical", intelKey: "physical" },
];

export const PLAYER_INTELLIGENCE_POSITION_CONFIG: Record<
  IntelligencePositionGroup,
  PositionIntelligenceConfig
> = {
  fly_half: {
    group: "fly_half",
    modelVersion: "player-fly-half-v1",
    label: "Fly-Half",
    peerLabel: "Fly-Half",
    radarAxes: FLY_HALF_AXES,
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  prop: {
    group: "prop",
    modelVersion: "player-prop-v1",
    label: "Prop",
    peerLabel: "Prop",
    radarAxes: [
      { key: "scrummaging", label: "Scrummaging" },
      { key: "setPiece", label: "Set Piece" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "carryImpact", label: "Carry Impact" },
      { key: "breakdown", label: "Breakdown" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  hooker: {
    group: "hooker",
    modelVersion: "player-hooker-v1",
    label: "Hooker",
    peerLabel: "Hooker",
    radarAxes: [
      { key: "setPiece", label: "Set Piece" },
      { key: "lineout", label: "Lineout" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "carryImpact", label: "Carry Impact" },
      { key: "breakdown", label: "Breakdown" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  lock: {
    group: "lock",
    modelVersion: "player-lock-v1",
    label: "Lock",
    peerLabel: "Lock",
    radarAxes: [
      { key: "lineout", label: "Lineout" },
      { key: "setPiece", label: "Set Piece" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "carryImpact", label: "Carry Impact" },
      { key: "workRate", label: "Work Rate" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  back_row: {
    group: "back_row",
    modelVersion: "player-back-row-v1",
    label: "Back Row",
    peerLabel: "Back Row",
    radarAxes: [
      { key: "breakdown", label: "Breakdown" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "carryImpact", label: "Carry Impact" },
      { key: "workRate", label: "Work Rate" },
      { key: "attack", label: "Attack", intelKey: "attack" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  scrum_half: {
    group: "scrum_half",
    modelVersion: "player-scrum-half-v1",
    label: "Scrum-Half",
    peerLabel: "Scrum-Half",
    radarAxes: [
      { key: "passing", label: "Passing" },
      { key: "playmaking", label: "Playmaking", intelKey: "playmaking" },
      { key: "kicking", label: "Kicking", intelKey: "kicking" },
      { key: "gameManagement", label: "Game Management", intelKey: "game_management" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "speed", label: "Speed" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  centre: {
    group: "centre",
    modelVersion: "player-centre-v1",
    label: "Centre",
    peerLabel: "Centre",
    radarAxes: [
      { key: "attack", label: "Attack", intelKey: "attack" },
      { key: "playmaking", label: "Playmaking", intelKey: "playmaking" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "finishing", label: "Finishing" },
      { key: "workRate", label: "Work Rate" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  wing: {
    group: "wing",
    modelVersion: "player-wing-v1",
    label: "Wing",
    peerLabel: "Wing",
    radarAxes: [
      { key: "attack", label: "Attack", intelKey: "attack" },
      { key: "finishing", label: "Finishing" },
      { key: "speed", label: "Speed" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "kicking", label: "Kicking", intelKey: "kicking" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  fullback: {
    group: "fullback",
    modelVersion: "player-fullback-v1",
    label: "Fullback",
    peerLabel: "Fullback",
    radarAxes: [
      { key: "attack", label: "Attack", intelKey: "attack" },
      { key: "kicking", label: "Kicking", intelKey: "kicking" },
      { key: "defence", label: "Defence", intelKey: "defence" },
      { key: "physical", label: "Physical", intelKey: "physical" },
      { key: "playmaking", label: "Playmaking", intelKey: "playmaking" },
      { key: "gameManagement", label: "Game Management", intelKey: "game_management" },
    ],
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
  generic: {
    group: "generic",
    modelVersion: "player-generic-v1",
    label: "Player",
    peerLabel: "Player",
    radarAxes: FLY_HALF_AXES,
    minRadarMetrics: 4,
    minPeerAppearances: 5,
    minPeerMinutes: 300,
    minPeerCoverage: 40,
  },
};

export function resolveIntelligencePositionGroup(
  positionName: string | null | undefined,
): IntelligencePositionGroup {
  const p = (positionName ?? "").toLowerCase();
  if (!p) return "generic";
  if (p.includes("fly") || p.includes("10") || p.includes("out-half") || p.includes("outhalf")) {
    return "fly_half";
  }
  if (p.includes("prop") || p.includes("loosehead") || p.includes("tighthead") || /\b[13]\b/.test(p)) {
    return "prop";
  }
  if (p.includes("hooker") || /\b2\b/.test(p)) return "hooker";
  if (p.includes("lock") || p.includes("second row") || /\b[45]\b/.test(p)) return "lock";
  if (
    p.includes("flanker") ||
    p.includes("number 8") ||
    p.includes("no. 8") ||
    p.includes("no 8") ||
    p.includes("back row") ||
    p.includes("back-row") ||
    /\b[678]\b/.test(p)
  ) {
    return "back_row";
  }
  if (p.includes("scrum") || p.includes("half-back") || /\b9\b/.test(p)) return "scrum_half";
  if (p.includes("centre") || p.includes("center") || /\b1[23]\b/.test(p)) return "centre";
  if (p.includes("wing") || /\b1[45]\b/.test(p)) return "wing";
  if (p.includes("full") || /\b15\b/.test(p)) return "fullback";
  return "generic";
}

export function getPositionIntelligenceConfig(
  positionName: string | null | undefined,
): PositionIntelligenceConfig {
  return PLAYER_INTELLIGENCE_POSITION_CONFIG[resolveIntelligencePositionGroup(positionName)];
}

export type RadarMetricValue = {
  key: RadarAxisKey;
  label: string;
  /** 0–100 peer-normalised; null when insufficient evidence (never coerced to 0). */
  score: number | null;
  provisional?: boolean;
  coverage?: number | null;
};

export type RadarSeriesInput = {
  axes: RadarAxisConfig[];
  playerScores: Partial<Record<RadarAxisKey, number | null>>;
  peerScores?: Partial<Record<RadarAxisKey, number | null>> | null;
  provisionalKeys?: Set<RadarAxisKey> | RadarAxisKey[];
  coverages?: Partial<Record<RadarAxisKey, number | null>>;
};

/**
 * Build radar metric rows. Missing scores stay null — never forced to 0.
 */
export function buildRadarMetricValues(input: RadarSeriesInput): RadarMetricValue[] {
  const provisional = new Set(
    input.provisionalKeys instanceof Set
      ? input.provisionalKeys
      : (input.provisionalKeys ?? []),
  );
  return input.axes.map((axis) => {
    const raw = input.playerScores[axis.key];
    const score =
      raw == null || !Number.isFinite(raw) ? null : Math.max(0, Math.min(100, Math.round(raw)));
    return {
      key: axis.key,
      label: axis.label,
      score,
      provisional: score != null && provisional.has(axis.key),
      coverage: input.coverages?.[axis.key] ?? null,
    };
  });
}

export function countValidRadarMetrics(metrics: RadarMetricValue[]): number {
  return metrics.filter((m) => m.score != null).length;
}

export function canDrawRadarPolygon(
  metrics: RadarMetricValue[],
  minRequired: number,
): boolean {
  return countValidRadarMetrics(metrics) >= minRequired;
}

/** Compact competition tags for radar legends (URC, Prem, etc.). */
function shortPeerCompetitionLabel(name: string): string {
  const lower = name.trim().toLowerCase();
  if (!lower) return name;
  if (lower.includes("united rugby")) return "URC";
  if (lower.includes("premiership")) return "Prem";
  if (lower.includes("top 14") || lower.includes("top14")) return "Top 14";
  if (lower.includes("currie cup")) return "Currie Cup";
  if (lower.includes("super rugby")) return "Super Rugby";
  if (lower.includes("champions cup")) return "Champions Cup";
  if (lower.includes("challenge cup")) return "Challenge Cup";
  if (lower.includes("six nations")) return "Six Nations";
  if (lower.includes("rugby championship")) return "TRC";
  return name.trim();
}

export function formatPeerAverageLabel(input: {
  peerLabel: string;
  competitionName?: string | null;
  source: "cohort" | "static" | "global" | "international" | null;
}): string {
  const base = `Avg ${input.peerLabel}`;
  if (input.source === "static") return `${base} (Global)`;
  if (input.source === "global") return `${base} (Global)`;
  if (input.source === "international") return `${base} (International)`;
  if (input.competitionName) {
    return `${base} (${shortPeerCompetitionLabel(input.competitionName)})`;
  }
  return `${base} (Global)`;
}

export type PassingZoneWeight = { key: PitchZoneKey; weight: number };

/**
 * Canonical rugby position → 3×3 passing channel.
 * Bulk stays in the position's natural channel — not a mock spread (e.g. 6/15/25/11).
 * Adjacent splits are only used when the side of the pitch is unknown (wide wing).
 */
export const PASSING_PITCH_ZONE_WEIGHTS: Partial<
  Record<RadarPositionFamily, readonly PassingZoneWeight[]>
> = {
  fly_half: [{ key: "middle_centre", weight: 1 }],
  scrum_half: [{ key: "middle_centre", weight: 1 }],
  inside_centre: [{ key: "middle_centre", weight: 1 }],
  outside_centre: [{ key: "middle_right", weight: 1 }],
  centre: [{ key: "middle_centre", weight: 1 }],
  left_wing: [{ key: "attacking_left", weight: 1 }],
  right_wing: [{ key: "attacking_right", weight: 1 }],
  wing: [
    { key: "attacking_left", weight: 0.5 },
    { key: "attacking_right", weight: 0.5 },
  ],
  full_back: [{ key: "defensive_centre", weight: 1 }],
  number_eight: [{ key: "middle_centre", weight: 1 }],
  blindside_flanker: [{ key: "middle_centre", weight: 1 }],
  openside_flanker: [{ key: "middle_centre", weight: 1 }],
  flanker: [{ key: "middle_centre", weight: 1 }],
  lock: [{ key: "middle_centre", weight: 1 }],
  loosehead_prop: [{ key: "defensive_centre", weight: 1 }],
  tighthead_prop: [{ key: "defensive_centre", weight: 1 }],
  prop: [{ key: "defensive_centre", weight: 1 }],
  hooker: [{ key: "defensive_centre", weight: 1 }],
};

function familyFromAppearance(
  positionName: string | null | undefined,
  jerseyNumber: number | null | undefined,
): RadarPositionFamily {
  const fromName = normalizePositionFamily(positionName);
  if (fromName !== "unknown") return fromName;
  if (jerseyNumber != null && jerseyNumber >= 1 && jerseyNumber <= 15) {
    return normalizePositionFamily(String(jerseyNumber));
  }
  return "unknown";
}

/**
 * Map a match/primary position (+ optional 1–15 jersey) onto passing-zone weights.
 * Returns null when the position cannot be resolved — callers must exclude those passes.
 */
export function resolvePassingPitchZoneWeights(
  positionName: string | null | undefined,
  jerseyNumber?: number | null,
): PassingZoneWeight[] | null {
  const raw = (positionName ?? "").toLowerCase();
  const family = familyFromAppearance(positionName, jerseyNumber);
  if (family === "unknown") return null;

  if (family === "flanker" || family === "blindside_flanker" || family === "openside_flanker") {
    if (/\bleft\b/.test(raw)) return [{ key: "middle_left", weight: 1 }];
    if (/\bright\b/.test(raw)) return [{ key: "middle_right", weight: 1 }];
  }

  const mapped = PASSING_PITCH_ZONE_WEIGHTS[family];
  return mapped ? [...mapped] : null;
}

/** Bench / unnamed match roles should fall back to primary position, not jersey 16–23. */
export function isUsableMatchPosition(positionName: string | null | undefined): boolean {
  const n = (positionName ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!n) return false;
  if (
    n.includes("replacement") ||
    n.includes("bench") ||
    n.includes("reserve") ||
    n.includes("substitute") ||
    n.includes("sub ") ||
    n === "sub"
  ) {
    return false;
  }
  return normalizePositionFamily(positionName) !== "unknown";
}

/**
 * Match lineup position, else starting jersey 1–15, else primary profile position.
 * Never silently treats an unmapped role as centre.
 */
export function resolveAppearancePassingPosition(input: {
  matchPositionName: string | null | undefined;
  jerseyNumber: number | null | undefined;
  primaryPositionName: string | null | undefined;
}): { positionName: string | null; jerseyNumber: number | null } {
  if (isUsableMatchPosition(input.matchPositionName)) {
    return {
      positionName: input.matchPositionName ?? null,
      jerseyNumber: input.jerseyNumber ?? null,
    };
  }
  const jersey = input.jerseyNumber ?? null;
  if (jersey != null && jersey >= 1 && jersey <= 15) {
    return {
      positionName: null,
      jerseyNumber: jersey,
    };
  }
  return {
    positionName: input.primaryPositionName ?? null,
    jerseyNumber: null,
  };
}
