/**
 * Pure helpers for player value trend charts and snapshot eligibility.
 * No DB / React — safe to unit test.
 */
import { classifyValueTrend, VALUE_TREND_THRESHOLDS } from "./player-potential";

export type PlayerValueSnapshotType = "LIVE" | "BACKFILLED" | "RECALCULATED";

export type MarketValueSnapshot = {
  /** Snapshot instant. */
  snapshotAt: Date;
  marketValueGbp: number;
  /** Technical confidence 0..1 from the stored value snapshot. */
  confidence: number;
  overallRating?: number | null;
  potentialRating?: number | null;
  clubName?: string | null;
  modelVersion?: string | null;
  snapshotType?: PlayerValueSnapshotType | string | null;
  coverage?: number | null;
};

export type MarketValueTimelinePoint = {
  dateIso: string;
  marketValueGbp: number;
  confidence: number;
  overallRating?: number | null;
  potentialRating?: number | null;
  clubName?: string | null;
  modelVersion?: string | null;
  snapshotType?: string | null;
  coverage?: number | null;
  /** Populated client-side or in read model when derivable. */
  changeSincePreviousPct?: number | null;
  change30dPct?: number | null;
};

export type MarketValueTimelineDerivation = {
  state: "OK" | "LIMITED" | "INSUFFICIENT";
  /** Persisted snapshots in range — never fabricated. */
  points: MarketValueTimelinePoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  pointCount: number;
  limitedHistory: boolean;
};

export type MarketValue30dMovement = {
  state: "OK" | "INSUFFICIENT";
  changePct: number | null;
  movementLabel: string | null;
  latestSnapshotIso: string | null;
  earlierSnapshotIso: string | null;
};

export type ValueTrend90dClassification = {
  trend: ReturnType<typeof classifyValueTrend>;
  changePct: number | null;
  latestSnapshotIso: string | null;
  earlierSnapshotIso: string | null;
};

export const DEFAULT_VALUE_CHANGE_THRESHOLD = 0.02;

export type SnapshotSaveDecisionInput = {
  previousValueGbp: number | null;
  nextValueGbp: number;
  /** When true, always persist (rating change, contract update, manual recalc, etc.). */
  materialEvent?: boolean;
  /** Last persisted snapshot date — used for monthly schedule gate. */
  lastSnapshotAt?: Date | null;
  now?: Date;
  changeThreshold?: number;
};

