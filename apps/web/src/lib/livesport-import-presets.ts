export type LiveSportSeasonFormat = "cross-year" | "single-year";

export type LiveSportCompetitionType = "domestic" | "international" | "world_cup" | "european";

export const LIVESPORT_LEAGUE_PRESETS = [
  {
    slug: "premiership",
    livesportSlug: "premiership-rugby",
    name: "Premiership",
    url: "https://www.livesport.com/uk/rugby-union/england/premiership-rugby/archive/",
    seasonLabel: "2024",
    seasonFormat: "cross-year" as const,
    type: "domestic" as const,
    description: "Gallagher Premiership — archive hub; use start year (e.g. 2024 for 2024–25).",
  },
  {
    slug: "top-14",
    livesportSlug: "top-14",
    name: "Top 14",
    url: "https://www.livesport.com/uk/rugby-union/france/top-14/",
    seasonLabel: "2024",
    seasonFormat: "cross-year" as const,
    type: "domestic" as const,
    description: "French Top 14 — use start year (e.g. 2024 for 2024–25).",
  },
  {
    slug: "united-rugby-championship",
    livesportSlug: "united-rugby-championship",
    name: "United Rugby Championship",
    url: "https://www.livesport.com/uk/rugby-union/world/united-rugby-championship/",
    seasonLabel: "2024",
    seasonFormat: "cross-year" as const,
    type: "domestic" as const,
    description: "URC — use start year (e.g. 2024 for 2024–25).",
  },
  {
    slug: "super-rugby",
    livesportSlug: "super-rugby",
    name: "Super Rugby",
    url: "https://www.livesport.com/uk/rugby-union/world/super-rugby/",
    seasonLabel: "2025",
    seasonFormat: "single-year" as const,
    type: "domestic" as const,
    description: "Super Rugby Pacific — calendar year season (e.g. 2025).",
  },
  {
    slug: "six-nations",
    livesportSlug: "six-nations",
    name: "Six Nations",
    url: "https://www.livesport.com/uk/rugby-union/europe/six-nations/",
    seasonLabel: "2026",
    seasonFormat: "single-year" as const,
    type: "international" as const,
    description: "Six Nations — championship year (e.g. 2026).",
  },
  {
    slug: "autumn-nations-cup",
    livesportSlug: "autumn-nations-cup",
    name: "Autumn Nations Cup",
    url: "https://www.livesport.com/uk/rugby-union/world/autumn-nations-cup/archive/",
    seasonLabel: "2020",
    seasonFormat: "single-year" as const,
    type: "international" as const,
    description: "Autumn Nations Cup — tournament year (2020 edition).",
  },
  {
    slug: "rugby-world-cup",
    livesportSlug: "world-cup",
    name: "Rugby World Cup",
    url: "https://www.livesport.com/uk/rugby-union/world/world-cup/archive/",
    seasonLabel: "2023",
    seasonFormat: "single-year" as const,
    type: "world_cup" as const,
    description: "Rugby World Cup — tournament year (e.g. 2023).",
  },
] as const;

export type LiveSportLeaguePreset = (typeof LIVESPORT_LEAGUE_PRESETS)[number];

const LIVESPORT_SLUG_ALIASES: Record<string, string> = Object.fromEntries(
  LIVESPORT_LEAGUE_PRESETS.map((preset) => [preset.livesportSlug, preset.slug]),
);

const LIVESPORT_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  LIVESPORT_LEAGUE_PRESETS.map((preset) => [preset.livesportSlug, preset.name]),
);

export function cmsSlugFromLiveSportSlug(livesportSlug: string): string {
  return LIVESPORT_SLUG_ALIASES[livesportSlug] ?? livesportSlug;
}

export function liveSportDisplayName(livesportSlug: string): string | null {
  return LIVESPORT_DISPLAY_NAMES[livesportSlug] ?? null;
}

export function liveSportPresetForSlug(slugOrLiveSportSlug: string): LiveSportLeaguePreset | undefined {
  return LIVESPORT_LEAGUE_PRESETS.find(
    (preset) => preset.slug === slugOrLiveSportSlug || preset.livesportSlug === slugOrLiveSportSlug,
  );
}

export function competitionTypeFromLiveSportSlug(livesportSlug: string): LiveSportCompetitionType {
  const preset = liveSportPresetForSlug(livesportSlug);
  if (preset) return preset.type;
  if (livesportSlug === "world-cup") return "world_cup";
  if (livesportSlug.includes("cup") || livesportSlug.includes("nations")) return "international";
  return "domestic";
}
