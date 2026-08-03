import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { venues } from "@rugby365/db";
import { getDb } from "./db";
import {
  buildVenueGeocodeQuery,
  countryNameToIsoCode,
  fetchMatchVenueWeather,
  geocodeOpenMeteoPlace,
  pickBestGeocodeResult,
  type OpenMeteoWeather,
} from "./open-meteo-service";

export type VenueGeoInput = {
  id: string;
  name: string;
  city: string | null;
  countryName: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

const weatherCache = new Map<string, { expiresAt: number; weather: OpenMeteoWeather }>();
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeVenueById(
  venueId: string,
  opts?: { force?: boolean },
): Promise<{
  ok: boolean;
  venueId: string;
  reason?: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string | null;
  query?: string;
}> {
  const db = getDb();
  const [venue] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
  if (!venue) return { ok: false, venueId, reason: "Venue not found" };

  if (!opts?.force && venue.latitude != null && venue.longitude != null) {
    return {
      ok: true,
      venueId,
      reason: "Already geocoded",
      latitude: venue.latitude,
      longitude: venue.longitude,
      countryCode: venue.countryCode,
      query: venue.geocodeQuery ?? undefined,
    };
  }

  const countryCode =
    venue.countryCode?.trim().toUpperCase() || countryNameToIsoCode(venue.countryName);
  const query = buildVenueGeocodeQuery({
    name: venue.name,
    city: venue.city,
    countryName: venue.countryName,
  });

  const strippedName = venue.name
    .replace(
      /\b(stadium|stade|arena|ground|park|community stadium|building society arena)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  // Prefer city+country when stadium name is noisy; fall back to full query / name.
  const attempts: Array<{ name: string; countryCode?: string }> = [];
  if (venue.city?.trim()) {
    attempts.push({
      name: [venue.city.trim(), venue.countryName?.trim()].filter(Boolean).join(", "),
      countryCode: countryCode ?? undefined,
    });
    attempts.push({
      name: venue.city.trim(),
      countryCode: countryCode ?? undefined,
    });
  }
  attempts.push({ name: query, countryCode: countryCode ?? undefined });
  attempts.push({ name: venue.name, countryCode: countryCode ?? undefined });
  if (strippedName && strippedName.toLowerCase() !== venue.name.toLowerCase()) {
    attempts.push({ name: strippedName, countryCode: countryCode ?? undefined });
    if (venue.countryName?.trim()) {
      attempts.push({
        name: `${strippedName}, ${venue.countryName.trim()}`,
        countryCode: countryCode ?? undefined,
      });
    }
  }
  attempts.push({ name: venue.name });
  if (strippedName) attempts.push({ name: strippedName });
  if (venue.city?.trim()) attempts.push({ name: venue.city.trim() });

  let best: ReturnType<typeof pickBestGeocodeResult> = null;
  let usedQuery = query;
  for (const attempt of attempts) {
    const results = await geocodeOpenMeteoPlace(attempt.name, {
      count: 5,
      countryCode: attempt.countryCode,
    });
    best = pickBestGeocodeResult(venue.name, results);
    if (best) {
      usedQuery = attempt.name;
      break;
    }
  }

  if (!best) {
    return { ok: false, venueId, reason: "No geocode match", query };
  }

  const resolvedCountryCode =
    best.country_code?.toUpperCase() || countryCode || countryNameToIsoCode(best.country);

  await db
    .update(venues)
    .set({
      latitude: best.latitude,
      longitude: best.longitude,
      countryCode: resolvedCountryCode,
      geocodedAt: new Date(),
      geocodeSource: "open_meteo",
      geocodeQuery: usedQuery,
    })
    .where(eq(venues.id, venueId));

  return {
    ok: true,
    venueId,
    latitude: best.latitude,
    longitude: best.longitude,
    countryCode: resolvedCountryCode,
    query: usedQuery,
  };
}

export async function geocodeVenuesMissingCoords(opts?: {
  limit?: number;
  force?: boolean;
  delayMs?: number;
}): Promise<{
  scanned: number;
  geocoded: number;
  skipped: number;
  failed: number;
  results: Array<{
    venueId: string;
    name: string;
    ok: boolean;
    reason?: string;
    latitude?: number;
    longitude?: number;
  }>;
}> {
  const db = getDb();
  const limit = opts?.limit ?? 200;
  const delayMs = opts?.delayMs ?? 120;

  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(venues)
    .where(
      opts?.force
        ? sql`true`
        : or(isNull(venues.latitude), isNull(venues.longitude)),
    )
    .limit(limit);

  const results: Array<{
    venueId: string;
    name: string;
    ok: boolean;
    reason?: string;
    latitude?: number;
    longitude?: number;
  }> = [];

  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const out = await geocodeVenueById(row.id, { force: opts?.force });
    if (out.ok && out.reason === "Already geocoded") {
      skipped += 1;
      results.push({
        venueId: row.id,
        name: row.name,
        ok: true,
        reason: out.reason,
        latitude: out.latitude,
        longitude: out.longitude,
      });
    } else if (out.ok) {
      geocoded += 1;
      results.push({
        venueId: row.id,
        name: row.name,
        ok: true,
        latitude: out.latitude,
        longitude: out.longitude,
      });
    } else {
      failed += 1;
      results.push({
        venueId: row.id,
        name: row.name,
        ok: false,
        reason: out.reason,
      });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return { scanned: rows.length, geocoded, skipped, failed, results };
}

export async function resolveWeatherForVenueCoords(input: {
  venueId?: string | null;
  latitude: number;
  longitude: number;
  kickoffAt?: Date | string | null;
}): Promise<OpenMeteoWeather | null> {
  const kickoffKey =
    input.kickoffAt == null
      ? "now"
      : input.kickoffAt instanceof Date
        ? input.kickoffAt.toISOString().slice(0, 13)
        : String(input.kickoffAt).slice(0, 13);
  const cacheKey = `${input.venueId ?? "coords"}:${input.latitude.toFixed(3)}:${input.longitude.toFixed(3)}:${kickoffKey}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.weather;

  try {
    const weather = await fetchMatchVenueWeather({
      latitude: input.latitude,
      longitude: input.longitude,
      kickoffAt: input.kickoffAt,
    });
    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      weather,
    });
    return weather;
  } catch {
    return null;
  }
}

export async function resolveWeatherForVenueId(input: {
  venueId: string;
  kickoffAt?: Date | string | null;
  geocodeIfMissing?: boolean;
}): Promise<OpenMeteoWeather | null> {
  const db = getDb();
  let [venue] = await db
    .select({
      id: venues.id,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(venues)
    .where(eq(venues.id, input.venueId))
    .limit(1);

  if (!venue) return null;

  if ((venue.latitude == null || venue.longitude == null) && input.geocodeIfMissing !== false) {
    await geocodeVenueById(input.venueId);
    [venue] = await db
      .select({
        id: venues.id,
        latitude: venues.latitude,
        longitude: venues.longitude,
      })
      .from(venues)
      .where(eq(venues.id, input.venueId))
      .limit(1);
  }

  if (venue?.latitude == null || venue.longitude == null) return null;

  return resolveWeatherForVenueCoords({
    venueId: venue.id,
    latitude: venue.latitude,
    longitude: venue.longitude,
    kickoffAt: input.kickoffAt,
  });
}

export async function countVenueGeoCoverage(): Promise<{
  total: number;
  withCoords: number;
  missingCoords: number;
  withCityCountry: number;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withCoords: sql<number>`count(*) filter (where ${venues.latitude} is not null and ${venues.longitude} is not null)::int`,
      withCityCountry: sql<number>`count(*) filter (where ${venues.city} is not null and ${venues.countryName} is not null)::int`,
    })
    .from(venues);

  const total = row?.total ?? 0;
  const withCoords = row?.withCoords ?? 0;
  return {
    total,
    withCoords,
    missingCoords: total - withCoords,
    withCityCountry: row?.withCityCountry ?? 0,
  };
}

export async function listVenuesMissingGeo(limit = 50) {
  const db = getDb();
  return db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      countryName: venues.countryName,
    })
    .from(venues)
    .where(or(isNull(venues.latitude), isNull(venues.longitude)))
    .limit(limit);
}

/** Used by tests / scripts — venues that have both city and country but no coords. */
export async function listGeocodeReadyVenues(limit = 200) {
  const db = getDb();
  return db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      countryName: venues.countryName,
      countryCode: venues.countryCode,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(venues)
    .where(
      and(
        isNotNull(venues.city),
        isNotNull(venues.countryName),
        or(isNull(venues.latitude), isNull(venues.longitude)),
      ),
    )
    .limit(limit);
}
