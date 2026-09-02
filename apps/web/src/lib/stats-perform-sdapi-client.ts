/**
 * Stats Perform Sports Data API (SDAPI) — Rugby Union.
 * Docs: https://documentation.statsperform.com/docs/rh/sdapi/Topics/rugbyunion/Index.htm
 *
 * Live feeds use an outlet auth key in the path:
 *   GET https://api.performfeeds.com/rugbyuniondata/{feed}/{outletAuthKey}?_fmt=json&_rt=b
 * Documentation login is HTTP basic auth on documentation.statsperform.com — it is not API access.
 */

export const DEFAULT_STATS_PERFORM_SDAPI_BASE_URL = "https://api.performfeeds.com";
export const STATS_PERFORM_DOCS_INDEX_URL =
  "https://documentation.statsperform.com/docs/rh/sdapi/Topics/rugbyunion/Index.htm";
export const STATS_PERFORM_SWAGGER_URL =
  "https://documentation.statsperform.com/Swagger/index.html?sport=rugbyunion";

/** Sample outlet key published on every Rugby Union feed page. */
export const STATS_PERFORM_DOCS_SAMPLE_OUTLET_AUTH_KEY = "1vmmaetzoxkgg1qf6pkpfmku0k";
/** Top 14 fixture used in the match-events / match-stats examples. */
export const STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID = "6qdft9iho5xwdm1uf8l2uvcb8";
/** Rugby Europe Championship 2023 calendar used in the squads example. */
export const STATS_PERFORM_DOCS_SAMPLE_TOURNAMENT_CALENDAR_ID = "dhnum80emrzsvj3hlu2xxpn2s";
/** Top 14 2024/25 calendar taken from the documented Montpellier v Bordeaux fixture. */
export const STATS_PERFORM_TOP14_2024_25_CALENDAR_ID = "bls4m5a9mrw5u17qy2ghftfdg";

const FEED_RESOURCE = "rugbyuniondata";

export type StatsPerformSdapiAuth = {
  outletAuthKey: string;
  baseUrl?: string;
};

export type StatsPerformDocsAuth = {
  username: string;
  password: string;
};

