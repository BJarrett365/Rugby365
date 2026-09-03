import { createHash } from "node:crypto";
import {
  resolveRugbyDataApiBaseUrl,
  resolveRugbyDataApiToken,
} from "./integration-settings-service";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

export type RugbyDataApiRequestOptions = {
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Extra request headers (timezone, difference, etc.). Never pass secrets here. */
  headers?: Record<string, string | undefined | null>;
  /** URL-encoded form body for POST endpoints (e.g. favourites). */
  body?: Record<string, string | number | boolean | undefined | null>;
  entityType?: string;
  externalId?: string;
  timeoutMs?: number;
  /** Persist raw response (default true). */
  capture?: boolean;
  /** Skip metrics increment (tests). */
  skipMetrics?: boolean;
  /** Incoming request token header — overrides CMS/env token when set. */
  requestToken?: string;
  /** Return upstream JSON envelope unchanged (for public /api/v1 routes). */
  returnRawBody?: boolean;
};

export type RugbyDataApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  message?: string;
  responseTimeMs: number;
  endpoint: string;
  payloadHash?: string;
  rawResponseId?: string;
  errorMessage?: string;
  rawBody?: unknown;
};

function buildQuery(query?: RugbyDataApiRequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Remove secrets from request params before storage/logging. */
export function sanitizeRequestParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("password") ||
      lower.includes("authorization") ||
      lower.includes("api_key") ||
      lower.includes("apikey") ||
      lower.includes("secret")
    ) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Server-only Rugby Data API client.
 * Never logs or returns the API token.
 */
export async function rugbyDataApiFetch<T = unknown>(
  options: RugbyDataApiRequestOptions,
): Promise<RugbyDataApiResult<T>> {
  const baseUrl = await resolveRugbyDataApiBaseUrl();
  const token = options.requestToken?.trim() || (await resolveRugbyDataApiToken());
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const endpoint = `${path}${buildQuery(options.query)}`;
  const url = `${baseUrl}${endpoint}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
  };
  if (token) {
    headers.token = token;
  }
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value == null || value === "") continue;
      headers[key] = String(value);
    }
  }

  const method = options.method ?? "GET";
  let requestBody: string | undefined;
  if (method === "POST" && options.body) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(options.body)) {
      if (value == null) continue;
      form.set(key, String(value));
    }
    requestBody = form.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  let lastError = "";
  let status = 0;
  let responseTimeMs = 0;
  let body: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
        cache: "no-store",
      });
      responseTimeMs = Date.now() - started;
      status = res.status;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text.slice(0, 2000) };
      }

      if (res.ok) {
        break;
      }

      lastError = `HTTP ${res.status}`;
      // Retry transient errors
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      break;
    } catch (e) {
      responseTimeMs = Date.now() - started;
      lastError = e instanceof Error ? e.message : "Request failed";
      // Never include URL with token — token is header-only, URL is safe
      if (attempt < MAX_RETRIES) {
        await sleep(250 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const ok = status >= 200 && status < 300;
  const envelope = body as { status?: number; message?: string; data?: T } | null;
  const data =
    ok && envelope && typeof envelope === "object" && "data" in envelope
      ? (envelope.data as T)
      : ok
        ? (body as T)
        : null;

  const payloadHash = hashPayload(body);
  let rawResponseId: string | undefined;

  if (options.capture !== false) {
    try {
      const { captureRawResponse } = await import("./provider-raw-response-service");
      rawResponseId = await captureRawResponse({
        provider: PROVIDER_RUGBY_DATA,
        endpoint,
        entityType: options.entityType,
        externalId: options.externalId != null ? String(options.externalId) : undefined,
        requestParams: sanitizeRequestParams({
          path: options.path,
          ...(options.query ?? {}),
        }),
        responseStatus: status || null,
        responseTimeMs,
        payloadHash,
        importStatus: ok ? "captured" : "error",
        errorMessage: ok ? null : lastError || `HTTP ${status}`,
        payload: body,
      });
    } catch {
      // Capture must not break reads
    }
  }

  if (!options.skipMetrics) {
    try {
      const { recordProviderRequestMetric } = await import("./data-integration-metrics-service");
      await recordProviderRequestMetric({
        provider: PROVIDER_RUGBY_DATA,
        ok,
        responseTimeMs,
        errorMessage: ok ? null : lastError || `HTTP ${status}`,
      });
    } catch {
      // Metrics must not break reads
    }
  }

  return {
    ok,
    status,
    data,
    message: envelope && typeof envelope === "object" ? envelope.message : undefined,
    responseTimeMs,
    endpoint,
    payloadHash,
    rawResponseId,
    errorMessage: ok ? undefined : lastError || `HTTP ${status}`,
    ...(options.returnRawBody ? { rawBody: body } : {}),
  };
}

export async function fetchRugbyDataTeams(query?: string) {
  return rugbyDataApiFetch<unknown[]>({
    path: "/api/v1/rugby-union/teams",
    query: query ? { q: query } : undefined,
    entityType: "team",
  });
}

/** Daily match list nested by tournament (Planet Rugby /fixtures-style feed). */
export async function fetchRugbyDataMatchesByDate(
  date: string,
  type: "all" | "live" | "finished" | "fixtures" = "all",
) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/matches",
    query: { type, date },
    entityType: "match",
    externalId: date,
  });
}

export async function fetchRugbyDataLeague(leagueId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/league/${leagueId}/header`,
    entityType: "competition",
    externalId: String(leagueId),
  });
}

