import { PlanetRugbyMatchUrlPartsSchema, type PlanetRugbyMatchUrlParts } from "../types";

const PLANET_RUGBY_HOST_RE = /(^|\.)planetrugby\.com$/i;

/** /matches/{matchId}/{compSlug}/{compId}/{home}-v-{away}/{date} */
const MATCH_PATH_RE =
  /^\/matches\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)-v-([^/]+)\/(\d{4}-\d{2}-\d{2})\/?$/i;

export function assertPlanetRugbyUrl(input: string): URL {
  const u = new URL(input.trim());
  if (u.protocol !== "https:") throw new Error("Planet Rugby URL must use https.");
  if (!PLANET_RUGBY_HOST_RE.test(u.hostname)) {
    throw new Error("Only planetrugby.com URLs are allowed.");
  }
  return u;
}

export function isPlanetRugbyMatchUrl(input: string): boolean {
  try {
    parsePlanetRugbyMatchUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function isPlanetRugbyFixturesUrl(input: string): boolean {
  try {
    const u = assertPlanetRugbyUrl(input);
    return u.pathname === "/fixtures" || u.pathname === "/fixtures/";
  } catch {
    return false;
  }
}

export function parsePlanetRugbyMatchUrl(input: string): PlanetRugbyMatchUrlParts {
  const u = assertPlanetRugbyUrl(input);
  const m = u.pathname.match(MATCH_PATH_RE);
  if (!m) {
    throw new Error(
      "URL must match /matches/{matchId}/{competition}/{compId}/{home}-v-{away}/{date}",
    );
  }
  return PlanetRugbyMatchUrlPartsSchema.parse({
    match_external_id: m[1],
    competition_slug: m[2],
    competition_external_id: m[3],
    home_team: m[4],
    away_team: m[5],
    match_date: m[6],
  });
}

export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildPlanetRugbyMatchUrl(parts: PlanetRugbyMatchUrlParts): string {
  return `https://www.planetrugby.com/matches/${parts.match_external_id}/${parts.competition_slug}/${parts.competition_external_id}/${parts.home_team}-v-${parts.away_team}/${parts.match_date}`;
}

export function buildPlanetRugbyTeamUrl(slug: string): string {
  return `https://www.planetrugby.com/team/${slug}`;
}

/** /tournament/{slug} or /tournament/{slug}/{table|fixtures|results} */
const TOURNAMENT_PATH_RE = /^\/tournament\/([^/]+)(?:\/(table|fixtures|results))?\/?$/i;

export function isPlanetRugbyTournamentUrl(input: string): boolean {
  try {
    parsePlanetRugbyTournamentUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function parsePlanetRugbyTournamentUrl(input: string): {
  competitionSlug: string;
  pageType: "table" | "fixtures" | "results" | "overview";
} {
  const u = assertPlanetRugbyUrl(input);
  const m = u.pathname.match(TOURNAMENT_PATH_RE);
  if (!m) throw new Error("URL must match /tournament/{slug} or /tournament/{slug}/{table|fixtures|results}");
  const pageType = (m[2] as "table" | "fixtures" | "results" | undefined) ?? "overview";
  return { competitionSlug: m[1], pageType };
}

export function buildPlanetRugbyCompetitionUrl(slug: string, page?: "table" | "fixtures" | "results") {
  return page
    ? `https://www.planetrugby.com/tournament/${slug}/${page}`
    : `https://www.planetrugby.com/tournament/${slug}`;
}
