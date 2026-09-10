/**
 * Rugby Championship lineage (Tri Nations → The Rugby Championship).
 *
 * One public competition (`rugby-championship`) covers:
 *  - 1996–2011 Tri Nations — Australia, New Zealand, South Africa
 *  - 2012–2025 The Rugby Championship — those three plus Argentina
 *  - 2020 exception — South Africa withdrew (COVID-19); Argentina, Australia, New Zealand only
 *  - 2026 and 2030 — tournament not held (SANZAAR multi-week tours / Nations Championship window)
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
/** Years SANZAAR confirmed The Rugby Championship is not staged. */
export const RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS = new Set([2026, 2030]);

/**
 * Verified Championship match counts for 2012–2026.
 * Sources: Wikipedia season pages ("Matches played") and rugbydatabase.co.nz competition summaries.
 * World Cup years used a single round-robin (6). 2020 was a three-team series (6). 2026 was not held (0).
 * Total 2012–2026 = 144 matches (138 Rugby Championship-branded + 6 in the 2020 Tri Nations series).
 */
export const RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR: Record<number, number> = {
  2012: 12,
  2013: 12,
  2014: 12,
  2015: 6,
  2016: 12,
  2017: 12,
  2018: 12,
  2019: 6,
  2020: 6,
  2021: 12,
  2022: 12,
  2023: 6,
  2024: 12,
  2025: 12,
  2026: 0,
};

const TEAM_NAME_ALIASES: Record<string, string> = {
  "all blacks": "new zealand",
  "new zealand all blacks": "new zealand",
  wallabies: "australia",
  springboks: "south africa",
  "south africa springboks": "south africa",
  pumas: "argentina",
  "los pumas": "argentina",
  "ru zaf": "south africa",
  "ru rt zaf": "south africa",
  aus: "australia",
  nzl: "new zealand",
  rsa: "south africa",
  zaf: "south africa",
  arg: "argentina",
};

/** Normalise a display/import team name onto the participant-key space. */
export function rugbyChampionshipParticipantTeamKey(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return TEAM_NAME_ALIASES[key] ?? key;
}

/** True when both sides are Championship/Tri Nations nations for that year (excludes club warm-ups). */
export function isRugbyChampionshipParticipantMatch(
  homeTeam: string,
  awayTeam: string,
  year: number,
): boolean {
  const keys = rugbyChampionshipParticipantKeys(year);
  return (
    keys.has(rugbyChampionshipParticipantTeamKey(homeTeam)) &&
    keys.has(rugbyChampionshipParticipantTeamKey(awayTeam))
  );
}

export function rugbyChampionshipExpectedFixtureCount(year: number): number | null {
  if (!Number.isFinite(year)) return null;
  if (year in RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR) {
    return RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR[year]!;
  }
  if (RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS.has(year)) return 0;
  return null;
}

const CHAMPION_DISPLAY_NAMES: Record<string, string> = {
  australia: "Australia",
  "new zealand": "New Zealand",
  "south africa": "South Africa",
  argentina: "Argentina",
};

/** Map Wikipedia infobox codes such as AUS onto the canonical nation name. */
export function rugbyChampionshipChampionDisplayName(raw: string): string {
  const key = rugbyChampionshipParticipantTeamKey(raw);
  return CHAMPION_DISPLAY_NAMES[key] ?? raw.trim();
}

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
  if (RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS.has(year)) {
    return "The Rugby Championship was not held this year. SANZAAR scheduled international multi-week tours in this window instead, including New Zealand’s tour of South Africa in 2026.";
  }
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
