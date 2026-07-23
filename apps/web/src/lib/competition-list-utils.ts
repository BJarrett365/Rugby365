/** Default competition for Table Lab and similar pickers. */
export const DEFAULT_TABLE_COMPETITION_SLUG = "premiership";

/** Single display label for international fixtures (drops redundant "Matches" suffix). */
export function canonicalCompetitionDisplayName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === "international matches" ||
    lower === "internationals" ||
    lower === "international match"
  ) {
    return "International";
  }
  return trimmed;
}

type CompetitionPickerRow = {
  id: string;
  name: string;
  slug: string;
  activeSeason?: { id: string; isActive?: boolean } | null;
};

export function competitionPickerScore(row: CompetitionPickerRow): number {
  let score = 0;
  if (row.activeSeason?.isActive) score += 100;
  if (row.activeSeason) score += 50;
  // Prefer canonical slugs over auto-suffixed imports (e.g. international-matches-5).
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) && !/-[a-f0-9]{6,}$/i.test(row.slug) && !/-\d+$/.test(row.slug)) {
    score += 25;
  }
  return score;
}

/** Collapse duplicate imports that share the same display name. */
export function dedupeCompetitionsByName<T extends CompetitionPickerRow>(rows: T[]): T[] {
  const byName = new Map<string, T>();
  for (const row of rows) {
    const key = canonicalCompetitionDisplayName(row.name).toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, row);
      continue;
    }
    const existingScore = competitionPickerScore(existing);
    const rowScore = competitionPickerScore(row);
    if (rowScore > existingScore || (rowScore === existingScore && row.slug.localeCompare(existing.slug) < 0)) {
      byName.set(key, row);
    }
  }
  return Array.from(byName.values())
    .map((row) => ({ ...row, name: canonicalCompetitionDisplayName(row.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Drop empty generic International when a richer international row exists. */
export function filterRedundantInternationalCompetitions<T extends CompetitionPickerRow>(rows: T[]): T[] {
  const canonical = dedupeCompetitionsByName(rows);
  const hasInternational = canonical.some(
    (row) => canonicalCompetitionDisplayName(row.name).toLowerCase() === "international" && row.activeSeason,
  );
  if (!hasInternational) return canonical;

  return canonical.filter((row) => {
    if (row.name.trim().toLowerCase() !== "international") return true;
    return Boolean(row.activeSeason);
  });
}

export function competitionsForPicker<T extends CompetitionPickerRow>(rows: T[]): T[] {
  return filterRedundantInternationalCompetitions(dedupeCompetitionsByName(rows));
}

export function defaultCompetitionId<T extends CompetitionPickerRow>(
  rows: T[],
  preferred?: { competitionId?: string | null; slug?: string | null },
): string {
  if (preferred?.competitionId && rows.some((row) => row.id === preferred.competitionId)) {
    return preferred.competitionId;
  }
  const bySlug = preferred?.slug
    ? rows.find((row) => row.slug === preferred.slug)
    : rows.find((row) => row.slug === DEFAULT_TABLE_COMPETITION_SLUG);
  if (bySlug) return bySlug.id;
  return rows.find((row) => row.activeSeason)?.id ?? rows[0]?.id ?? "";
}
