/**
 * Coach Impact v1 — metric metadata, directions, and public change labels.
 * Deterministic formatting only; no AI.
 */

export const COACH_IMPACT_VERSION = "coach-impact-v1";

export type ImpactMetricDirection =
  | "HIGHER_BETTER"
  | "LOWER_BETTER"
  | "LOWER_RANK_BETTER";

export type ImpactMetricKey =
  | "win_rate"
  | "world_rank"
  | "points_per_game"
  | "points_against_per_game"
  | "tries_per_game"
  | "power_index"
  | "team_rating";

export type ImpactMetricDef = {
  key: ImpactMetricKey;
  label: string;
  direction: ImpactMetricDirection;
  /** Public overview row order */
  overview: boolean;
  format: "pct" | "pp" | "decimal1" | "rank" | "places";
};

export const COACH_IMPACT_METRICS: ImpactMetricDef[] = [
  {
    key: "win_rate",
    label: "Win Rate",
    direction: "HIGHER_BETTER",
    overview: true,
    format: "pct",
  },
  {
    key: "world_rank",
    label: "World Rank",
    direction: "LOWER_RANK_BETTER",
    overview: true,
    format: "rank",
  },
  {
    key: "points_per_game",
    label: "Points / Game",
    direction: "HIGHER_BETTER",
    overview: true,
    format: "decimal1",
  },
  {
    key: "points_against_per_game",
    label: "Points Against / Game",
    direction: "LOWER_BETTER",
    overview: true,
    format: "decimal1",
  },
  {
    key: "tries_per_game",
    label: "Tries / Game",
    direction: "HIGHER_BETTER",
    overview: true,
    format: "decimal1",
  },
  {
    key: "power_index",
    label: "Power Index",
    direction: "HIGHER_BETTER",
    overview: false,
    format: "decimal1",
  },
  {
    key: "team_rating",
    label: "Team Rating",
    direction: "HIGHER_BETTER",
    overview: false,
    format: "decimal1",
  },
];

export function impactMetricDef(key: ImpactMetricKey): ImpactMetricDef {
  return COACH_IMPACT_METRICS.find((m) => m.key === key)!;
}

export function isImpactImproved(
  direction: ImpactMetricDirection,
  before: number,
  under: number,
): boolean | null {
  if (before === under) return null;
  if (direction === "HIGHER_BETTER") return under > before;
  if (direction === "LOWER_BETTER") return under < before;
  // LOWER_RANK_BETTER — lower numeric rank is better
  return under < before;
}

export function formatImpactValue(
  format: ImpactMetricDef["format"],
  value: number | null,
): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (format === "pct") return `${Math.round(value)}%`;
  if (format === "rank") return `#${Math.round(value)}`;
  if (format === "decimal1") return (Math.round(value * 10) / 10).toFixed(1);
  if (format === "pp" || format === "places") return String(Math.round(value));
  return String(value);
}

/**
 * Public change label — metric-aware.
 * Win Rate: +23 pts
 * World Rank: ▲ 6 places
 * Points Against: -5.6 (green via improved flag, not the minus alone)
 */
export function formatImpactChange(
  def: ImpactMetricDef,
  before: number | null,
  under: number | null,
): { label: string | null; raw: number | null; improved: boolean | null } {
  if (before == null || under == null) {
    return { label: null, raw: null, improved: null };
  }
  const improved = isImpactImproved(def.direction, before, under);

  if (def.key === "world_rank") {
    const places = Math.round(before) - Math.round(under);
    if (places === 0) return { label: "0 places", raw: 0, improved: null };
    const abs = Math.abs(places);
    const arrow = places > 0 ? "▲" : "▼";
    return {
      label: `${arrow} ${abs} place${abs === 1 ? "" : "s"}`,
      raw: places,
      improved,
    };
  }

  if (def.key === "win_rate") {
    const pp = Math.round(under - before);
    if (pp === 0) return { label: "0 pts", raw: 0, improved: null };
    return {
      label: `${pp > 0 ? "+" : ""}${pp} pts`,
      raw: pp,
      improved,
    };
  }

  const delta = Math.round((under - before) * 10) / 10;
  if (delta === 0) return { label: "0.0", raw: 0, improved: null };
  return {
    label: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
    raw: delta,
    improved,
  };
}

export function impactConfidenceBand(input: {
  beforeCount: number;
  underCount: number;
  rankingCoverage: boolean;
  triesCoveragePct: number;
}): { confidence: "high" | "medium" | "low" | "none"; confidencePct: number; enoughData: boolean } {
  const { beforeCount, underCount } = input;
  if (underCount < 5 || beforeCount < 5) {
    return { confidence: "none", confidencePct: 0, enoughData: false };
  }
  let pct = 40;
  if (beforeCount >= 20) pct += 20;
  else if (beforeCount >= 10) pct += 12;
  else pct += 5;
  if (underCount >= 20) pct += 20;
  else if (underCount >= 10) pct += 12;
  else pct += 5;
  if (input.rankingCoverage) pct += 10;
  if (input.triesCoveragePct >= 60) pct += 10;
  else if (input.triesCoveragePct >= 30) pct += 5;
  pct = Math.max(0, Math.min(99, pct));
  const enoughData = beforeCount >= 10 && underCount >= 10;
  const confidence =
    pct >= 80 && enoughData ? "high" : pct >= 55 && enoughData ? "medium" : "low";
  return { confidence, confidencePct: pct, enoughData };
}
