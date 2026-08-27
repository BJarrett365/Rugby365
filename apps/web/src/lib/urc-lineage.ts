/**
 * United Rugby Championship lineage branding + historic table formats.
 * Canonical competition slug stays `united-rugby-championship`; historic seasons
 * display under the tournament name used at the time.
 *
 * Table formats (season start year):
 *  - 2001–02: Pool A / Pool B
 *  - 2002–03 → 2016–17: single league table
 *  - 2017–18 → 2020–21: Conference A / Conference B (Guinness PRO14)
 *  - 2021–22+: United Rugby Championship (single regular-season table)
 *
 * Sources: rugbyfootballhistory.com/pro12.html + official rename timeline.
 * Note: Guinness PRO14 began 2017–18 (first season with South African sides);
 * Guinness PRO12 covers 2014–15 through 2016–17.
 */
export type UrcEraId =
  | "celtic-league"
  | "magners-league"
  | "rabodirect-pro12"
  | "guinness-pro12"
  | "guinness-pro14"
  | "united-rugby-championship";

/** Celtic League 2001–02 only — two pool tables. */
export const URC_POOL_TABLE_YEARS = new Set([2001]);

/** Guinness PRO14 conference phase (2017–18 through 2020–21). */
export const URC_CONFERENCE_TABLE_YEARS = new Set([2017, 2018, 2019, 2020]);

export function isUrcLineageSlug(slug: string | null | undefined): boolean {
  const key = (slug ?? "").trim().toLowerCase();
  return (
    key === "united-rugby-championship" ||
    key === "celtic-league" ||
    key === "pro12" ||
    key === "pro14"
  );
}

export function urcEraForYear(year: number): UrcEraId {
  if (year <= 2005) return "celtic-league";
  if (year <= 2010) return "magners-league";
  if (year <= 2013) return "rabodirect-pro12";
  if (year <= 2016) return "guinness-pro12";
  if (year <= 2020) return "guinness-pro14";
  return "united-rugby-championship";
}

export function urcEraLabel(era: UrcEraId): string {
  switch (era) {
    case "celtic-league":
      return "Celtic League";
    case "magners-league":
      return "Magners League";
    case "rabodirect-pro12":
      return "RaboDirect PRO12";
    case "guinness-pro12":
      return "Guinness PRO12";
    case "guinness-pro14":
      return "Guinness PRO14";
    case "united-rugby-championship":
      return "United Rugby Championship";
  }
}

/** Soft title for hub/table chrome when a historic season is selected. */
export function urcCompetitionDisplayNameForYear(year: number): string {
  return urcEraLabel(urcEraForYear(year));
}

export function urcSeasonUsesPoolTables(year: number): boolean {
  return URC_POOL_TABLE_YEARS.has(year);
}

export function urcSeasonUsesConferenceTables(year: number): boolean {
  return URC_CONFERENCE_TABLE_YEARS.has(year);
}

/** True when the season should show split tables (pools or conferences). */
export function urcSeasonUsesSplitTables(year: number): boolean {
  return urcSeasonUsesPoolTables(year) || urcSeasonUsesConferenceTables(year);
}

export type UrcSplitTableKind = "pool" | "conference";

export function urcSplitTableKindForYear(year: number): UrcSplitTableKind | null {
  if (urcSeasonUsesPoolTables(year)) return "pool";
  if (urcSeasonUsesConferenceTables(year)) return "conference";
  return null;
}

export function urcStandingViewForSplit(
  kind: UrcSplitTableKind,
  key: string,
): string {
  const normalized = key.trim().toLowerCase();
  return kind === "conference" ? `conference_${normalized}` : `pool_${normalized}`;
}

/** @deprecated Prefer urcStandingViewForSplit("pool", pool). */
export function urcStandingViewForPool(pool: string): string {
  return urcStandingViewForSplit("pool", pool);
}

export function urcSplitGroupLabel(kind: UrcSplitTableKind, key: string): string {
  const letter = key.trim().toUpperCase();
  return kind === "conference" ? `Conference ${letter}` : `Pool ${letter}`;
}

/** Season picker label: `2002–03 · Celtic League`, `2021–22 · United Rugby Championship`. */
export function urcSeasonPickerDisplayLabel(
  year: number,
  baseLabel: string,
  statusSuffix?: string | null,
): string {
  const branded = `${baseLabel} · ${urcEraLabel(urcEraForYear(year))}`;
  return statusSuffix?.trim() ? `${branded}${statusSuffix}` : branded;
}

export function applyUrcLineageSeasonLabels<
  T extends { year: number; label: string; displayLabel?: string },
>(slug: string | null | undefined, seasons: T[]): Array<T & { era: string | null; eraGroup: string | null; displayLabel: string }> {
  if (!isUrcLineageSlug(slug)) {
    return seasons.map((season) => ({
      ...season,
      era: null,
      eraGroup: null,
      displayLabel: season.displayLabel ?? season.label,
    }));
  }

  return seasons.map((season) => {
    const era = urcEraForYear(season.year);
    const eraLabel = urcEraLabel(era);
    const statusSuffix =
      typeof season.displayLabel === "string" && season.displayLabel.includes(" — ")
        ? season.displayLabel.slice(season.displayLabel.indexOf(" — "))
        : "";
    const base =
      typeof season.displayLabel === "string" && season.displayLabel.includes(" — ")
        ? season.displayLabel.slice(0, season.displayLabel.indexOf(" — "))
        : (season.displayLabel ?? season.label);
    return {
      ...season,
      era: eraLabel,
      eraGroup: eraLabel,
      displayLabel: urcSeasonPickerDisplayLabel(season.year, base, statusSuffix),
    };
  });
}
