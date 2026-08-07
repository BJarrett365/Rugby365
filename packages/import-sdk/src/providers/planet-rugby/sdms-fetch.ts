const SDMS_BASE = "https://sdms.planetsport.com/api/rugby/union";

export type SdmsMatchDetail = {
  match_id: string;
  date: string;
  time: string;
  status: string;
  /** Live match clock minute from SDMS (may exceed 40 / 80 in stoppage). */
  minutes?: number;
  seconds?: number;
  competition_id?: string | number;
  competition_name: string;
  home_team_id?: string;
  home_team_name: string;
  home_team_slug: string;
  home_team_score: number;
  home_team_icon?: string;
  away_team_id?: string;
  away_team_name: string;
  away_team_slug: string;
  away_team_score: number;
  away_team_icon?: string;
  venue_name?: string;
  round?: string;
  referee?: Array<{ id: string; name: string; role: string }>;
  home_recent_results?: Record<string, unknown>;
  away_recent_results?: Record<string, unknown>;
  head_to_head?: Record<string, unknown>[];
  last_five_meetings?: Record<string, unknown>[];
  detail?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  key_events?: Array<{
    type: string;
    minute: number;
    second?: number;
    period?: string;
    team_id?: string;
    player_id?: string;
    player_name?: string;
    home_score?: number | null;
    away_score?: number | null;
  }>;
};

export type SdmsStandingRow = {
  team_name: string;
  team_slug: string;
  team_id?: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  points_diff: number;
  for?: number;
  against?: number;
  bonus_points?: number;
  try_bonus_points?: number;
  losing_bonus_points?: number;
  last_five?: string;
  season?: number;
};

export type SdmsSeasonInfo = {
  seasons: string[];
  currentSeason: string | null;
  activeSeason: string | null;
};

export type StandingView = "overall" | "home" | "away";

export type SdmsFixtureRow = {
  match_id: string;
  date: string;
  time: string;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_team_slug: string;
  away_team_slug: string;
  home_team_id?: string;
  away_team_id?: string;
  home_team_score?: number;
  away_team_score?: number;
  home_team_icon?: string;
  away_team_icon?: string;
  round?: string;
  venue?: string;
  competition_id?: string;
  competition_name?: string;
};

async function fetchJson<T>(url: string, timeoutMs = 20_000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Rugby365ImportSdk/0.1" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSdmsMatchDetail(
  matchId: string,
  opts?: { timeoutMs?: number },
): Promise<SdmsMatchDetail | null> {
  const json = await fetchJson<{ data: SdmsMatchDetail }>(
    `${SDMS_BASE}/match/${matchId}/detail`,
    opts?.timeoutMs,
  );
  return json?.data ?? null;
}

/** Previous meetings list used by Planet Rugby Match Centre Head-to-Head. */
export async function fetchSdmsPreviousMeetings(
  matchId: string,
  opts?: { timeoutMs?: number },
): Promise<Record<string, unknown>[]> {
  const json = await fetchJson<{
    data?: { previous_meetings?: Record<string, unknown>[] } | Record<string, unknown>[];
  }>(`${SDMS_BASE}/match/${matchId}/previous-meetings`, opts?.timeoutMs);
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.previous_meetings)) {
    return data.previous_meetings;
  }
  return [];
}

/** Competition H2H aggregates (wins / averages). Prefer over detail.head_to_head when present. */
export async function fetchSdmsHeadToHead(
  matchId: string,
  opts?: { timeoutMs?: number },
): Promise<Record<string, unknown>[]> {
  const json = await fetchJson<{
    data?: { head_to_head?: Record<string, unknown>[] } | Record<string, unknown>[];
  }>(`${SDMS_BASE}/match/${matchId}/h2h`, opts?.timeoutMs);
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.head_to_head)) {
    return data.head_to_head;
  }
  return [];
}

export async function fetchSdmsLineups(matchId: string, opts?: { timeoutMs?: number }) {
  const json = await fetchJson<{ data: import("./sdms-lineups").SdmsLineupsData }>(
    `${SDMS_BASE}/match/${matchId}/lineups`,
    opts?.timeoutMs,
  );
  return json?.data ?? null;
}

export async function fetchSdmsSeasons(compCode: string): Promise<SdmsSeasonInfo | null> {
  const json = await fetchJson<{
    data: { seasons?: string[]; active_season?: string; current_season?: string };
  }>(`${SDMS_BASE}/season/all?compCode=${encodeURIComponent(compCode)}`);
  if (!json?.data) return null;
  return {
    seasons: json.data.seasons ?? [],
    currentSeason: json.data.current_season ?? null,
    activeSeason: json.data.active_season ?? null,
  };
}

