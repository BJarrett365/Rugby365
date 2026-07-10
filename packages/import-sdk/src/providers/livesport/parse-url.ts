import { buildLiveSportSeasonPathSlug } from "./season-url";

const LIVESPORT_HOSTS = new Set([
  "www.livesport.com",
  "livesport.com",
  "www.flashscore.com",
  "flashscore.com",
  "www.flashscore.co.uk",
  "flashscore.co.uk",
]);
const PATH_SUFFIXES = new Set(["archive", "fixtures", "results", "standings", "odds", "draw"]);

function parseCompetitionPart(part: string): { competitionSlug: string; seasonLabel: string | null } {
  const crossYear = part.match(/^(?<base>.+)-(?<start>20\d{2})-(?<end>20\d{2})$/);
  if (crossYear?.groups?.base && crossYear.groups.start) {
    return { competitionSlug: crossYear.groups.base, seasonLabel: crossYear.groups.start };
  }

  const singleYear = part.match(/^(?<base>.+)-(?<year>20\d{2})$/);
  if (singleYear?.groups?.base && singleYear.groups.year) {
    return { competitionSlug: singleYear.groups.base, seasonLabel: singleYear.groups.year };
  }

  return { competitionSlug: part, seasonLabel: null };
}

export function assertLiveSportUrl(input: string): URL {
  const url = new URL(input.trim().replace(/#.*$/, ""));
  if (url.protocol !== "https:") throw new Error("LiveSport URL must use https.");
  if (!LIVESPORT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only livesport.com / flashscore.com URLs are supported.");
  }
  return url;
}

export function parseLiveSportCompetitionUrl(input: string): {
  sourceUrl: string;
  pagePath: string;
  competitionSlug: string;
  seasonLabel: string | null;
} {
  const url = assertLiveSportUrl(input);
  const parts = url.pathname.split("/").filter(Boolean);
  const sportIndex = parts.findIndex((part) => part === "rugby-union");
  if (sportIndex < 0) throw new Error("URL must be a rugby-union competition page.");

  const trimmedParts =
    parts.length > 0 && PATH_SUFFIXES.has(parts.at(-1) ?? "") ? parts.slice(0, -1) : parts;
  const competitionPart = trimmedParts[sportIndex + 2] ?? trimmedParts.at(-1);
  if (!competitionPart || PATH_SUFFIXES.has(competitionPart)) {
    throw new Error("Could not determine competition from URL.");
  }

  const parsed = parseCompetitionPart(competitionPart);

  return {
    sourceUrl: url.toString(),
    pagePath: url.pathname,
    competitionSlug: parsed.competitionSlug,
    seasonLabel: parsed.seasonLabel,
  };
}

export function buildLiveSportMatchUrl(meta: {
  locale?: string;
  region?: string;
  competitionSlug: string;
  seasonLabel?: string | null;
  matchId: string;
  homeSlug?: string;
  awaySlug?: string;
}): string {
  const locale = meta.locale ?? "uk";
  const region = meta.region ?? "europe";
  const seasonSlug = meta.seasonLabel
    ? buildLiveSportSeasonPathSlug(meta.competitionSlug, meta.seasonLabel)
    : meta.competitionSlug;
  const base = `https://www.livesport.com/${locale}/rugby-union/${region}/${seasonSlug}/`;
  if (meta.homeSlug && meta.awaySlug) {
    return `${base}#/match/${meta.homeSlug}-${meta.awaySlug}/${meta.matchId}/`;
  }
  return `${base}#/match/summary/${meta.matchId}/`;
}
