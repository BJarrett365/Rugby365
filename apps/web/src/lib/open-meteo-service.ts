/** Open-Meteo forecast, archive, and geocoding (no API key for standard use). */

import {
  weatherConditionFromCode,
  type WeatherIconKind,
} from "./weather-condition";

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
export const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
export const OPEN_METEO_DOCS_URL = "https://open-meteo.com/en/docs";

export type OpenMeteoWeather = {
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  /** Compact compass for UI arrows, e.g. "NE". */
  windCompass: string | null;
  /** WMO weather interpretation code from Open-Meteo. */
  weatherCode: number | null;
  /** Icon kind for sun / cloud / rain glyphs. */
  icon: WeatherIconKind;
  /** Short human label, e.g. "Partly cloudy". */
  conditionLabel: string;
  observedAt: string | null;
  latitude: number;
  longitude: number;
  source: "forecast" | "archive";
};

type ForecastCurrent = {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
};

type ForecastResponse = {
  latitude?: number;
  longitude?: number;
  current?: ForecastCurrent;
  error?: boolean;
  reason?: string;
};

type ArchiveHourly = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  precipitation?: Array<number | null>;
  weather_code?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  wind_direction_10m?: Array<number | null>;
};

type ArchiveResponse = {
  latitude?: number;
  longitude?: number;
  hourly?: ArchiveHourly;
  error?: boolean;
  reason?: string;
};

export type GeocodeResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

type GeocodeResponse = {
  results?: GeocodeResult[];
};

/** Twickenham Stadium — default probe for admin connection tests. */
export const OPEN_METEO_TEST_COORDS = {
  latitude: 51.4559,
  longitude: -0.3415,
  label: "Twickenham Stadium",
} as const;

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  ireland: "IE",
  "republic of ireland": "IE",
  "irish republic": "IE",
  france: "FR",
  italy: "IT",
  "south africa": "ZA",
  "new zealand": "NZ",
  australia: "AU",
  argentina: "AR",
  japan: "JP",
  fiji: "FJ",
  samoa: "WS",
  tonga: "TO",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  canada: "CA",
  georgia: "GE",
  romania: "RO",
  portugal: "PT",
  spain: "ES",
  uruguay: "UY",
  namibia: "NA",
  chile: "CL",
  brazil: "BR",
  netherlands: "NL",
  germany: "DE",
  belgium: "BE",
  switzerland: "CH",
  russia: "RU",
  "hong kong": "HK",
  "hong kong china": "HK",
  singapore: "SG",
  kenya: "KE",
  zimbabwe: "ZW",
  "south korea": "KR",
  korea: "KR",
  china: "CN",
  "papua new guinea": "PG",
  cookislands: "CK",
  "cook islands": "CK",
};

export function countryNameToIsoCode(countryName: string | null | undefined): string | null {
  if (!countryName?.trim()) return null;
  const key = countryName.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^[a-z]{2}$/i.test(key)) {
    if (/^(un|xx|zz|eu|aa)$/i.test(key)) return null;
    return key.toUpperCase();
  }
  return COUNTRY_NAME_TO_ISO[key] ?? null;
}

export function windDegreesToCompass(deg: number | null | undefined): string | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx] ?? null;
}

function toWeather(
  input: {
    latitude: number;
    longitude: number;
    temperatureC: number | null;
    humidityPct: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    weatherCode: number | null;
    observedAt: string | null;
    source: "forecast" | "archive";
  },
): OpenMeteoWeather {
  const condition = weatherConditionFromCode(input.weatherCode);
  return {
    ...input,
    windCompass: windDegreesToCompass(input.windDirectionDeg),
    icon: condition.kind,
    conditionLabel: condition.label,
  };
}

export function buildVenueGeocodeQuery(input: {
  name: string;
  city?: string | null;
  countryName?: string | null;
}): string {
  return [input.name, input.city, input.countryName]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

export async function fetchOpenMeteoWeather(input: {
  latitude: number;
  longitude: number;
}): Promise<OpenMeteoWeather> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo forecast failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as ForecastResponse;
  if (data.error) {
    throw new Error(data.reason ?? "Open-Meteo returned an error");
  }

  const current = data.current ?? {};
  return toWeather({
    temperatureC: typeof current.temperature_2m === "number" ? current.temperature_2m : null,
    humidityPct:
      typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
    precipitationMm: typeof current.precipitation === "number" ? current.precipitation : null,
    windSpeedKmh: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
    windDirectionDeg:
      typeof current.wind_direction_10m === "number" ? current.wind_direction_10m : null,
    weatherCode: typeof current.weather_code === "number" ? current.weather_code : null,
    observedAt: typeof current.time === "string" ? current.time : null,
    latitude: data.latitude ?? input.latitude,
    longitude: data.longitude ?? input.longitude,
    source: "forecast",
  });
}

