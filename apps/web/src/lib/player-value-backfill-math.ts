/**
 * Pure helpers for player value history backfill coverage & month planning.
 * No DB / React — safe to unit test.
 */

export const VALUE_BACKFILL_COVERAGE_THRESHOLD = 65;

export const VALUE_BACKFILL_WEIGHTS = {
  age: 12,
  club: 14,
  competition: 12,
  international: 10,
  rating: 18,
  form: 10,
  position: 12,
  contract: 6,
  availability: 6,
  potential: 0,
} as const;

export type ValueBackfillFactorKey = keyof typeof VALUE_BACKFILL_WEIGHTS;

export const VALUE_BACKFILL_CORE_FACTORS: ValueBackfillFactorKey[] = [
  "age",
  "position",
  "club",
  "competition",
  "rating",
];

export type ValueBackfillPresence = Record<ValueBackfillFactorKey, boolean>;

export type ValueBackfillCoverageAssessment = {
  coveragePct: number;
  canCalculate: boolean;
  missingFactors: ValueBackfillFactorKey[];
  coreMissing: ValueBackfillFactorKey[];
  /** Model confidence hint 0..1 after contract/availability penalties. */
  confidence: number;
};

export type ValueBackfillRangeOption = 6 | 12 | 24 | "career";

export function yearMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Last instant of the UTC calendar month containing `d`. */
export function monthEndUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/**
 * Month-end snapshot dates from oldest to newest, exclusive of current incomplete month
 * when `includeCurrentMonth` is false. Always includes completed months only by default.
 */
export function listMonthEndSnapshots(input: {
  now?: Date;
  months: number;
  includeCurrentMonth?: boolean;
}): Date[] {
  const now = input.now ?? new Date();
  const includeCurrent = input.includeCurrentMonth === true;
  const out: Date[] = [];

  // Start at current month (or previous if excluding incomplete current).
  let cursor = includeCurrent
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  for (let i = 0; i < input.months; i++) {
    out.push(monthEndUtc(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }

  return out.reverse();
}

export function resolveBackfillMonthCount(
  range: ValueBackfillRangeOption,
  careerMonthsCap = 120,
): number {
  if (range === "career") return careerMonthsCap;
  return range;
}

export function assessValueBackfillCoverage(
  present: ValueBackfillPresence,
): ValueBackfillCoverageAssessment {
  const keys = Object.keys(VALUE_BACKFILL_WEIGHTS) as ValueBackfillFactorKey[];
  const totalWeight = keys.reduce((sum, k) => sum + VALUE_BACKFILL_WEIGHTS[k], 0);
  const coveredWeight = keys.reduce(
    (sum, k) => sum + (present[k] ? VALUE_BACKFILL_WEIGHTS[k] : 0),
    0,
  );
  const coveragePct = totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 1000) / 10 : 0;

  const missingFactors = keys.filter((k) => !present[k] && VALUE_BACKFILL_WEIGHTS[k] > 0);
  const coreMissing = VALUE_BACKFILL_CORE_FACTORS.filter((k) => !present[k]);
  const canCalculate =
    coveragePct >= VALUE_BACKFILL_COVERAGE_THRESHOLD && coreMissing.length === 0;

  let confidence = Math.min(0.88, 0.38 + coveragePct / 180);
  if (!present.contract) confidence -= 0.08;
  if (!present.availability) confidence -= 0.04;
  if (!present.potential) confidence -= 0.02;
  if (!canCalculate) confidence = Math.min(confidence, 0.5);
  confidence = Math.max(0.25, Math.min(0.88, confidence));

  return {
    coveragePct,
    canCalculate,
    missingFactors,
    coreMissing,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

/**
 * Whether a candidate BACKFILLED insert would collide with an existing LIVE row
 * in the same calendar month — must never overwrite LIVE.
 */
export function shouldSkipBackfillForExistingSnapshot(input: {
  candidateMonthKey: string;
  existing: Array<{ snapshotType: string | null; snapshotAt: Date }>;
}): { skip: boolean; reason: string | null } {
  for (const row of input.existing) {
    const key = yearMonthKey(row.snapshotAt);
    if (key !== input.candidateMonthKey) continue;
    const type = (row.snapshotType ?? "").toUpperCase();
    if (type === "LIVE") {
      return { skip: true, reason: "live_exists_same_month" };
    }
    if (type === "BACKFILLED" || type === "RECONSTRUCTED") {
      return { skip: true, reason: "backfilled_exists_same_month" };
    }
  }
  return { skip: false, reason: null };
}

/** Age from DOB as-of a historic date (UTC-safe calendar math). */
export function ageAtDate(
  birthDate: string | Date | null | undefined,
  asOf: Date,
): number | null {
  if (!birthDate) return null;
  const dob = birthDate instanceof Date ? birthDate : new Date(String(birthDate));
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function membershipCoversDate(input: {
  startYear: number | null;
  endYear: number | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isCurrent: boolean;
  asOf: Date;
}): boolean {
  const year = input.asOf.getUTCFullYear();
  if (input.startDate) {
    const start = new Date(String(input.startDate));
    if (!Number.isNaN(start.getTime()) && start > input.asOf) return false;
  }
  if (input.endDate) {
    const end = new Date(String(input.endDate));
    if (!Number.isNaN(end.getTime()) && end < input.asOf) return false;
  }
  if (input.startYear != null && year < input.startYear) return false;
  if (input.endYear != null && year > input.endYear) return false;
  if (
    input.startYear == null &&
    input.endYear == null &&
    !input.startDate &&
    !input.endDate &&
    !input.isCurrent
  ) {
    return false;
  }
  return true;
}
