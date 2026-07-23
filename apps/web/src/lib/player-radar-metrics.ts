/**
 * Radar metric catalogue — only metrics backed by Rugby365 season/match stats.
 * Missing source metrics are omitted (never invent or zero-fill as strength).
 */

import type { RadarPositionFamily } from "./player-radar-positions";

export type RadarType =
  | "overall"
  | "attack"
  | "defence"
  | "carrying"
  | "set_piece"
  | "kicking"
  | "discipline"
  | "physical";

export const RADAR_TYPE_LABELS: Record<RadarType, string> = {
  overall: "Overall Player DNA",
  attack: "Attack",
  defence: "Defence",
  carrying: "Ball carrying",
  set_piece: "Set piece",
  kicking: "Kicking",
  discipline: "Discipline",
  physical: "Physical",
};

export type RadarMetricKey =
  | "tries_per80"
  | "try_assists_per80"
  | "carries_per80"
  | "metres_per80"
  | "metres_per_carry"
  | "defenders_beaten_per80"
  | "line_breaks_per80"
  | "tackles_made_per80"
  | "tackles_completed_per80"
  | "tackle_success"
  | "dominant_tackles_per80"
  | "turnovers_per80"
  | "post_contact_metres_per80"
  | "touches_per80"
  | "ruck_effectiveness"
  | "minutes"
  | "appearances";

export type RadarMetricDef = {
  key: RadarMetricKey;
  label: string;
  /** Higher value = better unless inverted */
  inverted?: boolean;
  format: "rate" | "percent" | "count";
};

export const RADAR_METRICS: Record<RadarMetricKey, RadarMetricDef> = {
  tries_per80: { key: "tries_per80", label: "Tries", format: "rate" },
  try_assists_per80: { key: "try_assists_per80", label: "Try assists", format: "rate" },
  carries_per80: { key: "carries_per80", label: "Carries", format: "rate" },
  metres_per80: { key: "metres_per80", label: "Carry metres", format: "rate" },
  metres_per_carry: { key: "metres_per_carry", label: "Metres per carry", format: "rate" },
  defenders_beaten_per80: {
    key: "defenders_beaten_per80",
    label: "Defenders beaten",
    format: "rate",
  },
  line_breaks_per80: { key: "line_breaks_per80", label: "Clean breaks", format: "rate" },
  tackles_made_per80: { key: "tackles_made_per80", label: "Tackles", format: "rate" },
  tackles_completed_per80: {
    key: "tackles_completed_per80",
    label: "Tackles completed",
    format: "rate",
  },
  tackle_success: { key: "tackle_success", label: "Tackle %", format: "percent" },
  dominant_tackles_per80: {
    key: "dominant_tackles_per80",
    label: "Dominant tackles",
    format: "rate",
  },
  turnovers_per80: { key: "turnovers_per80", label: "Turnovers won", format: "rate" },
  post_contact_metres_per80: {
    key: "post_contact_metres_per80",
    label: "Post-contact metres",
    format: "rate",
  },
  touches_per80: { key: "touches_per80", label: "Touches", format: "rate" },
  ruck_effectiveness: {
    key: "ruck_effectiveness",
    label: "Ruck effectiveness",
    format: "percent",
  },
  minutes: { key: "minutes", label: "Minutes", format: "count" },
  appearances: { key: "appearances", label: "Matches", format: "count" },
};

export const RADAR_TYPE_METRICS: Record<RadarType, RadarMetricKey[]> = {
  attack: [
    "tries_per80",
    "try_assists_per80",
    "carries_per80",
    "metres_per80",
    "defenders_beaten_per80",
    "line_breaks_per80",
  ],
  defence: [
    "tackles_completed_per80",
    "tackle_success",
    "dominant_tackles_per80",
    "turnovers_per80",
    "tackles_made_per80",
  ],
  carrying: [
    "carries_per80",
    "metres_per80",
    "metres_per_carry",
    "post_contact_metres_per80",
    "defenders_beaten_per80",
    "touches_per80",
  ],
  set_piece: ["ruck_effectiveness", "touches_per80", "turnovers_per80"],
  kicking: [], // no reliable kick stats in season table yet
  discipline: [], // cards/penalties not in season aggregates yet
  physical: ["minutes", "appearances", "carries_per80", "tackles_made_per80", "touches_per80"],
  overall: [], // filled by position
};

