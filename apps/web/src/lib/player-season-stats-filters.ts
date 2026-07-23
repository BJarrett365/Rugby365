/** Client-safe season/competition filter helpers (no DB imports). */

import { canonicalCompetitionDisplayName } from "./competition-list-utils";

export type SeasonStatsFilterOptions = {
  seasons: Array<{ id: string; label: string; aliasIds: string[] }>;
  competitions: Array<{ id: string; name: string; aliasIds: string[] }>;
};

export function buildSeasonStatsFilterOptions(
  rows: Array<{
    seasonId: string;
    seasonLabel: string;
    competitionId: string;
    competitionName: string;
  }>,
): SeasonStatsFilterOptions {
  const competitions = new Map<string, { id: string; name: string; aliasIds: Set<string> }>();
  const seasons = new Map<
    string,
    { id: string; label: string; competitionName: string; aliasIds: Set<string> }
  >();

  for (const row of rows) {
    const canonName = canonicalCompetitionDisplayName(row.competitionName);
    const compKey = canonName.toLowerCase();
    const existingComp = competitions.get(compKey);
    if (!existingComp) {
      competitions.set(compKey, {
        id: row.competitionId,
        name: canonName,
        aliasIds: new Set([row.competitionId]),
      });
    } else {
      existingComp.aliasIds.add(row.competitionId);
    }

    const seasonKey = `${row.seasonLabel.toLowerCase()}|${compKey}`;
    const existingSeason = seasons.get(seasonKey);
    if (!existingSeason) {
      seasons.set(seasonKey, {
        id: row.seasonId,
        label: row.seasonLabel,
        competitionName: canonName,
        aliasIds: new Set([row.seasonId]),
      });
    } else {
      existingSeason.aliasIds.add(row.seasonId);
    }
  }

  const labelCounts = new Map<string, number>();
  for (const meta of seasons.values()) {
    labelCounts.set(meta.label, (labelCounts.get(meta.label) ?? 0) + 1);
  }

  return {
    seasons: [...seasons.values()]
      .map((meta) => {
        const needsContext = (labelCounts.get(meta.label) ?? 0) > 1;
        return {
          id: meta.id,
          label: needsContext ? `${meta.label} · ${meta.competitionName}` : meta.label,
          aliasIds: [...meta.aliasIds],
        };
      })
      .sort((a, b) => b.label.localeCompare(a.label)),
    competitions: [...competitions.values()]
      .map((c) => ({ id: c.id, name: c.name, aliasIds: [...c.aliasIds] }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function competitionFilterMatches(
  rowCompetitionId: string,
  selectedCompetitionId: string | null | undefined,
  options: SeasonStatsFilterOptions["competitions"],
): boolean {
  if (!selectedCompetitionId) return true;
  if (rowCompetitionId === selectedCompetitionId) return true;
  const selected = options.find((c) => c.id === selectedCompetitionId);
  return Boolean(selected?.aliasIds.includes(rowCompetitionId));
}

export function seasonFilterMatches(
  rowSeasonId: string,
  selectedSeasonId: string | null | undefined,
  options: SeasonStatsFilterOptions["seasons"],
): boolean {
  if (!selectedSeasonId) return true;
  if (rowSeasonId === selectedSeasonId) return true;
  const selected = options.find((s) => s.id === selectedSeasonId);
  return Boolean(selected?.aliasIds.includes(rowSeasonId));
}
