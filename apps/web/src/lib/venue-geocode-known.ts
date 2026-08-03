/**
 * Known rugby venue coordinates for sponsor / branding names Open-Meteo cannot resolve.
 * Used when city/country are blank or a previous geocode landed in the wrong country.
 */

export type KnownVenueGeo = {
  latitude: number;
  longitude: number;
  city: string;
  countryName: string;
  countryCode: string;
  /** Human-readable place used for geocode_query audit. */
  placeLabel: string;
};

function normalizeVenueKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Canonical keys → geo. Aliases point at the same entry. */
const KNOWN_BY_KEY: Record<string, KnownVenueGeo> = {
  // Counties Manukau — Navigation Homes Stadium (Growers Stadium), Pukekohe
  "navigation homes stadium": {
    latitude: -37.20196,
    longitude: 174.90363,
    city: "Pukekohe",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Pukekohe, New Zealand",
  },
  "growers stadium": {
    latitude: -37.20196,
    longitude: 174.90363,
    city: "Pukekohe",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Pukekohe, New Zealand",
  },
  // Canterbury — Apollo Projects Stadium (Addington / former Orangetheory / AMI)
  "apollo projects stadium": {
    latitude: -43.5436,
    longitude: 172.6097,
    city: "Christchurch",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Christchurch, New Zealand",
  },
  "orangetheory stadium": {
    latitude: -43.5436,
    longitude: 172.6097,
    city: "Christchurch",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Christchurch, New Zealand",
  },
  "ami stadium": {
    latitude: -43.5436,
    longitude: 172.6097,
    city: "Christchurch",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Christchurch, New Zealand",
  },
  // North Harbour — Albany (not Newfoundland, CA)
  "north harbour stadium": {
    latitude: -36.726,
    longitude: 174.702,
    city: "Albany",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Albany, Auckland, New Zealand",
  },
  // Northland — Semenoff Stadium (Okara Park / Toll Stadium), Whangārei
  "semenoff stadium": {
    latitude: -35.73417,
    longitude: 174.32944,
    city: "Whangārei",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Whangārei, New Zealand",
  },
  "okara park": {
    latitude: -35.73417,
    longitude: 174.32944,
    city: "Whangārei",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Whangārei, New Zealand",
  },
  "toll stadium": {
    latitude: -35.73417,
    longitude: 174.32944,
    city: "Whangārei",
    countryName: "New Zealand",
    countryCode: "NZ",
    placeLabel: "Whangārei, New Zealand",
  },
};

export function lookupKnownVenueGeo(name: string | null | undefined): KnownVenueGeo | null {
  if (!name?.trim()) return null;
  return KNOWN_BY_KEY[normalizeVenueKey(name)] ?? null;
}

/** True when stored coords are missing or clearly not the known venue. */
export function knownVenueCoordsNeedRepair(
  known: KnownVenueGeo,
  venue: {
    latitude: number | null | undefined;
    longitude: number | null | undefined;
    countryCode?: string | null;
  },
): boolean {
  if (venue.latitude == null || venue.longitude == null) return true;
  if (
    venue.countryCode?.trim() &&
    venue.countryCode.trim().toUpperCase() !== known.countryCode
  ) {
    return true;
  }
  const dLat = Math.abs(venue.latitude - known.latitude);
  const dLng = Math.abs(venue.longitude - known.longitude);
  return dLat > 1.5 || dLng > 1.5;
}
