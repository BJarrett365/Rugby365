/**
 * Rugby Championship lineage (Tri Nations → The Rugby Championship).
 *
 * One public competition (`rugby-championship`) covers:
 *  - 1996–2011 Tri Nations — Australia, New Zealand, South Africa
 *  - 2012–2025 The Rugby Championship — those three plus Argentina
 *  - 2020 exception — South Africa withdrew (COVID-19); Argentina, Australia, New Zealand only
 */
export type RugbyChampionshipEra = "pre-tri-nations" | "tri-nations" | "rugby-championship";

export const RUGBY_CHAMPIONSHIP_CANONICAL_SLUG = "rugby-championship";
export const RUGBY_CHAMPIONSHIP_SLUG_ALIASES = ["tri-nations", "the-rugby-championship"] as const;

/** First Tri Nations season (SANZAR). */
export const TRI_NATIONS_FIRST_YEAR = 1996;
/** First Rugby Championship season (Argentina join). */
export const RUGBY_CHAMPIONSHIP_FIRST_YEAR = 2012;
/** COVID year: three-team series, South Africa withdrew. */
export const RUGBY_CHAMPIONSHIP_COVID_YEAR = 2020;

const TRI_NATIONS_TEAM_KEYS = new Set(["australia", "new zealand", "south africa"]);
const RUGBY_CHAMPIONSHIP_TEAM_KEYS = new Set(["argentina", "australia", "new zealand", "south africa"]);
const RUGBY_CHAMPIONSHIP_2020_TEAM_KEYS = new Set(["argentina", "australia", "new zealand"]);

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
      return "The Rugby Championship";
  }
}

/** Soft title for hub/table chrome when a historic season is selected. */
export function rugbyChampionshipCompetitionDisplayNameForYear(year: number): string {
  return rugbyChampionshipEraLabel(rugbyChampionshipEraForYear(year));
}

/** Calendar year — this is a southern-hemisphere international series, not a club 2012–13 season. */
export function formatRugbyChampionshipSeasonDisplayLabel(year: number): string {
  return String(year);
}

export function rugbyChampionshipSeasonDisplaySuffix(year: number): string {
  return ` · ${rugbyChampionshipEraLabel(rugbyChampionshipEraForYear(year))}`;
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
  return (
    key === RUGBY_CHAMPIONSHIP_CANONICAL_SLUG ||
    (RUGBY_CHAMPIONSHIP_SLUG_ALIASES as readonly string[]).includes(key)
  );
}

/** Map public aliases onto the canonical slug; otherwise return the input. */
export function canonicalRugbyChampionshipSlug(slug: string | null | undefined): string {
  const key = (slug ?? "").trim().toLowerCase();
  if (isRugbyChampionshipLineageSlug(key)) return RUGBY_CHAMPIONSHIP_CANONICAL_SLUG;
  return key;
}

/** Picker should expose Tri Nations + Rugby Championship years (not empty pre-1996 catalog noise). */
export function isRugbyChampionshipPickerYear(year: number): boolean {
  return year >= TRI_NATIONS_FIRST_YEAR;
}

export function rugbyChampionshipParticipantKeys(year?: number | null): Set<string> {
  if (year == null || !Number.isFinite(year)) return RUGBY_CHAMPIONSHIP_TEAM_KEYS;
  if (year === RUGBY_CHAMPIONSHIP_COVID_YEAR) return RUGBY_CHAMPIONSHIP_2020_TEAM_KEYS;
  if (year >= TRI_NATIONS_FIRST_YEAR && year < RUGBY_CHAMPIONSHIP_FIRST_YEAR) {
    return TRI_NATIONS_TEAM_KEYS;
  }
  return RUGBY_CHAMPIONSHIP_TEAM_KEYS;
}

export function rugbyChampionshipTableNote(year: number): string | null {
  if (year === RUGBY_CHAMPIONSHIP_COVID_YEAR) {
    return "South Africa withdrew from the 2020 tournament because of COVID-19. Argentina, Australia and New Zealand contested a three-team series.";
  }
  if (year >= TRI_NATIONS_FIRST_YEAR && year < RUGBY_CHAMPIONSHIP_FIRST_YEAR) {
    return "Tri Nations era (Australia, New Zealand, South Africa). Argentina joined in 2012 when the tournament became The Rugby Championship.";
  }
  return null;
}

export function applyRugbyChampionshipLineageSeasonLabels<
  T extends { year: number; label: string; displayLabel?: string },
>(
  slug: string | null | undefined,
  seasons: T[],
): Array<T & { era: string | null; eraGroup: string | null; displayLabel: string }> {
  if (!isRugbyChampionshipLineageSlug(slug)) {
    return seasons.map((season) => ({
      ...season,
      era: "era" in season ? ((season as { era?: string | null }).era ?? null) : null,
      eraGroup:
        "eraGroup" in season ? ((season as { eraGroup?: string | null }).eraGroup ?? null) : null,
      displayLabel: season.displayLabel ?? season.label,
    }));
  }

  return seasons
    .filter((season) => isRugbyChampionshipPickerYear(season.year))
    .map((season) => {
      const era = rugbyChampionshipEraForYear(season.year);
      const eraLabel = rugbyChampionshipEraLabel(era);
      const statusSuffix =
        typeof season.displayLabel === "string" && season.displayLabel.includes(" — ")
          ? season.displayLabel.slice(season.displayLabel.indexOf(" — "))
          : "";
      return {
        ...season,
        era: eraLabel,
        eraGroup: eraLabel,
        displayLabel: rugbyChampionshipPickerDisplayLabel(season.year, statusSuffix),
      };
    });
}