function pickClosestHourlyIndex(times: string[], targetIso: string): number {
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target) || !times.length) return 0;
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i += 1) {
    const t = Date.parse(times[i]!);
    if (!Number.isFinite(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/** Historical conditions nearest to kick-off (UTC date). */
export async function fetchOpenMeteoArchiveWeather(input: {
  latitude: number;
  longitude: number;
  at: Date;
}): Promise<OpenMeteoWeather> {
  const day = input.at.toISOString().slice(0, 10);
  const url = new URL(OPEN_METEO_ARCHIVE_URL);
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("start_date", day);
  url.searchParams.set("end_date", day);
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo archive failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as ArchiveResponse;
  if (data.error) {
    throw new Error(data.reason ?? "Open-Meteo archive returned an error");
  }

  const hourly = data.hourly ?? {};
  const times = hourly.time ?? [];
  if (!times.length) {
    throw new Error("Open-Meteo archive returned no hourly data");
  }
  const idx = pickClosestHourlyIndex(times, input.at.toISOString());
  const numAt = (arr: Array<number | null> | undefined): number | null => {
    const v = arr?.[idx];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  return toWeather({
    temperatureC: numAt(hourly.temperature_2m),
    humidityPct: numAt(hourly.relative_humidity_2m),
    precipitationMm: numAt(hourly.precipitation),
    windSpeedKmh: numAt(hourly.wind_speed_10m),
    windDirectionDeg: numAt(hourly.wind_direction_10m),
    weatherCode: numAt(hourly.weather_code),
    observedAt: times[idx] ?? null,
    latitude: data.latitude ?? input.latitude,
    longitude: data.longitude ?? input.longitude,
    source: "archive",
  });
}

/**
 * Live/forecast weather for upcoming & live matches; archive snapshot for finished kick-offs
 * older than ~2 days (Open-Meteo archive lag).
 */
export async function fetchMatchVenueWeather(input: {
  latitude: number;
  longitude: number;
  kickoffAt?: Date | string | null;
}): Promise<OpenMeteoWeather> {
  const kickoff =
    input.kickoffAt == null
      ? null
      : input.kickoffAt instanceof Date
        ? input.kickoffAt
        : new Date(input.kickoffAt);
  const now = Date.now();
  const useArchive =
    kickoff != null &&
    Number.isFinite(kickoff.getTime()) &&
    kickoff.getTime() < now - 2 * 24 * 60 * 60 * 1000;

  if (useArchive && kickoff) {
    try {
      return await fetchOpenMeteoArchiveWeather({
        latitude: input.latitude,
        longitude: input.longitude,
        at: kickoff,
      });
    } catch {
      /* fall through to forecast */
    }
  }

  return fetchOpenMeteoWeather({
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

export async function geocodeOpenMeteoPlace(
  name: string,
  opts?: { count?: number; countryCode?: string },
): Promise<GeocodeResult[]> {
  const q = name.trim();
  if (!q) return [];

  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(opts?.count ?? 5));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  if (opts?.countryCode?.trim()) {
    url.searchParams.set("countryCode", opts.countryCode.trim().toUpperCase());
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo geocoding failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as GeocodeResponse;
  return data.results ?? [];
}

export function formatOpenMeteoSummary(weather: OpenMeteoWeather): string {
  const parts: string[] = [];
  if (weather.conditionLabel && weather.conditionLabel !== "Weather") {
    parts.push(weather.conditionLabel);
  }
  if (weather.temperatureC != null) parts.push(`${weather.temperatureC}°C`);
  if (weather.windSpeedKmh != null) {
    const dir = weather.windCompass
      ? ` ${weather.windCompass}`
      : weather.windDirectionDeg != null
        ? ` from ${Math.round(weather.windDirectionDeg)}°`
        : "";
    parts.push(`wind ${Math.round(weather.windSpeedKmh)} km/h${dir}`);
  }
  if (weather.humidityPct != null) parts.push(`humidity ${weather.humidityPct}%`);
  if (weather.precipitationMm != null && weather.precipitationMm > 0) {
    parts.push(`precip ${weather.precipitationMm} mm`);
  }
  return parts.join(" · ") || "No current values returned";
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer first result whose name shares a meaningful token with the venue name. */
export function pickBestGeocodeResult(
  venueName: string,
  results: GeocodeResult[],
): GeocodeResult | null {
  if (!results.length) return null;
  const venueTokens = new Set(
    normalizeToken(venueName)
      .split(" ")
      .filter((t) => t.length > 2 && !["stadium", "park", "arena", "ground", "the"].includes(t)),
  );
  if (!venueTokens.size) return results[0] ?? null;

  for (const r of results) {
    const nameTokens = normalizeToken(r.name).split(" ");
    if (nameTokens.some((t) => venueTokens.has(t))) return r;
  }
  return results[0] ?? null;
}
