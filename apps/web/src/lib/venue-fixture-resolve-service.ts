import {
  normalizeVenueName,
  significantVenueTokens,
  VENUE_CAPACITY_LIST_ALIASES,
} from "@rugby365/import-sdk";
import { normalizeSlug } from "./fixture-admin-service";

export type CmsVenueRef = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  countryName: string | null;
  teamId: string | null;
};

export type FixtureVenueMatch = {
  venue: CmsVenueRef;
  method:
    | "home_team_venue"
    | "home_team_ground"
    | "alias"
    | "exact"
    | "slug"
    | "substring"
    | "tokens";
};

export function primaryFixtureVenueLabel(venueName: string): string {
  const trimmed = venueName.trim();
  if (!trimmed) return "";
  const beforeComma = trimmed.split(",")[0]?.trim() ?? trimmed;
  return beforeComma.replace(/\s+at\s+.+$/i, "").trim();
}

function venueTokenScore(left: string, right: string): number {
  const leftTokens = significantVenueTokens(left);
  const rightTokens = significantVenueTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  const overlap = leftTokens.filter((token) => rightTokens.includes(token));
  if (overlap.length < 2) return 0;
  return overlap.length / Math.max(leftTokens.length, rightTokens.length);
}

export function buildVenueResolver(cmsVenues: CmsVenueRef[]) {
  const byId = new Map(cmsVenues.map((venue) => [venue.id, venue]));
  const bySlug = new Map(cmsVenues.map((venue) => [venue.slug.toLowerCase(), venue]));
  const byNorm = new Map(cmsVenues.map((venue) => [normalizeVenueName(venue.name), venue]));
  const byTeamId = new Map(
    cmsVenues.filter((venue) => venue.teamId).map((venue) => [venue.teamId!, venue]),
  );

  function resolveByLabel(label: string): FixtureVenueMatch | null {
    const trimmed = primaryFixtureVenueLabel(label);
    if (!trimmed) return null;

    const aliasTarget = VENUE_CAPACITY_LIST_ALIASES[normalizeVenueName(trimmed)];
    if (aliasTarget) {
      const aliasVenue =
        byNorm.get(normalizeVenueName(aliasTarget)) ??
        cmsVenues.find((venue) => venue.name.toLowerCase() === aliasTarget.toLowerCase());
      if (aliasVenue) return { venue: aliasVenue, method: "alias" };
    }

    const norm = normalizeVenueName(trimmed);
    const exact = byNorm.get(norm);
    if (exact) return { venue: exact, method: "exact" };

    const slugGuess = normalizeSlug(trimmed);
    const bySlugGuess = bySlug.get(slugGuess);
    if (bySlugGuess) return { venue: bySlugGuess, method: "slug" };

    if (norm.length >= 8) {
      let best: FixtureVenueMatch | null = null;
      for (const venue of cmsVenues) {
        const candidateNorm = normalizeVenueName(venue.name);
        if (candidateNorm.includes(norm) || norm.includes(candidateNorm)) {
          if (!best || venue.name.length < best.venue.name.length) {
            best = { venue, method: "substring" };
          }
        }
      }
      if (best) return best;
    }

    let tokenBest: FixtureVenueMatch | null = null;
    let tokenScore = 0;
    for (const venue of cmsVenues) {
      const score = venueTokenScore(trimmed, venue.name);
      if (score >= 0.75 && score > tokenScore) {
        tokenScore = score;
        tokenBest = { venue, method: "tokens" };
      }
    }
    return tokenBest;
  }

  function resolveFixtureVenue(input: {
    venueName?: string | null;
    homeTeamId?: string | null;
    homeVenueId?: string | null;
  }): FixtureVenueMatch | null {
    if (input.homeVenueId) {
      const homeVenue = byId.get(input.homeVenueId);
      if (homeVenue) {
        if (!input.venueName) {
          return { venue: homeVenue, method: "home_team_venue" };
        }
        const labelMatch = resolveByLabel(input.venueName);
        if (labelMatch && labelMatch.venue.id === homeVenue.id) {
          return { venue: homeVenue, method: "home_team_venue" };
        }
        const normLabel = normalizeVenueName(primaryFixtureVenueLabel(input.venueName));
        const normHome = normalizeVenueName(homeVenue.name);
        if (normLabel && normHome && (normLabel === normHome || normLabel.includes(normHome) || normHome.includes(normLabel))) {
          return { venue: homeVenue, method: "home_team_venue" };
        }
      }
    }

    if (input.homeTeamId) {
      const teamVenue = byTeamId.get(input.homeTeamId);
      if (teamVenue) {
        if (!input.venueName) {
          return { venue: teamVenue, method: "home_team_ground" };
        }
        const labelMatch = resolveByLabel(input.venueName);
        if (labelMatch && labelMatch.venue.id === teamVenue.id) {
          return { venue: teamVenue, method: "home_team_ground" };
        }
      }
    }

    if (input.venueName) {
      return resolveByLabel(input.venueName);
    }

    return null;
  }

  return {
    byId,
    resolveByLabel,
    resolveFixtureVenue,
  };
}

export function resolveFixtureVenueLabel(
  venueName: string,
  cmsVenues: CmsVenueRef[],
  context?: { homeTeamId?: string | null; homeVenueId?: string | null },
): FixtureVenueMatch | null {
  return buildVenueResolver(cmsVenues).resolveFixtureVenue({
    venueName,
    homeTeamId: context?.homeTeamId,
    homeVenueId: context?.homeVenueId,
  });
}
