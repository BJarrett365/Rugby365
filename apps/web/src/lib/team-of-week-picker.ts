export type TotwPickerRound = {
  roundKey: string;
  roundName: string;
  roundNumber: number | null;
};

export type TotwPickerSeason = {
  year: number;
  label: string;
  rounds: TotwPickerRound[];
};

const STAGE_ORDER: Record<string, number> = {
  "round-of-16": 90,
  "quarter-finals": 100,
  "semi-finals": 110,
  "bronze-final": 120,
  final: 130,
  "team-of-the-tournament": 200,
};

export function sortTotwRounds(rounds: TotwPickerRound[]): TotwPickerRound[] {
  return [...rounds].sort((a, b) => {
    const aKey =
      a.roundNumber != null ? a.roundNumber : (STAGE_ORDER[a.roundKey] ?? 50);
    const bKey =
      b.roundNumber != null ? b.roundNumber : (STAGE_ORDER[b.roundKey] ?? 50);
    return aKey - bKey || a.roundName.localeCompare(b.roundName);
  });
}

/** Prefer Round 1 when switching seasons; otherwise the first sorted round. */
export function defaultRoundForSeason(
  season: TotwPickerSeason | undefined,
): TotwPickerRound | null {
  if (!season?.rounds.length) return null;
  const sorted = sortTotwRounds(season.rounds);
  return sorted.find((r) => r.roundNumber === 1) ?? sorted[0] ?? null;
}

type PublishedEditionRow = {
  roundKey: string;
  roundName: string;
  roundNumber: number | null;
  seasonLabel: string | null;
  seasonYear: number | null;
};

/** Group published TotW editions into season → rounds for the public picker. */
export function buildTotwPickerSeasons(
  editions: PublishedEditionRow[],
): TotwPickerSeason[] {
  const byYear = new Map<number, TotwPickerSeason>();

  for (const ed of editions) {
    const year = ed.seasonYear;
    if (year == null || !Number.isFinite(year)) continue;
    let season = byYear.get(year);
    if (!season) {
      season = {
        year,
        label: ed.seasonLabel?.trim() || String(year),
        rounds: [],
      };
      byYear.set(year, season);
    }
    if (!season.rounds.some((r) => r.roundKey === ed.roundKey)) {
      const round: TotwPickerRound = {
        roundKey: ed.roundKey,
        roundName: ed.roundName,
        roundNumber: ed.roundNumber,
      };
      season.rounds.push(round);
    }
  }

  return [...byYear.values()]
    .map((s) => ({ ...s, rounds: sortTotwRounds(s.rounds) }))
    .sort((a, b) => b.year - a.year);
}
