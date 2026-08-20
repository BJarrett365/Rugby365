/**
 * Pure helpers for the career VALUE TIMELINE card (distinct from 24m Value Trend).
 * No DB / React — unit-testable.
 */
import {
  classifyValueTrend,
  VALUE_TREND_THRESHOLDS,
  type ValueTrendClass,
} from "./player-value-score-engine";
import type { MarketValueSnapshot, MarketValueTimelinePoint } from "./player-market-value-trend-utils";

export type ValueTimelineHistoryStatus = "GOOD" | "PARTIAL" | "THIN" | "INSUFFICIENT";

export type ValueTimelineTrendLabel = "Rising" | "Stable" | "Falling" | null;

export type ValueTimelineSummary = {
  currentGbp: number | null;
  currentIso: string | null;
  highestGbp: number | null;
  highestIso: string | null;
  lowestGbp: number | null;
  lowestIso: string | null;
  /** Annualised growth %; null when history too short. */
  avgGrowthPaPct: number | null;
  avgGrowthLabel: string;
  trend: ValueTimelineTrendLabel;
  trendClass: ValueTrendClass;
  trendChangePct: number | null;
  historyStatus: ValueTimelineHistoryStatus;
  snapshotCount: number;
  coverageStartIso: string | null;
  coverageEndIso: string | null;
  emptyState: string | null;
  emptyHelper: string | null;
};

export type CareerValueTimelineDerivation = {
  /** All valid snapshots (internal; never fabricated). */
  allPoints: MarketValueTimelinePoint[];
  /** Points reduced for career chart display. */
  displayPoints: MarketValueTimelinePoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  summary: ValueTimelineSummary;
};

const MS_PER_YEAR = 365.25 * 86_400_000;
/** Prefer ~1 point per year for long careers, keep material changes. */
const CAREER_MATERIAL_CHANGE_PCT = 8;

function pctChange(from: number, to: number): number | null {
  if (!(Number.isFinite(from) && from > 0 && Number.isFinite(to))) return null;
  return Math.round((((to - from) / from) * 100 + Number.EPSILON) * 10) / 10;
}

function validSnapshots(snapshots: MarketValueSnapshot[]): MarketValueSnapshot[] {
  return snapshots
    .filter((s) => Number.isFinite(s.marketValueGbp) && s.marketValueGbp > 0)
    .sort((a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime());
}

function toPoint(s: MarketValueSnapshot, prev: MarketValueSnapshot | null): MarketValueTimelinePoint {
  return {
    dateIso: s.snapshotAt.toISOString(),
    marketValueGbp: s.marketValueGbp,
    confidence: s.confidence,
    overallRating: s.overallRating ?? null,
    potentialRating: s.potentialRating ?? null,
    clubName: s.clubName ?? null,
    modelVersion: s.modelVersion ?? null,
    snapshotType: s.snapshotType ?? null,
    coverage: s.coverage ?? null,
    changeSincePreviousPct: prev != null ? pctChange(prev.marketValueGbp, s.marketValueGbp) : null,
  };
}

export function resolveValueTimelineHistoryStatus(snapshotCount: number): ValueTimelineHistoryStatus {
  if (snapshotCount <= 0) return "INSUFFICIENT";
  if (snapshotCount === 1) return "THIN";
  if (snapshotCount < 6) return "PARTIAL";
  return "GOOD";
}

export function resolveValueTimelineEmptyState(snapshotCount: number): {
  emptyState: string | null;
  emptyHelper: string | null;
} {
  if (snapshotCount <= 0) {
    return {
      emptyState: "VALUE HISTORY BUILDING",
      emptyHelper: "No verified Rugby365 value snapshots yet.",
    };
  }
  if (snapshotCount === 1) {
    return {
      emptyState: "1 VALUE SNAPSHOT",
      emptyHelper: "Historical trend will appear as more values are recorded.",
    };
  }
  if (snapshotCount < 6) {
    return {
      emptyState: "HISTORICAL VALUE DATA BUILDING",
      emptyHelper: "Limited history — more snapshots improve growth and trend quality.",
    };
  }
  return { emptyState: null, emptyHelper: null };
}

/**
 * Annualised growth from first → last valid snapshot.
 * Requires ≥2 snapshots and ≥ ~6 months elapsed; else null.
 */
export function computeAnnualisedGrowthPaPct(input: {
  startGbp: number;
  endGbp: number;
  startAt: Date;
  endAt: Date;
  minElapsedYears?: number;
}): number | null {
  const minYears = input.minElapsedYears ?? 0.5;
  if (!(input.startGbp > 0 && input.endGbp > 0)) return null;
  const elapsedYears = (input.endAt.getTime() - input.startAt.getTime()) / MS_PER_YEAR;
  if (!(elapsedYears >= minYears)) return null;
  const ratio = input.endGbp / input.startGbp;
  if (!(ratio > 0)) return null;
  const annualised = (Math.pow(ratio, 1 / elapsedYears) - 1) * 100;
  if (!Number.isFinite(annualised)) return null;
  return Math.round(annualised);
}

export function formatAvgGrowthLabel(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct === 0) return "0% p/a";
  return pct > 0 ? `+${pct}% p/a` : `${pct}% p/a`;
}

