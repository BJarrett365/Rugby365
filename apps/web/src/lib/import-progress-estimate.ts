export type ImportDurationInput = {
  seasonCount?: number;
  resultCount?: number;
  fixtureCount?: number;
  importAllSeasons?: boolean;
  importMatchDetails?: boolean;
  mode?: "table" | "full";
};

/** Rough seconds for UI countdown on long imports (conservative). */
export function estimateImportDurationSeconds(input: ImportDurationInput): number {
  const seasons = input.importAllSeasons ? Math.max(input.seasonCount ?? 5, 1) : 1;
  const results = input.resultCount ?? 0;
  const fixtures = input.fixtureCount ?? 0;
  const matches = results + fixtures;
  const tableOnly = input.mode === "table" || !input.importMatchDetails;

  if (tableOnly) {
    return Math.max(20, seasons * 18 + 10);
  }

  const perMatch = input.importMatchDetails ? 0.35 : 0.05;
  const perSeasonBase = 12;
  return Math.max(30, Math.round(seasons * perSeasonBase + matches * perMatch));
}

export function formatImportDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
