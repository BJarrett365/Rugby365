import { teams } from "@rugby365/db";
import { findCoachCategoryByCountry } from "./coach-wikipedia-category-catalog";
import { getDb } from "./db";
import { normalizedEntityKey, normalizeTeamName } from "./entity-normalize";
import { normalizeSlug } from "./fixture-admin-service";

type CmsTeam = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
};

function normalizeCoachTeamLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(rugby union|rugby|national|team|men's|womens|women's)\b/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function coachStintTeamMatchesCmsTeam(stintName: string, cmsTeamName: string): boolean {
  const stint = normalizeCoachTeamLabel(stintName);
  const cms = normalizeCoachTeamLabel(cmsTeamName);
  if (!stint || !cms) return false;
  if (stint === cms) return true;
  if (stint.includes(cms) || cms.includes(stint)) return true;

  const stintFirst = stint.split(" ")[0];
  const cmsFirst = cms.split(" ")[0];
  if (stintFirst.length >= 4 && stintFirst === cmsFirst) return true;

  if (stint.startsWith("british irish lions") || stint.startsWith("british & irish lions")) {
    return cms.includes("lions");
  }

  return false;
}

export function extractCountryFromCoachStintTeamName(stintTeamName: string): string | null {
  const cleaned = stintTeamName.trim().replace(/_/g, " ");
  const patterns = [
    /^(.+?)\s+national rugby union team$/i,
    /^(.+?)\s+national rugby team$/i,
    /^(.+?)\s+rugby union team$/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function buildCoachTeamResolver(cmsTeams: CmsTeam[]) {
  const byId = new Map(cmsTeams.map((team) => [team.id, team]));
  const byNameKey = new Map(
    cmsTeams.map((team) => [normalizedEntityKey(team.name, "team"), team]),
  );
  const bySlug = new Map(cmsTeams.map((team) => [team.slug.toLowerCase(), team]));

  function resolveCountry(countryName: string): CmsTeam | null {
    const catalog = findCoachCategoryByCountry(countryName);
    const slugHints = catalog?.teamSlugs ?? [];
    const nameHints = catalog?.teamNames ?? [countryName];

    for (const slug of slugHints) {
      const team = bySlug.get(slug.toLowerCase());
      if (team) return team;
    }
    for (const name of nameHints) {
      const team = byNameKey.get(normalizedEntityKey(name, "team"));
      if (team) return team;
    }
    for (const team of cmsTeams) {
      if (coachStintTeamMatchesCmsTeam(countryName, team.name)) return team;
    }
    return null;
  }

  function resolveWikipediaTeamLabel(label: string): CmsTeam | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    const country = extractCountryFromCoachStintTeamName(trimmed);
    if (country) {
      const byCountry = resolveCountry(country);
      if (byCountry) return byCountry;
    }

    const exact = byNameKey.get(normalizedEntityKey(normalizeTeamName(trimmed), "team"));
    if (exact && isCanonicalCmsTeam(exact)) return exact;

    const slugGuess = normalizeSlug(trimmed);
    const bySlugGuess = bySlug.get(slugGuess);
    if (bySlugGuess && isCanonicalCmsTeam(bySlugGuess)) return bySlugGuess;

    let best: CmsTeam | null = null;
    for (const team of cmsTeams) {
      if (coachStintTeamMatchesCmsTeam(trimmed, team.name)) {
        const canonical = findCanonicalTeamForExisting(team) ?? team;
        if (!best || canonical.name.length < best.name.length) {
          best = canonical;
        }
      }
    }
    return best;
  }

  function isCanonicalCmsTeam(team: CmsTeam): boolean {
    const country = extractCountryFromCoachStintTeamName(team.name);
    if (!country) return true;
    const canonical = resolveCountry(country);
    return !canonical || canonical.id === team.id;
  }

  function findCanonicalTeamForExisting(team: CmsTeam): CmsTeam | null {
    if (isCanonicalCmsTeam(team)) return team;
    const country = extractCountryFromCoachStintTeamName(team.name);
    if (!country) return null;
    return resolveCountry(country);
  }

  return {
    byId,
    resolveCountry,
    resolveWikipediaTeamLabel,
    isCanonicalCmsTeam,
    findCanonicalTeamForExisting,
  };
}

export async function loadCmsTeamsForCoachAssignment(): Promise<CmsTeam[]> {
  const db = getDb();
  return db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      shortName: teams.shortName,
    })
    .from(teams);
}

export async function resolveCoachStintToCmsTeam(stintTeamName: string): Promise<CmsTeam | null> {
  const cmsTeams = await loadCmsTeamsForCoachAssignment();
  return buildCoachTeamResolver(cmsTeams).resolveWikipediaTeamLabel(stintTeamName);
}

export function parseCoachedCountryFromCoachNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Coached country:\s*([^·]+)/i);
  return match?.[1]?.trim() ?? null;
}
