import {
  buildStadiumCapacityListIndex,
  fetchWikipediaStadiumCapacityList,
  matchVenueToStadiumCapacityRow,
  wikipediaArticleUrl,
  WIKIPEDIA_RUGBY_STADIUM_CAPACITY_LIST_URL,
  type WikipediaStadiumCapacityRow,
} from "@rugby365/import-sdk";
import { venues } from "@rugby365/db";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { enrichVenueFromWikipedia } from "./venue-wikipedia-enrich";

export type VenueCapacityListImportResult = {
  venueId: string;
  venueName: string;
  updated: boolean;
  capacity?: number;
  matchedName?: string;
  method?: string;
  reason?: string;
};

export async function importVenueCapacitiesFromWikipediaList(input?: {
  rows?: WikipediaStadiumCapacityRow[];
  fallbackToInfobox?: boolean;
}): Promise<{
  sourceUrl: string;
  listSize: number;
  total: number;
  updatedFromList: number;
  enrichedFromInfobox: number;
  stillMissing: number;
  results: VenueCapacityListImportResult[];
}> {
  const { listVenues, updateVenue } = await import("./venue-admin-service");
  const rows = input?.rows ?? (await fetchWikipediaStadiumCapacityList());
  const index = buildStadiumCapacityListIndex(rows);
  const venueRows = await listVenues();
  const results: VenueCapacityListImportResult[] = [];
  let updatedFromList = 0;
  const db = getDb();

  for (const venue of venueRows) {
    const match = matchVenueToStadiumCapacityRow(venue.name, index);
    if (!match) {
      results.push({
        venueId: venue.id,
        venueName: venue.name,
        updated: false,
        reason: "no_list_match",
      });
      continue;
    }

    const wikipediaUrl = match.row.wikipediaTitle
      ? wikipediaArticleUrl(match.row.wikipediaTitle)
      : venue.wikipediaUrl;

    await updateVenue(venue.id, {
      capacity: match.row.capacity,
      ...(match.row.city && !venue.city ? { city: match.row.city } : {}),
      ...(match.row.country && !venue.countryName ? { countryName: match.row.country } : {}),
    });

    await db
      .update(venues)
      .set({
        ...(wikipediaUrl ? { wikipediaUrl } : {}),
        sourceProvider: "wikipedia_capacity_list",
        archiveSyncedAt: new Date(),
      })
      .where(eq(venues.id, venue.id));

    updatedFromList += 1;
    results.push({
      venueId: venue.id,
      venueName: venue.name,
      updated: true,
      capacity: match.row.capacity,
      matchedName: match.row.name,
      method: match.method,
    });
  }

  let enrichedFromInfobox = 0;
  if (input?.fallbackToInfobox !== false) {
    const missingIds = new Set(
      results.filter((row) => !row.updated).map((row) => row.venueId),
    );
    for (const venue of venueRows) {
      if (!missingIds.has(venue.id)) continue;
      const enriched = await enrichVenueFromWikipedia(venue.id);
      if (enriched.enriched) {
        enrichedFromInfobox += 1;
        const idx = results.findIndex((row) => row.venueId === venue.id);
        if (idx >= 0) {
          results[idx] = {
            venueId: venue.id,
            venueName: venue.name,
            updated: true,
            capacity: enriched.capacity,
            method: "wikipedia_infobox",
          };
        }
      }
    }
  }

  const stillMissing = results.filter((row) => !row.updated).length;

  return {
    sourceUrl: WIKIPEDIA_RUGBY_STADIUM_CAPACITY_LIST_URL,
    listSize: rows.length,
    total: venueRows.length,
    updatedFromList,
    enrichedFromInfobox,
    stillMissing,
    results,
  };
}

export async function importAllVenueCapacitiesFromWikipediaList() {
  return importVenueCapacitiesFromWikipediaList({ fallbackToInfobox: true });
}