export async function fetchSdmsActiveSeason(compCode: string): Promise<string | null> {
  const info = await fetchSdmsSeasons(compCode);
  return info?.activeSeason ?? info?.currentSeason ?? null;
}

export async function fetchSdmsTable(
  compCode: string,
  season: string,
  view: StandingView = "overall",
): Promise<SdmsStandingRow[] | null> {
  const json = await fetchJson<{ data: SdmsStandingRow[] }>(
    `${SDMS_BASE}/standing/single-competition/${season}/${compCode}/${view}`,
  );
  return json?.data ?? null;
}

export async function fetchSdmsFixtures(
  compCode: string,
  season: string,
  count = 200,
): Promise<SdmsFixtureRow[] | null> {
  const json = await fetchJson<{ data: { data: SdmsFixtureRow[] } }>(
    `${SDMS_BASE}/match/${compCode}/all/fixtures/${season}/${count}`,
  );
  return json?.data?.data ?? null;
}

export async function fetchSdmsResults(
  compCode: string,
  season: string,
  count = 200,
): Promise<SdmsFixtureRow[] | null> {
  const json = await fetchJson<{ data: { data: SdmsFixtureRow[] } }>(
    `${SDMS_BASE}/match/${compCode}/all/results/${season}/${count}`,
  );
  return json?.data?.data ?? null;
}

/** Global fixtures across all competitions (Planet Rugby /fixtures page). */
export async function fetchSdmsGlobalFixtures(
  season: string,
  startDatetime: string,
  endDatetime: string,
  count = 1000,
): Promise<SdmsFixtureRow[] | null> {
  const qs = new URLSearchParams({
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    order: "asc",
  });
  const json = await fetchJson<{ data: { data: SdmsFixtureRow[] } }>(
    `${SDMS_BASE}/match/${season}/all/${count}?${qs}`,
  );
  return json?.data?.data ?? null;
}

export const DEFAULT_FIXTURES_TIMEZONE = "Europe/London";

type TzParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function tzParts(date: Date, timeZone: string): TzParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** YYYY-MM-DD for a UTC instant in the given IANA timezone (Planet Rugby fixtures grouping). */
export function calendarDateInTimezone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** UTC instant when wall clock hits dateKey+time in IANA timeZone. */
export function utcInstantFromZonedWallClock(dateKey: string, time: string, timeZone: string): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss);
  for (let i = 0; i < 3; i++) {
    const parts = tzParts(new Date(utcMs), timeZone);
    const targetMs = Date.UTC(y, mo - 1, d, hh, mm, ss);
    const actualMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    utcMs += targetMs - actualMs;
  }
  return new Date(utcMs);
}

function formatSdmsDatetime(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/(\.\d+)?Z$/, "");
}

export function sdmsDatetimeRangeForDate(
  dateKey: string,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
): { start: string; end: string } {
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(dateKey, "23:59:59", timeZone);
  return {
    start: formatSdmsDatetime(start),
    end: formatSdmsDatetime(end),
  };
}

export function sdmsStatusToMatchStatus(status: string): string {
  if (status === "Result") return "result";
  if (status === "Fixture") return "fixture";
  if (/half|first|second|extra|sudden/i.test(status)) return "live";
  return status.toLowerCase().replace(/\s+/g, "_");
}

export function combineKickoffIso(date: string, time: string): string {
  const t = time.includes("T") ? time : `${date}T${time}`;
  return t.endsWith("Z") ? t : `${t}Z`;
}

/** Wall-clock kickoff for schedule sorting (SDMS date + time, no timezone shift). */
export function sdmsScheduleKickoffIso(date: string, time: string): string {
  const clock = time.includes("T") ? time : `${date}T${time.split(".")[0]}`;
  return clock.endsWith("Z") ? clock : `${clock}Z`;
}

/** Keep rows whose UTC kickoff falls on dateKey in the display timezone (matches planetrugby.com/fixtures). */
export function filterSdmsRowsByCalendarDate(
  rows: SdmsFixtureRow[],
  dateKey: string,
  timeZone: string = DEFAULT_FIXTURES_TIMEZONE,
): SdmsFixtureRow[] {
  return rows.filter((row) => {
    const iso = sdmsScheduleKickoffIso(row.date, row.time);
    return calendarDateInTimezone(iso, timeZone) === dateKey;
  });
}

export function sdmsRowDisplayDate(row: SdmsFixtureRow, timeZone: string = DEFAULT_FIXTURES_TIMEZONE): string {
  return calendarDateInTimezone(sdmsScheduleKickoffIso(row.date, row.time), timeZone);
}
