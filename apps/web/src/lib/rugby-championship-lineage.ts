/**
 * Rugby Championship lineage helpers (Tri Nations → Rugby Championship).
 * The tournament began as Tri Nations in 1996 and was renamed in 2012 when Argentina joined.
 */
export type RugbyChampionshipEra = "pre-tri-nations" | "tri-nations" | "rugby-championship";

/** First Tri Nations season (SANZAAR). */
export const TRI_NATIONS_FIRST_YEAR = 1996;
/** First Rugby Championship season (Argentina join). */
export const RUGBY_CHAMPIONSHIP_FIRST_YEAR = 2012;

export function rugbyChampionshipEraForYear(year: number): RugbyChampionshipEra {
  if (year < TRI_NATIONS_FIRST_YEAR) return "pre-tri-nations";
  if (year < RUGBY_CHAMPIONSHIP_FIRST_YEAR) return "tri-nations";
  return "rugby-championship";
}

export function rugbyChampionshipEraLabel(era: RugbyChampionshipEra): string {
  switch (era) {
    case "pre-tri-nations":
      return "Pre–Tri Nations";
    case "tri-nations":
      return "Tri Nations";
    case "rugby-championship":
      return "Rugby Championship";
  }
}

/** Long-form season label for picker display (2012–2013), matching common RC naming. */
export function formatRugbyChampionshipSeasonDisplayLabel(startYear: number): string {
  return `${startYear}\u2013${startYear + 1}`;
}

/** Season picker suffix so Tri Nations years are not mislabelled as Rugby Championship. */
export function rugbyChampionshipSeasonDisplaySuffix(year: number): string {
  const era = rugbyChampionshipEraForYear(year);
  if (era === "rugby-championship") return "";
  return ` · ${rugbyChampionshipEraLabel(era)}`;
}

export function rugbyChampionshipPickerDisplayLabel(
  year: number,
  statusSuffix?: string | null,
): string {
  const base = formatRugbyChampionshipSeasonDisplayLabel(year);
  const withStatus = statusSuffix?.trim() ? `${base}${statusSuffix}` : base;
  return `${withStatus}${rugbyChampionshipSeasonDisplaySuffix(year)}`;
}

export function isRugbyChampionshipLineageSlug(slug: string | null | undefined): boolean {
  const key = (slug ?? "").trim().toLowerCase();
  return key === "rugby-championship" || key === "tri-nations" || key === "the-rugby-championship";
}

/** Picker should expose Tri Nations + Rugby Championship years (not empty pre-1996 catalog noise). */
export function isRugbyChampionshipPickerYear(year: number): boolean {
  return year >= TRI_NATIONS_FIRST_YEAR;
}
