import type { RugbyTableStandingRow } from "./table-types";

export type LeagueOptionalColumns = {
  showTfTa: boolean;
  showTbp: boolean;
  showLbp: boolean;
  /** True when either bonus breakdown column should appear. */
  showTbpLbp: boolean;
};

export function leagueTableOptionalColumns(
  rows: RugbyTableStandingRow[],
): LeagueOptionalColumns {
  const showTfTa = rows.some(
    (row) => row.triesFor != null || row.triesAgainst != null,
  );

  const showTbp = rows.some((row) => row.tryBonusPoints != null);
  const showLbp = rows.some((row) => row.losingBonusPoints != null);
  const showTbpLbp = showTbp || showLbp;

  return { showTfTa, showTbp, showLbp, showTbpLbp };
}
