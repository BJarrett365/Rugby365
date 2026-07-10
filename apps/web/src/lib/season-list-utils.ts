import {
  buildDomesticSeasonCatalog,
  canonicalSeasonPickerScore,
  currentDomesticSeasonStartYear,
  formatSeasonPickerLabel,
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
  seasonStatusForStartYear,
  type SeasonStatus,
} from "./season-label-utils";

export type SeasonPickerRow = {
  id: string;
  label: string;
  year: number;
  competitionId?: string;
  isActive?: boolean;
  status?: SeasonStatus;
  displayLabel?: string;
  /** Raw label before canonical normalization (for duplicate resolution). */
  originalLabel?: string;
};

function seasonPickerScore(row: SeasonPickerRow, originalLabel: string): number {
  return canonicalSeasonPickerScore({ ...row, originalLabel });
}

/** Collapse duplicate season imports that share the same competition + start year. */
export function dedupeSeasonsByYear<T extends SeasonPickerRow>(rows: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const row of rows) {
    const startYear = row.year ?? parseSeasonStartYear(row.label);
    if (startYear == null) continue;
    const key = `${row.competitionId ?? ""}:${startYear}`;
    const existing = byKey.get(key);
    const normalized = {
      ...row,
      year: startYear,
      label: normalizeSeasonLabel(row.label) ?? formatSeasonRangeLabel(startYear),
      originalLabel: row.originalLabel ?? row.label,
    };

    if (!existing) {
      byKey.set(key, normalized);
      continue;
    }

    const existingScore = seasonPickerScore(existing, existing.originalLabel ?? existing.label);
    const rowScore = seasonPickerScore(normalized, row.label);
    if (rowScore > existingScore || (rowScore === existingScore && normalized.label.localeCompare(existing.label) < 0)) {
      byKey.set(key, normalized);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.year - a.year || a.label.localeCompare(b.label));
}

export function decorateSeasonPickerRows<T extends SeasonPickerRow>(
  rows: T[],
  referenceDate = new Date(),
): Array<T & { status: SeasonStatus; displayLabel: string }> {
  return rows.map((row) => {
    const status = seasonStatusForStartYear(row.year, referenceDate);
    return {
      ...row,
      label: normalizeSeasonLabel(row.label) ?? formatSeasonRangeLabel(row.year),
      status,
      displayLabel: formatSeasonPickerLabel(
        normalizeSeasonLabel(row.label) ?? formatSeasonRangeLabel(row.year),
        status,
      ),
    };
  });
}

/**
 * Default season for admin competition/team pickers.
 * Prefers the calendar-current year, then previous year, then isActive, then most recent.
 */
export function pickDefaultSeasonForPicker<T extends SeasonPickerRow>(
  rows: T[],
  referenceDate = new Date(),
): T | null {
  if (!rows.length) return null;

  const decorated =
    rows[0]?.status != null
      ? rows
      : decorateSeasonPickerRows(rows, referenceDate);
  const sorted = [...decorated].sort((a, b) => b.year - a.year);
  const currentYear = currentDomesticSeasonStartYear(referenceDate);

  return (
    sorted.find((row) => row.year === currentYear) ??
    sorted.find((row) => row.status === "current") ??
    sorted.find((row) => row.isActive) ??
    sorted.find((row) => row.year === currentYear - 1) ??
    sorted.find((row) => row.status === "previous") ??
    sorted[0] ??
    null
  );
}

export function buildVirtualDomesticSeasonRows(
  competitionId: string,
  existingRows: SeasonPickerRow[],
  referenceDate = new Date(),
): SeasonPickerRow[] {
  const existingByYear = new Map(existingRows.map((row) => [row.year, row]));
  const currentYear = currentDomesticSeasonStartYear(referenceDate);

  return buildDomesticSeasonCatalog(undefined, currentYear).map((season) => {
    const existing = existingByYear.get(season.year);
    return {
      id: existing?.id ?? `catalog:${competitionId}:${season.year}`,
      competitionId,
      year: season.year,
      label: season.label,
      isActive: season.year === currentYear,
    };
  });
}
