import {
  findWikipediaVenueArticleTitles,
  parseWikipediaArchive,
} from "@rugby365/import-sdk";

export type VenueWikiEnrichResult = {
  enriched: boolean;
  venueId: string;
  wikipediaUrl?: string;
  capacity?: number;
  recordAttendance?: number;
  reason?: string;
};

export async function enrichVenueFromWikipediaAndWait(venueId: string): Promise<VenueWikiEnrichResult> {
  return enrichVenueFromWikipedia(venueId);
}

function normalizeVenueName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\bstadium\b/g, "")
    .replace(/\brugby\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function venueNamesLikelyMatch(venueName: string, archiveName: string): boolean {
  const a = normalizeVenueName(venueName);
  const b = normalizeVenueName(archiveName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = a.split(/\s+/).filter((token) => token.length > 2);
  const bTokens = b.split(/\s+/).filter((token) => token.length > 2);
  if (aTokens.length === 0 || bTokens.length === 0) return false;
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  return overlap >= Math.min(aTokens.length, bTokens.length, 2);
}

/** Look up Wikipedia by venue name and merge capacity + record attendance. */
export async function enrichVenueFromWikipedia(venueId: string): Promise<VenueWikiEnrichResult> {
  const { getVenueById, applyVenueWikipediaArchive } = await import("./venue-admin-service");
  const venue = await getVenueById(venueId);
  if (!venue) {
    return { enriched: false, venueId, reason: "venue_not_found" };
  }

  const name = venue.name.trim();
  if (!name || name.length < 3) {
    return { enriched: false, venueId, reason: "name_too_short" };
  }

  const candidates = await findWikipediaVenueArticleTitles(name);

  for (const title of candidates) {
    try {
      const parsed = await parseWikipediaArchive({
        articleTitleOrUrl: title,
        entityType: "auto",
      });

      if (parsed.entityType !== "venue") continue;
      if (!venueNamesLikelyMatch(name, parsed.name)) continue;
      if (parsed.capacity == null && parsed.recordAttendance == null) continue;

      await applyVenueWikipediaArchive(venueId, parsed);
      return {
        enriched: true,
        venueId,
        wikipediaUrl: parsed.wikipediaUrl,
        capacity: parsed.capacity,
        recordAttendance: parsed.recordAttendance,
      };
    } catch {
      continue;
    }
  }

  return { enriched: false, venueId, reason: "no_matching_wikipedia_article" };
}

export async function enrichAllVenuesFromWikipedia(): Promise<{
  total: number;
  enriched: number;
  skipped: number;
  results: VenueWikiEnrichResult[];
}> {
  const { listVenues } = await import("./venue-admin-service");
  const venues = await listVenues();
  const results: VenueWikiEnrichResult[] = [];

  for (const venue of venues) {
    results.push(await enrichVenueFromWikipedia(venue.id));
  }

  return {
    total: venues.length,
    enriched: results.filter((row) => row.enriched).length,
    skipped: results.filter((row) => !row.enriched).length,
    results,
  };
}
