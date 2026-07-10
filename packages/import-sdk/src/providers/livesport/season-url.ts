/** LiveSport slugs that use {competition}-{start}-{end} season paths (e.g. 2024-2025). */
export const LIVESPORT_CROSS_YEAR_COMPETITION_SLUGS = new Set([
  "premiership-rugby",
  "top-14",
  "united-rugby-championship",
]);

export function parseLiveSportSeasonStartYear(seasonLabel: string): number | null {
  const match = seasonLabel.trim().match(/^(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1]!, 10);
  return Number.isFinite(year) ? year : null;
}

export function buildLiveSportSeasonPathSlug(competitionSlug: string, seasonLabel: string): string {
  const startYear = parseLiveSportSeasonStartYear(seasonLabel);
  if (startYear == null) return `${competitionSlug}-${seasonLabel}`;
  if (LIVESPORT_CROSS_YEAR_COMPETITION_SLUGS.has(competitionSlug)) {
    return `${competitionSlug}-${startYear}-${startYear + 1}`;
  }
  return `${competitionSlug}-${startYear}`;
}

export function usesLiveSportCrossYearSeasons(competitionSlug: string): boolean {
  return LIVESPORT_CROSS_YEAR_COMPETITION_SLUGS.has(competitionSlug);
}