/** Position-aware Overall DNA spokes (only metrics we can compute). */
export function overallMetricsForPosition(family: RadarPositionFamily): RadarMetricKey[] {
  switch (family) {
    case "loosehead_prop":
    case "tighthead_prop":
    case "prop":
    case "hooker":
      return [
        "tackles_completed_per80",
        "ruck_effectiveness",
        "carries_per80",
        "metres_per80",
        "turnovers_per80",
        "dominant_tackles_per80",
      ];
    case "lock":
      return [
        "tackles_completed_per80",
        "turnovers_per80",
        "carries_per80",
        "metres_per80",
        "line_breaks_per80",
        "ruck_effectiveness",
      ];
    case "blindside_flanker":
    case "openside_flanker":
    case "flanker":
    case "number_eight":
      return [
        "tackles_completed_per80",
        "turnovers_per80",
        "carries_per80",
        "metres_per80",
        "defenders_beaten_per80",
        "line_breaks_per80",
      ];
    case "scrum_half":
    case "fly_half":
      return [
        "try_assists_per80",
        "tries_per80",
        "carries_per80",
        "metres_per80",
        "line_breaks_per80",
        "tackles_completed_per80",
      ];
    case "inside_centre":
    case "outside_centre":
    case "centre":
      return [
        "tries_per80",
        "line_breaks_per80",
        "defenders_beaten_per80",
        "metres_per80",
        "tackles_completed_per80",
        "try_assists_per80",
      ];
    case "left_wing":
    case "right_wing":
    case "wing":
    case "full_back":
      return [
        "tries_per80",
        "metres_per80",
        "defenders_beaten_per80",
        "line_breaks_per80",
        "carries_per80",
        "tackles_completed_per80",
      ];
    default:
      return [
        "tries_per80",
        "carries_per80",
        "metres_per80",
        "tackles_completed_per80",
        "turnovers_per80",
        "line_breaks_per80",
      ];
  }
}

export function metricsForRadarType(
  type: RadarType,
  family: RadarPositionFamily,
): RadarMetricKey[] {
  if (type === "overall") return overallMetricsForPosition(family);
  return RADAR_TYPE_METRICS[type];
}

export type SeasonStatRatesInput = {
  minutesPlayed: number;
  appearances: number;
  tries: number;
  points: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
};

function per80(total: number, minutes: number): number | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return (total / minutes) * 80;
}

export function computeMetricRates(input: SeasonStatRatesInput): Partial<Record<RadarMetricKey, number>> {
  const m = input.minutesPlayed;
  const rates: Partial<Record<RadarMetricKey, number>> = {
    tries_per80: per80(input.tries, m) ?? undefined,
    try_assists_per80: per80(input.tryAssists, m) ?? undefined,
    carries_per80: per80(input.carries, m) ?? undefined,
    metres_per80: per80(input.metresCarried, m) ?? undefined,
    metres_per_carry:
      input.carries > 0 ? input.metresCarried / input.carries : undefined,
    defenders_beaten_per80: per80(input.defendersBeaten, m) ?? undefined,
    line_breaks_per80: per80(input.lineBreaks, m) ?? undefined,
    tackles_made_per80: per80(input.tacklesMade, m) ?? undefined,
    tackles_completed_per80: per80(input.tacklesCompleted, m) ?? undefined,
    tackle_success:
      input.tacklesMade > 0
        ? (input.tacklesCompleted / input.tacklesMade) * 100
        : undefined,
    dominant_tackles_per80: per80(input.dominantTackles, m) ?? undefined,
    turnovers_per80: per80(input.turnoversWon, m) ?? undefined,
    post_contact_metres_per80: per80(input.postContactMetres, m) ?? undefined,
    touches_per80: per80(input.touches, m) ?? undefined,
    ruck_effectiveness:
      input.ruckArrivalEffectiveness > 0 ? input.ruckArrivalEffectiveness : undefined,
    minutes: m > 0 ? m : undefined,
    appearances: input.appearances > 0 ? input.appearances : undefined,
  };
  return rates;
}

/** Percentile 0–100: share of cohort at or below this score (higher = stronger). */
export function percentileRank(
  value: number,
  cohortValues: number[],
  inverted = false,
): { percentile: number; rank: number } {
  if (!cohortValues.length) return { percentile: 0, rank: 1 };
  const sorted = [...cohortValues].sort((a, b) => (inverted ? a - b : b - a));
  const atOrBelow = inverted
    ? cohortValues.filter((v) => v >= value).length
    : cohortValues.filter((v) => v <= value).length;
  const percentile = Math.round((atOrBelow / cohortValues.length) * 100);
  const rank = Math.max(1, sorted.findIndex((v) => v === value) + 1);
  return { percentile: Math.max(1, Math.min(99, percentile)), rank };
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildRadarWrittenSummary(input: {
  playerName: string;
  positionLabel: string;
  competitionLabel: string | null;
  spokes: Array<{ label: string; percentile: number | null }>;
  override?: string | null;
}): string {
  if (input.override?.trim()) return input.override.trim();
  const strong = input.spokes
    .filter((s) => s.percentile != null && s.percentile >= 75)
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
    .slice(0, 3);
  if (!strong.length) {
    return `${input.playerName} does not yet have enough comparable ${input.positionLabel.toLowerCase()} sample data for a ranked radar summary.`;
  }
  const scope = input.competitionLabel
    ? `${input.competitionLabel} ${input.positionLabel.toLowerCase()}`
    : input.positionLabel.toLowerCase();
  const parts = strong.map((s) => {
    const band =
      (s.percentile ?? 0) >= 90
        ? "top 10%"
        : (s.percentile ?? 0) >= 75
          ? "top 25%"
          : `top ${100 - (s.percentile ?? 0)}%`;
    return `${band} for ${s.label.toLowerCase()}`;
  });
  if (parts.length === 1) {
    return `${input.playerName} ranks in the ${parts[0]} among ${scope}.`;
  }
  const last = parts.pop();
  return `${input.playerName} ranks in the ${parts.join(", ")} and in the ${last} among ${scope}.`;
}