export type StatsPerformMatchSummary = {
  id: string;
  date: string | null;
  time: string | null;
  status: string | null;
  competition: string | null;
  home: string | null;
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type StatsPerformSquadSummary = {
  contestantName: string;
  playerCount: number;
};

export type StatsPerformFeedProbe = {
  feed: string;
  ok: boolean;
  status: number;
  errorCode?: string;
  summary: string;
};

export type StatsPerformApiTestResult = {
  ok: boolean;
  message: string;
  status: number;
  responseTimeMs: number;
  calendars?: number;
  matches?: StatsPerformMatchSummary[];
  squads?: StatsPerformSquadSummary[];
  competition?: string | null;
  tournamentCalendar?: string | null;
  feeds?: StatsPerformFeedProbe[];
  errorCode?: string;
};

function sdapiErrorMessage(code: string | undefined): string {
  switch (code) {
    case "10010":
      return "Invalid outlet authentication key.";
    case "10203":
      return "The match feed needs a date range, live flag, or fixture id.";
    case "10300":
      return "Outlet key missing, or the Stats Perform service is unavailable.";
    case "10313":
      return "This outlet is not authorised for the Rugby Union SDAPI feed.";
    default:
      return code ? `Stats Perform error ${code}.` : "Stats Perform request failed.";
  }
}

function contestantName(
  contestants: unknown,
  position: "home" | "away",
): string | null {
  if (!Array.isArray(contestants)) return null;
  const match = contestants.find((row) => {
    if (!row || typeof row !== "object") return false;
    const pos = String((row as { position?: unknown }).position ?? "").toLowerCase();
    return pos === position;
  }) as { name?: unknown } | undefined;
  if (match?.name && typeof match.name === "string") return match.name;
  const byIndex = contestants[position === "home" ? 0 : 1] as { name?: unknown } | undefined;
  return typeof byIndex?.name === "string" ? byIndex.name : null;
}

function totalScore(liveData: unknown, side: "home" | "away"): number | null {
  if (!liveData || typeof liveData !== "object") return null;
  const details = (liveData as { matchDetails?: { scores?: { total?: Record<string, unknown> } } })
    .matchDetails;
  const total = details?.scores?.total;
  if (!total) return null;
  const key = side === "home" ? "home" : "away";
  const value = total[key] ?? total[`${key}Score`] ?? total[side];
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function summariseStatsPerformMatches(payload: unknown, limit = 12): StatsPerformMatchSummary[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(root.matches)
    ? root.matches
    : Array.isArray(root.match)
      ? root.match
      : root.match && typeof root.match === "object"
        ? [root.match]
        : root.matchInfo
          ? [root]
          : [];
  const out: StatsPerformMatchSummary[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as {
      matchInfo?: {
        id?: string;
        date?: string;
        time?: string;
        contestant?: unknown;
        contestants?: unknown;
        competition?: { name?: string };
      };
      liveData?: {
        matchDetails?: { matchStatus?: string; scores?: { total?: Record<string, unknown> } };
      };
    };
    const info = rec.matchInfo ?? {};
    const status = rec.liveData?.matchDetails?.matchStatus ?? null;
    const contestants = info.contestants ?? info.contestant;
    out.push({
      id: String(info.id ?? ""),
      date: info.date ?? null,
      time: info.time ?? null,
      status,
      competition: info.competition?.name ?? null,
      home: contestantName(contestants, "home"),
      away: contestantName(contestants, "away"),
      homeScore: totalScore(rec.liveData, "home"),
      awayScore: totalScore(rec.liveData, "away"),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function summariseStatsPerformSquads(payload: unknown): {
  competition: string | null;
  tournamentCalendar: string | null;
  squads: StatsPerformSquadSummary[];
} {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const competition =
    root.competition && typeof root.competition === "object"
      ? String((root.competition as { name?: unknown }).name ?? "") || null
      : null;
  const calendar =
    root.tournamentCalendar && typeof root.tournamentCalendar === "object"
      ? String(
          (root.tournamentCalendar as { value?: unknown; name?: unknown }).value ??
            (root.tournamentCalendar as { name?: unknown }).name ??
            "",
        ) || null
      : null;
  const raw = Array.isArray(root.squad) ? root.squad : Array.isArray(root.squads) ? root.squads : [];
  const squads: StatsPerformSquadSummary[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { contestantName?: unknown; person?: unknown; player?: unknown };
    const persons = Array.isArray(rec.person) ? rec.person : Array.isArray(rec.player) ? rec.player : [];
    squads.push({
      contestantName: typeof rec.contestantName === "string" ? rec.contestantName : "Unknown",
      playerCount: persons.length,
    });
  }
  return { competition, tournamentCalendar: calendar, squads };
}

function countCalendars(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const root = payload as Record<string, unknown>;
  const list =
    (Array.isArray(root.tournamentCalendars) && root.tournamentCalendars) ||
    (Array.isArray(root.tournamentCalendar) && root.tournamentCalendar) ||
    (Array.isArray(root.calendars) && root.calendars) ||
    [];
  return list.length;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "Rugby365CMS/1.0 (Stats Perform SDAPI)",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, text, json, responseTimeMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function testStatsPerformDocsLogin(input: StatsPerformDocsAuth): Promise<{
  ok: boolean;
  status: number;
  message: string;
  responseTimeMs: number;
}> {
  const username = input.username.trim();
  const password = input.password;
  if (!username || !password) {
    return {
      ok: false,
      status: 0,
      message: "Documentation username and password are required.",
      responseTimeMs: 0,
    };
  }
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  try {
    const result = await fetchJson(
      STATS_PERFORM_DOCS_INDEX_URL,
      {
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "text/html",
          "User-Agent": "Rugby365CMS/1.0 (Stats Perform docs check)",
        },
      },
      20_000,
    );
    const html = result.text ?? "";
    const ok = result.res.ok && /rugbyunion|rugby union|sdapi/i.test(html);
    return {
      ok,
      status: result.res.status,
      responseTimeMs: result.responseTimeMs,
      message: ok
        ? "Documentation login works — Rugby Union SDAPI index loaded."
        : `Documentation login failed (HTTP ${result.res.status}).`,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      responseTimeMs: 0,
      message: aborted ? "Documentation login timed out." : "Documentation login request failed.",
    };
  }
}

function feedUrl(baseUrl: string, feed: string, outletAuthKey: string, query: Record<string, string>): string {
  const root = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ _fmt: "json", _rt: "b", ...query });
  return `${root}/${FEED_RESOURCE}/${feed}/${encodeURIComponent(outletAuthKey)}?${params.toString()}`;
}

function feedAssetUrl(
  baseUrl: string,
  feed: string,
  outletAuthKey: string,
  assetId: string,
  query: Record<string, string> = {},
): string {
  const root = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ _fmt: "json", _rt: "b", ...query });
  return `${root}/${FEED_RESOURCE}/${feed}/${encodeURIComponent(outletAuthKey)}/${encodeURIComponent(assetId)}?${params.toString()}`;
}

function jsonErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const code = (payload as { errorCode?: unknown }).errorCode;
  return typeof code === "string" && code ? code : undefined;
}

async function probeFeed(
  feed: string,
  url: string,
): Promise<{ probe: StatsPerformFeedProbe; json: unknown; status: number; responseTimeMs: number }> {
  const result = await fetchJson(url, {}, 25_000);
  const errorCode = jsonErrorCode(result.json);
  return {
    json: result.json,
    status: result.res.status,
    responseTimeMs: result.responseTimeMs,
    probe: {
      feed,
      ok: result.res.ok && !errorCode,
      status: result.res.status,
      errorCode,
      summary: result.res.ok && !errorCode
        ? "Data returned."
        : `${sdapiErrorMessage(errorCode)} HTTP ${result.res.status}.`,
    },
  };
}

export async function testStatsPerformSdapiConnection(
  input: StatsPerformSdapiAuth,
): Promise<StatsPerformApiTestResult> {
  const outletAuthKey =
    input.outletAuthKey.trim() || STATS_PERFORM_DOCS_SAMPLE_OUTLET_AUTH_KEY;
  const baseUrl = (input.baseUrl?.trim() || DEFAULT_STATS_PERFORM_SDAPI_BASE_URL).replace(/\/$/, "");

  try {
    const started = Date.now();
    const [match, matchStats, matchEvent, squads, calendar] = await Promise.all([
      probeFeed(
        "match",
        feedUrl(baseUrl, "match", outletAuthKey, { fx: STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID }),
      ),
      probeFeed(
        "matchstats",
        feedAssetUrl(baseUrl, "matchstats", outletAuthKey, STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID),
      ),
      probeFeed(
        "matchevent",
        feedAssetUrl(baseUrl, "matchevent", outletAuthKey, STATS_PERFORM_DOCS_SAMPLE_FIXTURE_ID),
      ),
      probeFeed(
        "squads",
        feedUrl(baseUrl, "squads", outletAuthKey, {
          tmcl: STATS_PERFORM_DOCS_SAMPLE_TOURNAMENT_CALENDAR_ID,
        }),
      ),
      probeFeed("tournamentcalendar", feedUrl(baseUrl, "tournamentcalendar", outletAuthKey, {})),
    ]);

    const matches = [
      ...summariseStatsPerformMatches(match.json),
      ...summariseStatsPerformMatches(matchStats.json),
    ].filter((row, index, all) => row.id && all.findIndex((item) => item.id === row.id) === index);

    const squadSummary = summariseStatsPerformSquads(squads.json);
    const working = [match, matchStats, matchEvent, squads].filter((row) => row.probe.ok);
    const feeds = [match, matchStats, matchEvent, squads, calendar].map((row) => {
      if (row === match && matches[0]) {
        const m = matches[0];
        return {
          ...row.probe,
          summary: `${m.home ?? "Home"} ${m.homeScore ?? "–"}–${m.awayScore ?? "–"} ${m.away ?? "Away"} (${m.competition ?? "n/a"})`,
        };
      }
      if (row === matchStats && row.probe.ok) {
        const live =
          row.json && typeof row.json === "object"
            ? (row.json as { liveData?: { lineUp?: unknown; card?: unknown; substitute?: unknown } }).liveData
            : undefined;
        const lineups = Array.isArray(live?.lineUp) ? live.lineUp.length : 0;
        const cards = Array.isArray(live?.card) ? live.card.length : 0;
        const subs = Array.isArray(live?.substitute) ? live.substitute.length : 0;
        return {
          ...row.probe,
          summary: `Line-ups ${lineups}, cards ${cards}, substitutions ${subs}.`,
        };
      }
      if (row === matchEvent && row.probe.ok) {
        return { ...row.probe, summary: "Time-coded match events returned." };
      }
      if (row === squads && row.probe.ok) {
        const players = squadSummary.squads.reduce((sum, item) => sum + item.playerCount, 0);
        return {
          ...row.probe,
          summary: `${squadSummary.squads.length} squads, ${players} players (${squadSummary.tournamentCalendar ?? "calendar"}).`,
        };
      }
      return row.probe;
    });

    const ok = working.length > 0;
    const sample = matches[0];
    const message = ok
      ? sample
        ? `Rugby Union SDAPI returned data — ${sample.home} ${sample.homeScore}–${sample.awayScore} ${sample.away} plus ${squadSummary.squads.length} documented squads.`
        : `Rugby Union SDAPI returned data on ${working.length} documented feed(s).`
      : `No authorised rugby feeds returned data. ${calendar.probe.summary}`;

    return {
      ok,
      status: ok ? 200 : calendar.status,
      responseTimeMs: Date.now() - started,
      calendars: countCalendars(calendar.json),
      matches,
      squads: squadSummary.squads,
      competition: sample?.competition ?? squadSummary.competition,
      tournamentCalendar: squadSummary.tournamentCalendar,
      feeds,
      errorCode: ok ? undefined : calendar.probe.errorCode,
      message,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      responseTimeMs: 0,
      message: aborted ? "Stats Perform SDAPI timed out." : "Stats Perform SDAPI request failed.",
    };
  }
}

const API_HEADERS = {
  Accept: "application/json",
  "Accept-Encoding": "identity",
  "User-Agent": "Rugby365CMS/1.0 (Stats Perform SDAPI)",
} as const;

export async function fetchStatsPerformSquadsFeed(input: {
  outletAuthKey?: string;
  baseUrl?: string;
  tournamentCalendarId: string;
}): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const outletAuthKey = input.outletAuthKey?.trim() || STATS_PERFORM_DOCS_SAMPLE_OUTLET_AUTH_KEY;
  const baseUrl = (input.baseUrl?.trim() || DEFAULT_STATS_PERFORM_SDAPI_BASE_URL).replace(/\/$/, "");
  const url = feedUrl(baseUrl, "squads", outletAuthKey, { tmcl: input.tournamentCalendarId });
  const result = await fetchJson(url, { headers: API_HEADERS }, 40_000);
  return { ok: result.res.ok, status: result.res.status, payload: result.json };
}

export async function fetchStatsPerformMatchStatsFeed(input: {
  outletAuthKey?: string;
  baseUrl?: string;
  fixtureId: string;
}): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const outletAuthKey = input.outletAuthKey?.trim() || STATS_PERFORM_DOCS_SAMPLE_OUTLET_AUTH_KEY;
  const baseUrl = (input.baseUrl?.trim() || DEFAULT_STATS_PERFORM_SDAPI_BASE_URL).replace(/\/$/, "");
  const url = feedAssetUrl(baseUrl, "matchstats", outletAuthKey, input.fixtureId);
  const result = await fetchJson(url, { headers: API_HEADERS }, 40_000);
  return { ok: result.res.ok, status: result.res.status, payload: result.json };
}
