/**
 * Pure helpers for the RATING HISTORY overview card (Overall Rating 0–100).
 * Distinct from match ratings (0–10). No DB / React.
 */

export type RatingHistoryMetricKey =
  | "overall"
  | "attack"
  | "playmaking"
  | "kicking"
  | "gameManagement"
  | "defence"
  | "physical"
  | "form";

export const RATING_HISTORY_METRIC_OPTIONS: Array<{
  key: RatingHistoryMetricKey;
  label: string;
}> = [
  { key: "overall", label: "Overall Rating" },
  { key: "attack", label: "Attack" },
  { key: "playmaking", label: "Playmaking" },
  { key: "kicking", label: "Kicking" },
  { key: "gameManagement", label: "Game Management" },
  { key: "defence", label: "Defence" },
  { key: "physical", label: "Physical" },
  { key: "form", label: "Current Form" },
];

export type RatingHistoryPoint = {
  dateIso: string;
  value: number;
  previousValue?: number | null;
  change?: number | null;
  confidence?: number | null;
  coverage?: number | null;
  opponentName?: string | null;
  competitionName?: string | null;
  fixtureSlug?: string | null;
  matchHref?: string | null;
  matchRating0to10?: number | null;
  snapshotType?: string | null;
  majorMatchLabel?: string | null;
};

export type RatingHistorySummary = {
  best: number | null;
  bestIso: string | null;
  average: number | null;
  lowest: number | null;
  lowestIso: string | null;
  /** Current − average of previous N eligible snapshots. */
  trend: number | null;
  trendLabel: string;
  updatedIso: string | null;
  updatedLabel: string;
  snapshotCount: number;
  emptyState: string | null;
  emptyHelper: string | null;
};

/** Fixed meaningful Y bounds — never micro-zoom around tiny deltas. */
export const RATING_HISTORY_Y_MIN = 40;
export const RATING_HISTORY_Y_MAX = 100;

export function resolveRatingHistoryEmptyState(snapshotCount: number): {
  emptyState: string | null;
  emptyHelper: string | null;
} {
  if (snapshotCount <= 0) {
    return {
      emptyState: "RATING HISTORY BUILDING",
      emptyHelper: "No stored Rugby365 rating history yet.",
    };
  }
  if (snapshotCount === 1) {
    return {
      emptyState: "1 RATING SNAPSHOT",
      emptyHelper: "Trend available after more rating snapshots are recorded.",
    };
  }
  if (snapshotCount === 2) {
    return {
      emptyState: "LIMITED RATING HISTORY",
      emptyHelper: "Trend is provisional with only two snapshots.",
    };
  }
  return { emptyState: null, emptyHelper: null };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatUpdatedLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Trend v1: current − average of previous up-to-5 eligible snapshots.
 */
export function computeRatingHistoryTrend(
  valuesAscending: number[],
  lookback = 5,
): number | null {
  if (valuesAscending.length < 2) return null;
  const current = valuesAscending[valuesAscending.length - 1]!;
  const prior = valuesAscending.slice(0, -1).slice(-lookback);
  if (!prior.length) return null;
  const avg = prior.reduce((s, n) => s + n, 0) / prior.length;
  return Math.round(current - avg);
}

export function formatRatingTrendLabel(trend: number | null): string {
  if (trend == null || !Number.isFinite(trend)) return "—";
  if (trend === 0) return "→ 0";
  return trend > 0 ? `+${trend} ↑` : `${trend} ↓`;
}

export function buildRatingHistorySummary(
  points: RatingHistoryPoint[],
  options?: { lookback?: number },
): RatingHistorySummary {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const snapshotCount = sorted.length;
  const { emptyState, emptyHelper } = resolveRatingHistoryEmptyState(snapshotCount);

  if (snapshotCount === 0) {
    return {
      best: null,
      bestIso: null,
      average: null,
      lowest: null,
      lowestIso: null,
      trend: null,
      trendLabel: "—",
      updatedIso: null,
      updatedLabel: "—",
      snapshotCount,
      emptyState,
      emptyHelper,
    };
  }

  let best = sorted[0]!;
  let lowest = sorted[0]!;
  let sum = 0;
  for (const p of sorted) {
    sum += p.value;
    if (p.value > best.value) best = p;
    if (p.value < lowest.value) lowest = p;
  }

  const values = sorted.map((p) => p.value);
  const trend = computeRatingHistoryTrend(values, options?.lookback ?? 5);
  const latest = sorted[sorted.length - 1]!;

  return {
    best: round1(best.value),
    bestIso: best.dateIso,
    average: round1(sum / snapshotCount),
    lowest: round1(lowest.value),
    lowestIso: lowest.dateIso,
    trend,
    trendLabel: formatRatingTrendLabel(trend),
    updatedIso: latest.dateIso,
    updatedLabel: formatUpdatedLabel(latest.dateIso),
    snapshotCount,
    emptyState,
    emptyHelper,
  };
}

export function buildRatingHistoryYTicks(
  yMin = RATING_HISTORY_Y_MIN,
  yMax = RATING_HISTORY_Y_MAX,
  step = 10,
): number[] {
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);
  return ticks;
}

/** Extract metric series from overview-style rating points — display only, no recalc. */
export function extractRatingMetricSeries(
  rows: Array<{
    date: string | null;
    overall: number;
    attack: number | null;
    defence: number | null;
    kicking: number | null;
    playmaking: number | null;
    gameManagement: number | null;
    physical: number | null;
    form: number | null;
    change?: number | null;
    opponentName?: string | null;
    competitionName?: string | null;
    fixtureSlug?: string | null;
    matchRating0to10?: number | null;
    snapshotType?: string | null;
    majorMatchLabel?: string | null;
    seriesKind?: "match_performance" | "overall_ability";
  }>,
  metric: RatingHistoryMetricKey,
): RatingHistoryPoint[] {
  const out: RatingHistoryPoint[] = [];
  for (const r of rows) {
    // Prefer overall_ability for Overall Rating; skip pure match_performance rows for overall.
    if (metric === "overall" && r.seriesKind === "match_performance") continue;

    let value: number | null = null;
    switch (metric) {
      case "overall":
        value = r.overall;
        break;
      case "attack":
        value = r.attack;
        break;
      case "defence":
        value = r.defence;
        break;
      case "kicking":
        value = r.kicking;
        break;
      case "playmaking":
        value = r.playmaking;
        break;
      case "gameManagement":
        value = r.gameManagement;
        break;
      case "physical":
        value = r.physical;
        break;
      case "form":
        value = r.form;
        break;
    }
    if (value == null || !Number.isFinite(value) || !r.date) continue;
    // Guard: overall ability must be on 0–100 scale (reject obvious 0–10 leakage).
    if (metric === "overall" && value > 0 && value <= 10 && r.seriesKind !== "overall_ability") {
      continue;
    }
    out.push({
      dateIso: r.date,
      value,
      change: r.change ?? null,
      opponentName: r.opponentName ?? null,
      competitionName: r.competitionName ?? null,
      fixtureSlug: r.fixtureSlug ?? null,
      matchRating0to10: r.matchRating0to10 ?? null,
      snapshotType: r.snapshotType ?? null,
      majorMatchLabel: r.majorMatchLabel ?? null,
    });
  }
  return out.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}
