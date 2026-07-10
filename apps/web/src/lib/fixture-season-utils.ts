export type CompetitionSeasonRef = {
  competitionId: string;
  label: string;
  year: number;
};

export function resolveFixtureSeasonLabel(input: {
  kickoffAt: Date | string | null;
  competitionId: string | null;
  seasons: CompetitionSeasonRef[];
}): string {
  const kickoff = input.kickoffAt ? new Date(input.kickoffAt) : null;
  if (!kickoff || Number.isNaN(kickoff.getTime())) return "Unknown season";

  const calendarYear = kickoff.getFullYear();
  const competitionSeasons = input.competitionId
    ? input.seasons.filter((season) => season.competitionId === input.competitionId)
    : [];

  const exactYear = competitionSeasons.find((season) => season.year === calendarYear);
  if (exactYear) return exactYear.label;

  const labelMatch = competitionSeasons.find((season) => {
    const label = season.label.trim();
    if (label.startsWith(String(calendarYear))) return true;
    const crossYear = label.match(/^(\d{4})\D(\d{2})$/);
    if (!crossYear) return false;
    const startYear = Number.parseInt(crossYear[1]!, 10);
    const endShort = Number.parseInt(crossYear[2]!, 10);
    const endYear = Math.floor(startYear / 100) * 100 + endShort;
    if (endYear < startYear) return calendarYear === startYear || calendarYear === endYear + 100;
    return calendarYear === startYear || calendarYear === endYear;
  });
  if (labelMatch) return labelMatch.label;

  // Northern hemisphere club season typically runs Aug–Jul.
  if (kickoff.getMonth() >= 7) {
    const endShort = String((calendarYear + 1) % 100).padStart(2, "0");
    const cross = competitionSeasons.find((season) =>
      season.label.includes(`${calendarYear}`) && season.label.includes(endShort),
    );
    if (cross) return cross.label;
  } else {
    const startYear = calendarYear - 1;
    const endShort = String(calendarYear % 100).padStart(2, "0");
    const cross = competitionSeasons.find((season) =>
      season.label.includes(`${startYear}`) && season.label.includes(endShort),
    );
    if (cross) return cross.label;
  }

  return String(calendarYear);
}

export function seasonGroupKey(competitionName: string | null, seasonLabel: string): string {
  const season = seasonLabel.trim() || "Unknown season";
  const competition = competitionName?.trim();
  return competition ? `${competition} · ${season}` : season;
}

export function seasonSortKey(seasonLabel: string): number {
  const match = seasonLabel.match(/(\d{4})/);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

export function groupRowsBySeason<T>(
  rows: T[],
  getGroup: (row: T) => { competitionName: string | null; seasonLabel: string },
): Array<{ key: string; seasonLabel: string; competitionName: string | null; items: T[] }> {
  const buckets = new Map<string, { seasonLabel: string; competitionName: string | null; items: T[] }>();

  for (const row of rows) {
    const { competitionName, seasonLabel } = getGroup(row);
    const key = seasonGroupKey(competitionName, seasonLabel);
    const bucket = buckets.get(key) ?? { seasonLabel, competitionName, items: [] };
    bucket.items.push(row);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => seasonSortKey(b.seasonLabel) - seasonSortKey(a.seasonLabel));
}