export type SnapshotSaveDecision = {
  shouldSave: boolean;
  reason: string | null;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pctChange(from: number, to: number): number | null {
  if (!(Number.isFinite(from) && from > 0 && Number.isFinite(to))) return null;
  return Math.round(clamp(((to - from) / from) * 100, -99, 999));
}

function yearMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Whether a new value snapshot should be persisted.
 * Saves when: first snapshot, >= threshold value change, material event, or new calendar month since last save.
 */
export function shouldSaveValueSnapshot(input: SnapshotSaveDecisionInput): SnapshotSaveDecision {
  const threshold = input.changeThreshold ?? DEFAULT_VALUE_CHANGE_THRESHOLD;
  const now = input.now ?? new Date();

  if (input.materialEvent) {
    return { shouldSave: true, reason: "material_event" };
  }

  if (input.previousValueGbp == null || input.lastSnapshotAt == null) {
    return { shouldSave: true, reason: "first_snapshot" };
  }

  const prev = input.previousValueGbp;
  if (prev > 0) {
    const delta = Math.abs(input.nextValueGbp - prev) / prev;
    if (delta >= threshold) {
      return { shouldSave: true, reason: "value_change_threshold" };
    }
  } else if (input.nextValueGbp > 0) {
    return { shouldSave: true, reason: "value_change_threshold" };
  }

  const last = input.lastSnapshotAt;
  if (yearMonthKey(last) !== yearMonthKey(now)) {
    return { shouldSave: true, reason: "scheduled_monthly" };
  }

  return { shouldSave: false, reason: null };
}

/** Chart empty/limited-state copy keyed by persisted snapshot count. */
export function resolveValueTrendEmptyState(pointCount: number): string | null {
  if (pointCount <= 0) return "INSUFFICIENT HISTORICAL SNAPSHOTS";
  if (pointCount === 1) return "1 VALUE SNAPSHOT";
  if (pointCount >= 2 && pointCount < 6) return "LIMITED HISTORY";
  return null;
}

/** Secondary helper copy shown under the chart for sparse histories. */
export function resolveValueTrendHelperText(pointCount: number): string | null {
  if (pointCount === 1) {
    return "Trend available after another historical/current snapshot";
  }
  if (pointCount >= 2 && pointCount < 6) {
    return "Limited history — more snapshots improve trend quality";
  }
  return null;
}

/** Smart axis labels — £m for large values, £k for smaller. */
export function formatValueTrendYAxisLabel(value: number): string {
  if (value <= 0) return "£0";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `£${m >= 10 ? Math.round(m) : m.toFixed(1)}m`;
  }
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`;
  return `£${Math.round(value)}`;
}

/** Build evenly spaced Y ticks that always include 0 and cover the data range. */
export function buildValueTrendYTicks(
  values: number[],
  tickCount = 5,
): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) {
    const ticks = Array.from({ length: tickCount }, (_, i) => i * 1_000_000);
    return { min: 0, max: 4_000_000, ticks };
  }

  const dataMax = Math.max(...values, 0);
  const paddedMax = dataMax <= 0 ? 1 : dataMax * 1.15;

  let step: number;
  if (paddedMax >= 1_000_000) {
    const raw = paddedMax / (tickCount - 1);
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    step = Math.ceil(raw / magnitude) * magnitude;
  } else if (paddedMax >= 10_000) {
    step = Math.ceil(paddedMax / (tickCount - 1) / 10_000) * 10_000;
  } else if (paddedMax >= 1_000) {
    step = Math.ceil(paddedMax / (tickCount - 1) / 1_000) * 1_000;
  } else {
    step = Math.ceil(paddedMax / (tickCount - 1));
  }

  const max = Math.max(step * (tickCount - 1), step);
  const ticks = Array.from({ length: tickCount }, (_, i) => i * (max / (tickCount - 1)));

  return { min: 0, max, ticks };
}

/**
 * Builds a LAST 24 MONTHS timeline from persisted snapshots only.
 */
export function deriveLast24MonthsMarketValueTimeline(input: {
  snapshots: MarketValueSnapshot[];
  now?: Date;
}): MarketValueTimelineDerivation {
  const now = input.now ?? new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 24);

  const inRange = input.snapshots
    .filter((s) => s.snapshotAt.getTime() >= rangeStart.getTime() && s.snapshotAt.getTime() <= now.getTime())
    .sort((a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime());

  const points: MarketValueTimelinePoint[] = inRange.map((s, index) => {
    const prev = index > 0 ? inRange[index - 1]! : null;
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
      changeSincePreviousPct:
        prev != null ? pctChange(prev.marketValueGbp, s.marketValueGbp) : null,
    };
  });

  const pointCount = points.length;
  const state: MarketValueTimelineDerivation["state"] =
    pointCount >= 3 ? "OK" : pointCount === 2 ? "LIMITED" : "INSUFFICIENT";

  return {
    state,
    points,
    rangeStartIso: rangeStart.toISOString(),
    rangeEndIso: now.toISOString(),
    pointCount,
    /** Limited-history notice for 2–5 points; removed at 6+. */
    limitedHistory: pointCount >= 2 && pointCount < 6,
  };
}

/**
 * Computes 30-day market value movement from stored snapshots.
 */
export function deriveMarketValue30dMovement(input: {
  snapshots: MarketValueSnapshot[];
  now?: Date;
  toleranceDays: number;
}): MarketValue30dMovement {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const latest = input.snapshots
    .filter((s) => s.snapshotAt.getTime() <= nowMs)
    .sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime())[0];

  if (!latest) {
    return {
      state: "INSUFFICIENT",
      changePct: null,
      movementLabel: null,
      latestSnapshotIso: null,
      earlierSnapshotIso: null,
    };
  }

  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() - 30);
  const targetMs = target.getTime();

  const earlierCandidates = input.snapshots.filter((s) => s.snapshotAt.getTime() <= nowMs);
  if (!earlierCandidates.length) {
    return {
      state: "INSUFFICIENT",
      changePct: null,
      movementLabel: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: null,
    };
  }

  const closest = earlierCandidates
    .map((s) => ({
      snap: s,
      diffDays: Math.abs(s.snapshotAt.getTime() - targetMs) / 86_400_000,
    }))
    .sort((a, b) => a.diffDays - b.diffDays)[0]!;

  if (!closest || closest.diffDays > input.toleranceDays) {
    return {
      state: "INSUFFICIENT",
      changePct: null,
      movementLabel: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: null,
    };
  }

  const earlier = closest.snap;
  if (earlier.snapshotAt.getTime() >= latest.snapshotAt.getTime()) {
    return {
      state: "INSUFFICIENT",
      changePct: null,
      movementLabel: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: earlier.snapshotAt.toISOString(),
    };
  }

  const changePct = pctChange(earlier.marketValueGbp, latest.marketValueGbp);
  if (changePct == null) {
    return {
      state: "INSUFFICIENT",
      changePct: null,
      movementLabel: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: earlier.snapshotAt.toISOString(),
    };
  }

  const movementLabel =
    changePct === 0 ? "→ Stable" : changePct > 0 ? `▲ +${Math.abs(changePct)}%` : `▼ −${Math.abs(changePct)}%`;

  return {
    state: "OK",
    changePct,
    movementLabel,
    latestSnapshotIso: latest.snapshotAt.toISOString(),
    earlierSnapshotIso: earlier.snapshotAt.toISOString(),
  };
}

/** 30-day change relative to an arbitrary anchor date (for chart tooltips). */
export function deriveMarketValue30dMovementAtDate(input: {
  snapshots: MarketValueSnapshot[];
  anchor: Date;
  toleranceDays: number;
}): number | null {
  const anchorMs = input.anchor.getTime();
  const anchorSnap = input.snapshots
    .filter((s) => s.snapshotAt.getTime() <= anchorMs)
    .sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime())[0];
  if (!anchorSnap) return null;

  const target = new Date(input.anchor);
  target.setUTCDate(target.getUTCDate() - 30);
  const targetMs = target.getTime();

  const closest = input.snapshots
    .map((s) => ({
      snap: s,
      diffDays: Math.abs(s.snapshotAt.getTime() - targetMs) / 86_400_000,
    }))
    .sort((a, b) => a.diffDays - b.diffDays)[0];

  if (!closest || closest.diffDays > input.toleranceDays) return null;
  const earlier = closest.snap;
  if (earlier.snapshotAt.getTime() >= anchorSnap.snapshotAt.getTime()) return null;
  return pctChange(earlier.marketValueGbp, anchorSnap.marketValueGbp);
}

/**
 * 90-day rolling trend classification from stored snapshots.
 */
export function classifyValueTrend90d(input: {
  snapshots: MarketValueSnapshot[];
  now?: Date;
  toleranceDays?: number;
}): ValueTrend90dClassification {
  const now = input.now ?? new Date();
  const toleranceDays = input.toleranceDays ?? 15;
  const nowMs = now.getTime();

  const latest = input.snapshots
    .filter((s) => s.snapshotAt.getTime() <= nowMs)
    .sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime())[0];

  if (!latest) {
    return { trend: null, changePct: null, latestSnapshotIso: null, earlierSnapshotIso: null };
  }

  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() - 90);
  const targetMs = target.getTime();

  const closest = input.snapshots
    .map((s) => ({
      snap: s,
      diffDays: Math.abs(s.snapshotAt.getTime() - targetMs) / 86_400_000,
    }))
    .sort((a, b) => a.diffDays - b.diffDays)[0];

  if (!closest || closest.diffDays > toleranceDays) {
    return {
      trend: null,
      changePct: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: null,
    };
  }

  const earlier = closest.snap;
  if (earlier.snapshotAt.getTime() >= latest.snapshotAt.getTime()) {
    return {
      trend: null,
      changePct: null,
      latestSnapshotIso: latest.snapshotAt.toISOString(),
      earlierSnapshotIso: earlier.snapshotAt.toISOString(),
    };
  }

  const changePct = pctChange(earlier.marketValueGbp, latest.marketValueGbp);
  return {
    trend: classifyValueTrend(changePct),
    changePct,
    latestSnapshotIso: latest.snapshotAt.toISOString(),
    earlierSnapshotIso: earlier.snapshotAt.toISOString(),
  };
}

export { VALUE_TREND_THRESHOLDS };
