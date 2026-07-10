import { z } from "zod";

export const DataProviderSchema = z.enum([
  "planet_rugby",
  "sport365",
  "sdms",
  "manual",
  "approved_feed",
  "wikipedia",
]);
export type DataProvider = z.infer<typeof DataProviderSchema>;

export const PlanetRugbyMatchUrlPartsSchema = z.object({
  match_external_id: z.string(),
  competition_slug: z.string(),
  competition_external_id: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  match_date: z.string(),
});

export type PlanetRugbyMatchUrlParts = z.infer<typeof PlanetRugbyMatchUrlPartsSchema>;

export type PlanetRugbyLink = {
  href: string;
  label: string;
  kind: "team" | "competition" | "match" | "fixtures" | "other";
};

export type PlanetRugbyPageSection = {
  id: string;
  title: string;
  present: boolean;
  widgetId?: string;
  competitionExternalId?: string;
  itemCount?: number;
};

export type PlanetRugbyMatchPageData = {
  provider: "planet_rugby";
  sourceUrl: string;
  url: PlanetRugbyMatchUrlParts;
  matchTitle: string;
  competition: string;
  kickoffAt?: string;
  kickoffLabel?: string;
  matchStatus: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  sections: {
    table: PlanetRugbyPageSection;
    fixtures: PlanetRugbyPageSection;
    results: PlanetRugbyPageSection;
  };
  teamLinks: PlanetRugbyLink[];
  competitionLinks: PlanetRugbyLink[];
  sdmsMatchId?: string;
  fetchedAt: string;
};

export type PlanetRugbyFixturesPageData = {
  provider: "planet_rugby";
  sourceUrl: string;
  pageTitle: string;
  description?: string;
  sections: PlanetRugbyPageSection[];
  teamLinks: PlanetRugbyLink[];
  competitionLinks: PlanetRugbyLink[];
  fetchedAt: string;
};

export type PlanetRugbyTournamentPageData = {
  provider: "planet_rugby";
  kind: "tournament";
  sourceUrl: string;
  competitionSlug: string;
  pageType: "table" | "fixtures" | "results" | "overview";
  competitionName: string;
  sdmsCompCode?: string;
  activeSeason?: string | null;
  seasons?: string[];
  fixtureCount?: number;
  resultCount?: number;
  tableRowCount?: number;
  fetchedAt: string;
};
