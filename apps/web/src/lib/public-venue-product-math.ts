/**
 * Pure helpers for the public Venues product (no DB).
 */
import type {
  VenueProductCategory,
  VenueTopLimit,
  VenueType,
} from "./public-venue-product-types";
import { VENUE_TYPE_LABELS } from "./public-venue-ranking-engine";

/** Rugby hub cities used to estimate remoteness (km to nearest hub). */
export const RUGBY_HUBS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Dublin", lat: 53.3498, lng: -6.2603 },
  { name: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  { name: "Cardiff", lat: 51.4816, lng: -3.1791 },
  { name: "Rome", lat: 41.9028, lng: 12.4964 },
  { name: "Johannesburg", lat: -26.2041, lng: 28.0473 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241 },
  { name: "Auckland", lat: -36.8485, lng: 174.7633 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
];

export const LARGE_CAPACITY_THRESHOLD = 40_000;

export const TOP_LIMIT_OPTIONS: VenueTopLimit[] = [10, 25, 50, 100];

export function countryNameToSlug(countryName: string): string {
  return countryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Prefer subdivision flags for Home Nations when flagcdn supports them. */
export function venueFlagIso(countryName: string | null | undefined, countryCode?: string | null): string | null {
  const name = countryName?.trim().toLowerCase() ?? "";
  if (name === "england") return "gb-eng";
  if (name === "scotland") return "gb-sct";
  if (name === "wales") return "gb-wls";
  if (name === "northern ireland") return "gb-nir";
  if (countryCode && /^[a-z]{2}$/i.test(countryCode.trim())) {
    return countryCode.trim().toLowerCase();
  }
  return null;
}

export function flagUrlForVenue(iso: string | null): string | null {
  if (!iso) return null;
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
}

/** Earth-surface km between two WGS84 points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distance (km) from venue to nearest rugby hub — higher = more remote. */
export function remotenessKm(lat: number, lng: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (const hub of RUGBY_HUBS) {
    const d = haversineKm(lat, lng, hub.lat, hub.lng);
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? Math.round(min) : 0;
}

export function formatCapacity(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-GB");
}

export function formatRating(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function formatOpened(year: number | null | undefined): string {
  if (year == null || !Number.isFinite(year)) return "—";
  return String(year);
}

export function categoryLabel(category: VenueProductCategory): string {
  switch (category) {
    case "best":
      return "Best Overall";
    case "atmosphere":
      return "Best Atmosphere";
    case "fortress":
      return "Biggest Fortress";
    case "historic":
      return "Most Historic";
    case "iconic":
      return "Most Iconic";
    case "picturesque":
      return "Most Picturesque";
    case "remote":
      return "Most Remote";
    case "biggest":
      return "Biggest";
    case "smallest":
      return "Smallest";
    case "club_ground":
      return "Best Club Ground";
    case "matchday":
      return "Best Matchday Experience";
    case "all":
      return "All Venues";
    default:
      return "Venues";
  }
}

export function categorySubtitle(category: VenueProductCategory): string {
  switch (category) {
    case "best":
      return "Top Rated";
    case "atmosphere":
      return "Crowd & Utilisation";
    case "fortress":
      return "Home Win Rate";
    case "historic":
      return "Heritage & Tests";
    case "iconic":
      return "Editorial Picks";
    case "picturesque":
      return "Editorial Picks";
    case "remote":
      return "Hardest to Reach";
    case "biggest":
    case "smallest":
      return "By Rugby Capacity";
    case "club_ground":
      return "Club Tenants";
    case "matchday":
      return "Fan Experience";
    default:
      return "Directory";
  }
}

export function categoryShortLabel(category: VenueProductCategory): string {
  switch (category) {
    case "best":
      return "BEST";
    case "atmosphere":
      return "BEST ATMOSPHERE";
    case "fortress":
      return "BIGGEST FORTRESS";
    case "historic":
      return "MOST HISTORIC";
    case "iconic":
      return "MOST ICONIC";
    case "picturesque":
      return "MOST PICTURESQUE";
    case "remote":
      return "MOST REMOTE";
    case "biggest":
      return "BIGGEST";
    case "smallest":
      return "SMALLEST";
    case "club_ground":
      return "BEST CLUB GROUND";
    case "matchday":
      return "BEST MATCHDAY";
    case "all":
      return "ALL";
    default:
      return "VENUES";
  }
}

export function parseVenueCategory(raw: string | null | undefined): VenueProductCategory {
  const v = (raw ?? "best").trim().toLowerCase();
  const allowed: VenueProductCategory[] = [
    "best",
    "atmosphere",
    "fortress",
    "historic",
    "iconic",
    "picturesque",
    "remote",
    "biggest",
    "smallest",
    "club_ground",
    "matchday",
    "all",
  ];
  return (allowed.includes(v as VenueProductCategory) ? v : "best") as VenueProductCategory;
}

export function parseVenueType(raw: string | null | undefined): VenueType | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  const allowed: VenueType[] = [
    "dedicated_rugby",
    "multi_sport",
    "occasional_rugby",
    "historic_rugby",
  ];
  return allowed.includes(v as VenueType) ? (v as VenueType) : null;
}

export function parseTopLimit(raw: string | null | undefined): VenueTopLimit {
  const n = Number(raw);
  if (n === 25 || n === 50 || n === 100) return n;
  return 10;
}

export function venueTypeLabel(type: VenueType | null): string {
  if (!type) return "All Types";
  return VENUE_TYPE_LABELS[type];
}

export function buildVenueRankingTitle(input: {
  category: VenueProductCategory;
  countryName?: string | null;
  competitionName?: string | null;
  top?: VenueTopLimit;
}): string {
  const cat = categoryShortLabel(input.category);
  const top = input.top && input.top !== 10 ? ` TOP ${input.top}` : "";
  const comp = input.competitionName?.trim();
  const country = input.countryName?.trim();

  if (comp && country) {
    return `${cat}${top} ${comp.toUpperCase()} STADIUMS IN ${country.toUpperCase()}`;
  }
  if (comp) {
    return `${cat}${top} ${comp.toUpperCase()} STADIUMS`;
  }
  if (country) {
    return `${cat}${top} STADIUMS IN ${country.toUpperCase()}`;
  }
  return `${cat}${top} RUGBY STADIUMS`;
}

export function buildVenueFilterQuery(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function avgOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function sumOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}
