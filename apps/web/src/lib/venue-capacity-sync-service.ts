import {
  buildStadiumCapacityListIndex,
  fetchWikipediaStadiumCapacityList,
  matchVenueToStadiumCapacityRow,
  wikipediaArticleUrl,
  type WikipediaStadiumCapacityRow,
} from "@rugby365/import-sdk";
import { venues } from "@rugby365/db";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { enrichVenueFromWikipedia } from "./venue-wikipedia-enrich";
import { getVenueById, updateVenue } from "./venue-admin-service";

export type VenueCapacitySyncResult = {
  venueId: string;
  updated: boolean;
  capacity: number | null;
  method?: string;
  reason?: string;
};

let capacityListCache: {
  fetchedAt: number;
  rows: WikipediaStadiumCapacityRow[];
  index: ReturnType<typeof buildStadiumCapacityListIndex>;
} | null = null;

const CAPACITY_LIST_CACHE_MS = 60 * 60 * 1000;

async function getStadiumCapacityListIndex() {
  const now = Date.now();
  if (capacityListCache && now - capacityListCache.fetchedAt < CAPACITY_LIST_CACHE_MS) {
    return capacityListCache.index;
  }
  const rows = await fetchWikipediaStadiumCapacityList();
  const index = buildStadiumCapacityListIndex(rows);
  capacityListCache = { fetchedAt: now, rows, index };
  return index;
}

async function applyCapacityToVenue(
  venueId: string,
  capacity: number,
  input: {
    method: string;
    sourceProvider: string;
    city?: string | null;
    countryName?: string | null;
    wikipediaUrl?: string | null;
  },
) {
  const venue = await getVenueById(venueId);
  if (!venue) throw new Error("Venue not found");

  await updateVenue(venueId, {
    capacity,
    ...(input.city && !venue.city ? { city: input.city } : {}),
    ...(input.countryName && !venue.countryName ? { countryName: input.countryName } : {}),
  });

  const db = getDb();
  await db
    .update(venues)
    .set({
      sourceProvider: input.sourceProvider,
      archiveSyncedAt: new Date(),
      ...(input.wikipediaUrl ? { wikipediaUrl: input.wikipediaUrl } : {}),
    })
    .where(eq(venues.id, venueId));

  return capacity;
}

export async function ensureVenueCapacityInDatabase(
  venueId: string,
  input?: {
    capacity?: number | null;
    sourceProvider?: string;
    fallbackToWikipedia?: boolean;
  },
): Promise<VenueCapacitySyncResult> {
  const venue = await getVenueById(venueId);
  if (!venue) {
    return { venueId, updated: false, capacity: null, reason: "venue_not_found" };
  }

  const providerCapacity =
    input?.capacity != null && Number.isFinite(input.capacity) && input.capacity > 0
      ? Math.round(input.capacity)
      : null;

  if (providerCapacity != null) {
    const shouldWrite =
      venue.capacity == null || venue.capacity !== providerCapacity || input?.sourceProvider === "sport365";
    if (shouldWrite) {
      await applyCapacityToVenue(venueId, providerCapacity, {
        method: "provider",
        sourceProvider: input?.sourceProvider ?? "provider",
      });
      return {
        venueId,
        updated: true,
        capacity: providerCapacity,
        method: input?.sourceProvider ?? "provider",
      };
    }
    return { venueId, updated: false, capacity: venue.capacity, reason: "already_set" };
  }

  if (venue.capacity != null) {
    return { venueId, updated: false, capacity: venue.capacity, reason: "already_set" };
  }

  if (input?.fallbackToWikipedia === false) {
    return { venueId, updated: false, capacity: null, reason: "no_provider_capacity" };
  }

  const listMatch = matchVenueToStadiumCapacityRow(venue.name, await getStadiumCapacityListIndex());
  if (listMatch) {
    await applyCapacityToVenue(venueId, listMatch.row.capacity, {
      method: listMatch.method,
      sourceProvider: "wikipedia_capacity_list",
      city: listMatch.row.city,
      countryName: listMatch.row.country,
      wikipediaUrl: listMatch.row.wikipediaTitle
        ? wikipediaArticleUrl(listMatch.row.wikipediaTitle)
        : null,
    });
    return {
      venueId,
      updated: true,
      capacity: listMatch.row.capacity,
      method: listMatch.method,
    };
  }

  const enriched = await enrichVenueFromWikipedia(venueId);
  if (enriched.enriched) {
    const refreshed = await getVenueById(venueId);
    return {
      venueId,
      updated: true,
      capacity: refreshed?.capacity ?? enriched.capacity ?? null,
      method: "wikipedia_infobox",
    };
  }

  return { venueId, updated: false, capacity: venue.capacity, reason: enriched.reason ?? "not_found" };
}
