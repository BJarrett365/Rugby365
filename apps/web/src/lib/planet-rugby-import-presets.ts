/** Planet Rugby tournament URLs for one-click CMS import. */
export const PLANET_RUGBY_LEAGUE_PRESETS = [
  {
    id: "premiership-results",
    name: "Premiership",
    slug: "premiership",
    url: "https://www.planetrugby.com/tournament/premiership/results",
    type: "domestic" as const,
  },
  {
    id: "top-14-results",
    name: "Top 14",
    slug: "top-14",
    url: "https://www.planetrugby.com/tournament/top-14/results",
    type: "domestic" as const,
  },
  {
    id: "urc-results",
    name: "United Rugby Championship",
    slug: "united-rugby-championship",
    url: "https://www.planetrugby.com/tournament/united-rugby-championship/results",
    type: "domestic" as const,
  },
  {
    id: "urc-hub",
    name: "URC (hub)",
    slug: "united-rugby-championship",
    url: "https://www.planetrugby.com/tournament/united-rugby-championship",
    type: "domestic" as const,
  },
  {
    id: "super-rugby-results",
    name: "Super Rugby",
    slug: "super-rugby",
    url: "https://www.planetrugby.com/tournament/super-rugby/results",
    type: "domestic" as const,
  },
  {
    id: "rugby-championship-results",
    name: "Championship",
    slug: "rugby-championship",
    url: "https://www.planetrugby.com/tournament/rugby-championship/results",
    type: "domestic" as const,
  },
  {
    id: "champions-cup-results",
    name: "Champions Cup",
    slug: "rugby-champions-cup",
    url: "https://www.planetrugby.com/tournament/rugby-champions-cup/results",
    type: "european" as const,
  },
  {
    id: "challenge-cup-results",
    name: "Challenge Cup",
    slug: "challenge-cup",
    url: "https://www.planetrugby.com/tournament/challenge-cup/results",
    type: "european" as const,
  },
  {
    id: "six-nations-table",
    name: "Six Nations",
    slug: "six-nations",
    url: "https://www.planetrugby.com/tournament/six-nations/table",
    type: "international" as const,
  },
  {
    id: "nations-championship",
    name: "Nations Championship",
    slug: "nations-championship",
    url: "https://www.planetrugby.com/tournament/international/fixtures",
    type: "international" as const,
  },
  {
    id: "internationals",
    name: "Internationals",
    slug: "international",
    url: "https://www.planetrugby.com/tournament/international/fixtures",
    type: "international" as const,
  },
  {
    id: "world-cup-table",
    name: "Rugby World Cup",
    slug: "rugby-world-cup",
    url: "https://www.planetrugby.com/tournament/rugby-world-cup/table",
    type: "world_cup" as const,
  },
  {
    id: "world-cup-fixtures",
    name: "World Cup (fixtures)",
    slug: "rugby-world-cup",
    url: "https://www.planetrugby.com/tournament/rugby-world-cup/fixtures",
    type: "world_cup" as const,
  },
] as const;

export function planetRugbyPresetById(id: string) {
  return PLANET_RUGBY_LEAGUE_PRESETS.find((preset) => preset.id === id);
}

export function competitionTypeFromPresetSlug(slug: string): "domestic" | "international" | "world_cup" | "european" {
  const preset = PLANET_RUGBY_LEAGUE_PRESETS.find((p) => p.slug === slug);
  if (preset) return preset.type;
  if (slug === "international" || slug === "six-nations" || slug === "nations-championship") return "international";
  if (slug === "rugby-world-cup") return "world_cup";
  if (slug === "rugby-champions-cup" || slug === "challenge-cup") return "european";
  if (slug === "super-rugby") return "domestic";
  return "domestic";
}

export type PlanetRugbyImportMode = "table" | "full";

export function importOptionsForMode(mode: PlanetRugbyImportMode) {
  if (mode === "table") {
    return { importFixtures: false, importResults: false, syncStandings: true, importMatchDetails: false };
  }
  return {
    importFixtures: true,
    importResults: true,
    syncStandings: true,
    importMatchDetails: true,
  };
}
