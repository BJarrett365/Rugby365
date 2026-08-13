import type { VenueProductCategory } from "@/lib/public-venue-product-types";
import {
  parseTopLimit,
  parseVenueCategory,
  parseVenueType,
} from "@/lib/public-venue-product-math";
import type { VenueRankingFilters } from "@/lib/public-venue-product-types";

/** Parse search params into ranking filters (server-side). */
export function parseVenueRankingFilters(
  sp: Record<string, string | string[] | undefined>,
): VenueRankingFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return {
    category: parseVenueCategory(one(sp.category)),
    countrySlug: one(sp.country) || null,
    competitionSlug: one(sp.competition) || null,
    seasonSlug: one(sp.season) || null,
    venueType: parseVenueType(one(sp.type)),
    top: parseTopLimit(one(sp.top)),
  };
}

export function categorySectionSubtitle(category: VenueProductCategory): string {
  switch (category) {
    case "best":
      return "Top rated rugby venues in the world.";
    case "biggest":
      return "Largest rugby stadiums by verified capacity.";
    case "smallest":
      return "Intimate grounds with the smallest rugby capacities.";
    case "remote":
      return "Hardest-to-reach venues by distance from major cities.";
    case "iconic":
      return "Editorial picks for rugby's most iconic grounds.";
    case "atmosphere":
      return "Venues ranked by crowd utilisation and atmosphere.";
    case "fortress":
      return "Home grounds with the strongest fortress records.";
    case "historic":
      return "Heritage venues with deep test and club history.";
    case "picturesque":
      return "Editorial scenic and picturesque rugby settings.";
    case "club_ground":
      return "Club tenanted grounds with strong rugby identity.";
    case "matchday":
      return "Best overall matchday experience scores.";
    case "all":
      return "Full venue directory for the active filter cohort.";
    default:
      return "Ranked rugby venues from the Rugby365 database.";
  }
}