/**
 * Recent-window trend (prefer ~12 months of snapshots).
 * Uses central VALUE_TREND_THRESHOLDS (±5%).
 */
export function classifyValueTimelineTrend(input: {
  snapshots: MarketValueSnapshot[];
  now?: Date;
  windowDays?: number;
  minSnapshots?: number;
}): {
  trend: ValueTimelineTrendLabel;
  trendClass: ValueTrendClass;
  changePct: number | null;
} {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 365;
  const minSnapshots = input.minSnapshots ?? 2;
  const sorted = validSnapshots(input.snapshots).filter((s) => s.snapshotAt.getTime() <= now.getTime());
  if (sorted.length < minSnapshots) {
    return { trend: null, trendClass: null, changePct: null };
  }

  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  const inWindow = sorted.filter((s) => s.snapshotAt.getTime() >= windowStart.getTime());
  const series = inWindow.length >= minSnapshots ? inWindow : sorted.slice(-Math.min(sorted.length, 6));
  if (series.length < minSnapshots) {
    return { trend: null, trendClass: null, changePct: null };
  }

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const changePct = pctChange(first.marketValueGbp, last.marketValueGbp);
  const trendClass = classifyValueTrend(changePct);
  const trend: ValueTimelineTrendLabel =
    trendClass === "Rising" || trendClass === "Falling" || trendClass === "Stable"
      ? trendClass
      : null;
  return { trend, trendClass, changePct };
}

/**
 * Reduce dense snapshot lists for career chart display without discarding underlying history.
 * - ≤24 months span or ≤12 points: keep all
 * - else: keep year-end / last-of-year + material change points + first/last
 */
