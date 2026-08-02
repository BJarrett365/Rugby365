/** En-dash used in Rugby365 season labels (2025–26). */
export const SEASON_LABEL_DASH = "\u2013";

export const DOMESTIC_SEASON_FIRST_YEAR = 1987;

export type SeasonStatus = "current" | "previous" | "historical";

/** Northern-hemisphere club season: Jul+ is the upcoming season; before Jul is still the prior season window. */
export function currentDomesticSeasonStartYear(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 6 ? year : year - 1;
}

export function formatSeasonRangeLabel(startYear: number): string {
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}${SEASON_LABEL_DASH}${endShort}`;
}

/** Club = cross-year label; international/tournament = calendar/tournament year. */
export function formatSeasonLabelForKind(
  year: number,
  kind: "club" | "international" | "tournament",
): string {
  return kind === "club" ? formatSeasonRangeLabel(year) : String(year);
}

export function seasonSlugForKind(
  year: number,
  kind: "club" | "international" | "tournament",
): string {
  return kind === "club" ? seasonSlugFromStartYear(year) : String(year);
}

export function parseSeasonStartYear(label: string): number | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const crossYear = trimmed.match(/^(\d{4})\s*[/\u2013-]\s*(\d{2})$/);
  if (crossYear) {
    const startYear = Number.parseInt(crossYear[1]!, 10);
    const endShort = Number.parseInt(crossYear[2]!, 10);
    const expectedEnd = (startYear + 1) % 100;
    if (endShort === expectedEnd) return startYear;
  }

  const singleYear = trimmed.match(/^(\d{4})$/);
  if (singleYear) {
    const year = Number.parseInt(singleYear[1]!, 10);
    return Number.isFinite(year) ? year : null;
  }

  const leadingYear = trimmed.match(/^(\d{4})/);
  if (leadingYear) {
    const year = Number.parseInt(leadingYear[1]!, 10);
    return Number.isFinite(year) ? year : null;
  }

  return null;
}

export function normalizeSeasonLabel(label: string): string | null {
  const startYear = parseSeasonStartYear(label);
  return startYear == null ? null : formatSeasonRangeLabel(startYear);
}

/** True when label is a cross-year slug form such as 2024–25 (not a bare numeric year). */
export function isCanonicalSeasonRangeLabel(label: string): boolean {
  return /^\d{4}\s*[/\u2013-]\s*\d{2}$/.test(label.trim());
}

/** Prefer slug seasons (2024-25) over numeric labels (2024) when ranking duplicates. */
export function canonicalSeasonPickerScore(row: {
  label: string;
  originalLabel?: string;
  slug?: string;
  isActive?: boolean;
  standingsCount?: number;
}): number {
  let score = 0;
  const originalLabel = row.originalLabel ?? row.label;
  if (row.isActive) score += 100;
  if (isCanonicalSeasonRangeLabel(originalLabel)) score += 10_000;
  if (row.slug && /^\d{4}-\d{2}$/.test(row.slug)) score += 5_000;
  score += Math.min(row.label.trim().length, 20);
  score += Math.min(row.standingsCount ?? 0, 99);
  return score;
}

export function seasonSlugFromStartYear(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function domesticSeasonCatalogEndYear(referenceDate = new Date()): number {
  return currentDomesticSeasonStartYear(referenceDate);
}

export function buildDomesticSeasonCatalog(
  firstYear = DOMESTIC_SEASON_FIRST_YEAR,
  lastYear = domesticSeasonCatalogEndYear(),
): Array<{ year: number; label: string; slug: string }> {
  const seasons = [];
  for (let year = lastYear; year >= firstYear; year -= 1) {
    seasons.push({
      year,
      label: formatSeasonRangeLabel(year),
      slug: seasonSlugFromStartYear(year),
    });
  }
  return seasons;
}

export function seasonStatusForStartYear(
  startYear: number,
  referenceDate = new Date(),
): SeasonStatus {
  const current = currentDomesticSeasonStartYear(referenceDate);
  if (startYear === current) return "current";
  if (startYear === current - 1) return "previous";
  return "historical";
}

export function formatSeasonPickerLabel(label: string, status: SeasonStatus): string {
  if (status === "previous") return `${label} — just finished`;
  return label;
}

export function seasonDateRange(startYear: number): { from: Date; to: Date } {
  return {
    from: new Date(startYear, 6, 1, 0, 0, 0, 0),
    to: new Date(startYear + 1, 5, 30, 23, 59, 59, 999),
  };
}

export function kickoffInSeason(kickoffAt: Date | string | null, startYear: number): boolean {
  if (!kickoffAt) return false;
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return false;
  const { from, to } = seasonDateRange(startYear);
  return kickoff >= from && kickoff <= to;
}

export function usesDomesticSeasonCatalog(competitionType: string | null | undefined): boolean {
  return competitionType === "domestic" || competitionType === "european";
}

/** Competitions typed domestic but labelled by calendar year (e.g. Super Rugby). */
export function usesDomesticSeasonCatalogForCompetition(
  competitionSlug: string | null | undefined,
  competitionType: string | null | undefined,
): boolean {
  if (!competitionSlug) return usesDomesticSeasonCatalog(competitionType);
  if (usesCalendarYearSeasons(competitionSlug, competitionType)) return false;
  // Historic branding eras — don't auto-fill Premiership-style 1987– shells.
  if (
    competitionSlug === "celtic-league" ||
    competitionSlug === "pro12" ||
    competitionSlug === "pro14" ||
    competitionSlug === "heineken-cup" ||
    competitionSlug === "anglo-welsh-cup" ||
    competitionSlug === "european-challenge-cup-historic" ||
    competitionSlug === "air-new-zealand-cup" ||
    competitionSlug === "itm-cup" ||
    competitionSlug === "mitre-10-cup"
  ) {
    return false;
  }
  return usesDomesticSeasonCatalog(competitionType);
}

const CALENDAR_YEAR_COMPETITION_SLUGS = new Set([
  "rugby-championship",
  "six-nations",
  "nations-championship",
  "world-rugby-nations-cup",
  "international",
  "rugby-world-cup",
  "rugby-europe-championship",
  "end-of-year-internationals",
  "autumn-nations-cup",
  "super-rugby",
  "npc",
  "pacific-nations-cup",
  "british-irish-lions",
  "world-rugby-u20-championship",
  "world-rugby-u20-trophy",
  "world-rugby-pacific-challenge",
  "summer-internationals",
  "major-league-rugby",
  "super-rugby-americas",
  "heartland-championship",
  "farah-palmer-cup",
  "sa-cup",
  "ranfurly-shield",
]);

/** Southern hemisphere internationals / tournaments use calendar year (2024), not 2024–25. */
export function usesCalendarYearSeasons(
  competitionSlug: string | null | undefined,
  competitionType: string | null | undefined,
): boolean {
  if (competitionSlug?.startsWith("currie-cup")) return true;
  if (competitionSlug?.startsWith("autumn-nations-cup")) return true;
  if (competitionSlug && CALENDAR_YEAR_COMPETITION_SLUGS.has(competitionSlug)) return true;
  return competitionType === "international" || competitionType === "world_cup";
}

export function seasonKindForCompetition(
  competitionSlug: string | null | undefined,
  competitionType: string | null | undefined,
): "club" | "international" | "tournament" {
  if (usesCalendarYearSeasons(competitionSlug, competitionType)) {
    return competitionType === "world_cup" ? "tournament" : "international";
  }
  return "club";
}

export function seasonStatusForCalendarYear(
  year: number,
  referenceDate = new Date(),
): SeasonStatus {
  const current = referenceDate.getFullYear();
  if (year === current) return "current";
  if (year === current - 1) return "previous";
  return "historical";
}