export async function fetchRugbyDataLeagueTeams(leagueId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/league/${leagueId}/teams`,
    entityType: "team",
    externalId: String(leagueId),
  });
}

export async function fetchRugbyDataLeagueMatches(
  leagueId: string | number,
  matchType: "finished" | "fixtures" | "all" = "finished",
) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/league/${leagueId}/matches`,
    query: { match_type: matchType },
    entityType: "match",
    externalId: String(leagueId),
  });
}

export async function fetchRugbyDataLeagueTable(leagueId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/league/${leagueId}/table`,
    entityType: "competition",
    externalId: String(leagueId),
  });
}

export async function fetchRugbyDataMatchInfo(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/info`,
    entityType: "match",
    externalId: String(matchId),
  });
}

export async function fetchRugbyDataMatchDetail(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/detail`,
    entityType: "match",
    externalId: String(matchId),
  });
}

export async function fetchRugbyDataMatchLineup(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/lineup`,
    entityType: "match",
    externalId: String(matchId),
  });
}

export async function fetchRugbyDataMatchTeamStats(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/stat`,
    entityType: "match",
    externalId: String(matchId),
  });
}

export async function fetchRugbyDataMatchPlayerStats(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/player-stat`,
    entityType: "match",
    externalId: String(matchId),
  });
}

export async function fetchRugbyDataMatchTable(matchId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/match/${matchId}/table`,
    query: { type: "all" },
    entityType: "match",
    externalId: String(matchId),
  });
}

/** Football-module equivalent. Rugby Union docs omit Player Detail; probe and ignore 404s. */
export async function fetchRugbyDataPlayerDetail(playerId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/player/${playerId}/detail`,
    entityType: "player",
    externalId: String(playerId),
  });
}

export async function fetchRugbyDataPlayerInfo(playerId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/player/${playerId}/info`,
    entityType: "player",
    externalId: String(playerId),
  });
}

export async function fetchRugbyDataMatchesCount(date: string) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/matches/count",
    query: { date },
    entityType: "match",
    externalId: date,
  });
}

export async function fetchRugbyDataCountries() {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/countries/list",
    entityType: "country",
  });
}

export async function fetchRugbyDataCountryLeagues(query = "") {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/country/leagues",
    query: { q: query },
    entityType: "competition",
  });
}

export async function fetchRugbyDataNewsLeagues() {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/news/leagues",
    entityType: "competition",
  });
}

export async function fetchRugbyDataSearch(query: string) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/search",
    query: { q: query },
    entityType: "search",
    externalId: query,
  });
}

export async function fetchRugbyDataLeagueNews(leagueId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/league/${leagueId}/news`,
    entityType: "competition",
    externalId: String(leagueId),
  });
}

export async function fetchRugbyDataTeamMatches(
  teamId: string | number,
  type: "finished" | "fixtures" | "all" = "finished",
  timezone?: string,
) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/team/${teamId}/matches`,
    query: { type },
    headers: timezone ? { timezone } : undefined,
    entityType: "match",
    externalId: String(teamId),
  });
}

export async function fetchRugbyDataTeamHeader(teamId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/team/${teamId}/header`,
    entityType: "team",
    externalId: String(teamId),
  });
}

export async function fetchRugbyDataTeamNews(teamId: string | number) {
  return rugbyDataApiFetch({
    path: `/api/v1/rugby-union/team/${teamId}/news`,
    entityType: "team",
    externalId: String(teamId),
  });
}

export async function fetchRugbyDataFavourites(fcmToken: string, timezone?: string) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/get-favourites",
    query: { fcm_token: fcmToken },
    headers: timezone ? { timezone } : undefined,
    entityType: "favourite",
    externalId: fcmToken,
  });
}

export async function fetchRugbyDataFavouritesCount(fcmToken: string, timezone?: string) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/favourite/count",
    query: { fcm_token: fcmToken },
    headers: timezone ? { timezone } : undefined,
    entityType: "favourite",
    externalId: fcmToken,
  });
}

export async function fetchRugbyDataMyMatches(
  fcmToken: string,
  options?: { matchIds?: Array<string | number>; timezone?: string },
) {
  const query: Record<string, string> = { fcm_token: fcmToken };
  if (options?.matchIds?.length) {
    query["matches[]"] = options.matchIds.map(String).join(",");
  }
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/my-matches",
    query,
    headers: options?.timezone ? { timezone: options.timezone } : undefined,
    entityType: "match",
    externalId: fcmToken,
  });
}

export async function updateRugbyDataFavourite(options: {
  fcmToken: string;
  id: string | number;
  type: "match" | "team" | "league";
  isSave: boolean;
  timezone?: string;
}) {
  return rugbyDataApiFetch({
    path: "/api/v1/rugby-union/favourite",
    method: "POST",
    body: {
      fcm_token: options.fcmToken,
      id: options.id,
      type: options.type,
      is_save: options.isSave ? 1 : 0,
    },
    headers: options.timezone ? { timezone: options.timezone } : undefined,
    entityType: "favourite",
    externalId: String(options.id),
  });
}

export async function testRugbyDataApiConnection(): Promise<{
  ok: boolean;
  message: string;
  baseUrl: string;
  responseTimeMs: number;
}> {
  const baseUrl = await resolveRugbyDataApiBaseUrl();
  const result = await rugbyDataApiFetch({
    path: "/api/v1/rugby-union/teams",
    entityType: "team",
    capture: true,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.errorMessage ?? "Connection failed",
      baseUrl,
      responseTimeMs: result.responseTimeMs,
    };
  }

  const count = Array.isArray(result.data) ? result.data.length : undefined;
  return {
    ok: true,
    message:
      count != null
        ? `Connected — teams endpoint returned ${count} records.`
        : "Connected — teams endpoint responded OK.",
    baseUrl,
    responseTimeMs: result.responseTimeMs,
  };
}
