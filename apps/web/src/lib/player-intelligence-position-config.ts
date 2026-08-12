/**
 * Central position-group config for Player Intelligence / Performance Radar.
 * Determines radar axes, weights, peer rules, and sample thresholds.
 */

import type { PlayerIntelKey } from "./player-intelligence-engine";

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

export function formatPeerAverageLabel(input: {
  peerLabel: string;
  competitionName?: string | null;
  source: "cohort" | "static" | "global" | "international" | null;
}): string {
  const base = `Avg ${input.peerLabel}`;
  if (input.source === "static") return `${base} (Global)`;
  if (input.source === "global") return `${base} (Global)`;
  if (input.source === "international") return `${base} (International)`;
  if (input.competitionName) return `${base} (${input.competitionName})`;
  return `${base} (Global)`;
}