export function aggregateCareerDisplayPoints(
  points: MarketValueTimelinePoint[],
  options?: { now?: Date },
): MarketValueTimelinePoint[] {
  if (points.length <= 12) return points;
  const now = options?.now ?? new Date();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const spanMs = new Date(last.dateIso).getTime() - new Date(first.dateIso).getTime();
  if (spanMs <= 24 * 30.44 * 86_400_000) return points;

  void now;
  const keep = new Map<string, MarketValueTimelinePoint>();
  keep.set(first.dateIso, first);
  keep.set(last.dateIso, last);

  let lastKeptValue = first.marketValueGbp;
  const lastByYear = new Map<number, MarketValueTimelinePoint>();

  for (const p of points) {
    const year = new Date(p.dateIso).getUTCFullYear();
    lastByYear.set(year, p);

    const change =
      lastKeptValue > 0
        ? (Math.abs(p.marketValueGbp - lastKeptValue) / lastKeptValue) * 100
        : 100;
    if (change >= CAREER_MATERIAL_CHANGE_PCT) {
      keep.set(p.dateIso, p);
      lastKeptValue = p.marketValueGbp;
    }
  }

  for (const p of lastByYear.values()) {
    keep.set(p.dateIso, p);
  }

  return [...keep.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

export function buildValueTimelineSummary(
  snapshots: MarketValueSnapshot[],
  options?: { now?: Date },
): ValueTimelineSummary {
  const now = options?.now ?? new Date();
  const sorted = validSnapshots(snapshots).filter((s) => s.snapshotAt.getTime() <= now.getTime());
  const snapshotCount = sorted.length;
  const historyStatus = resolveValueTimelineHistoryStatus(snapshotCount);
  const { emptyState, emptyHelper } = resolveValueTimelineEmptyState(snapshotCount);

  if (snapshotCount === 0) {
    return {
      currentGbp: null,
      currentIso: null,
      highestGbp: null,
      highestIso: null,
      lowestGbp: null,
      lowestIso: null,
      avgGrowthPaPct: null,
      avgGrowthLabel: "—",
      trend: null,
      trendClass: null,
      trendChangePct: null,
      historyStatus,
      snapshotCount,
      coverageStartIso: null,
      coverageEndIso: null,
      emptyState,
      emptyHelper,
    };
  }

  const latest = sorted[sorted.length - 1]!;
  let highest = sorted[0]!;
  let lowest = sorted[0]!;
  for (const s of sorted) {
    if (s.marketValueGbp > highest.marketValueGbp) highest = s;
    if (s.marketValueGbp < lowest.marketValueGbp) lowest = s;
  }

  const first = sorted[0]!;
  const avgGrowthPaPct =
    snapshotCount >= 2
      ? computeAnnualisedGrowthPaPct({
          startGbp: first.marketValueGbp,
          endGbp: latest.marketValueGbp,
          startAt: first.snapshotAt,
          endAt: latest.snapshotAt,
        })
      : null;

  const { trend, trendClass, changePct } = classifyValueTimelineTrend({
    snapshots: sorted,
    now,
  });

  return {
    currentGbp: latest.marketValueGbp,
    currentIso: latest.snapshotAt.toISOString(),
    highestGbp: highest.marketValueGbp,
    highestIso: highest.snapshotAt.toISOString(),
    lowestGbp: lowest.marketValueGbp,
    lowestIso: lowest.snapshotAt.toISOString(),
    avgGrowthPaPct,
    avgGrowthLabel: formatAvgGrowthLabel(avgGrowthPaPct),
    trend: snapshotCount >= 2 ? trend : null,
    trendClass: snapshotCount >= 2 ? trendClass : null,
    trendChangePct: snapshotCount >= 2 ? changePct : null,
    historyStatus,
    snapshotCount,
    coverageStartIso: first.snapshotAt.toISOString(),
    coverageEndIso: latest.snapshotAt.toISOString(),
    emptyState,
    emptyHelper,
  };
}

export function deriveCareerValueTimeline(input: {
  snapshots: MarketValueSnapshot[];
  now?: Date;
}): CareerValueTimelineDerivation {
  const now = input.now ?? new Date();
  const sorted = validSnapshots(input.snapshots).filter((s) => s.snapshotAt.getTime() <= now.getTime());
  const allPoints = sorted.map((s, i) => toPoint(s, i > 0 ? sorted[i - 1]! : null));
  const displayPoints = aggregateCareerDisplayPoints(allPoints, { now });
  const summary = buildValueTimelineSummary(sorted, { now });

  const rangeStart =
    sorted[0]?.snapshotAt ??
    (() => {
      const d = new Date(now);
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      return d;
    })();

  return {
    allPoints,
    displayPoints,
    rangeStartIso: rangeStart.toISOString(),
    rangeEndIso: now.toISOString(),
    summary,
  };
}

export { VALUE_TREND_THRESHOLDS };
