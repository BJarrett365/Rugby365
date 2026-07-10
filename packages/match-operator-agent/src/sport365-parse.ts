import type { MatchSnapshot, ProviderIncident } from "./types";
import { parseSport365Lineups } from "./sport365-lineups";

const SPORT365_HOST_RE = /(^|\.)sport365\.com$/i;
const RUGBY_MATCH_PATH_RE = /\/rugby-union\//i;

export function assertSport365RugbyMatchUrl(input: string): URL {
  const u = new URL(input.trim());
  if (u.protocol !== "https:") throw new Error("Sport365 URL must use https.");
  if (!SPORT365_HOST_RE.test(u.hostname)) throw new Error("Only sport365.com URLs are allowed.");
  if (!RUGBY_MATCH_PATH_RE.test(u.pathname)) throw new Error("URL must be a Sport365 rugby-union match page.");
  return u;
}

export function extractSport365MatchId(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const last = parts.at(-1) ?? "";
  if (/^\d+-\d+$/.test(last)) return last;
  throw new Error("Could not extract Sport365 match page id from URL.");
}

export function extractSport365NextDataJson(html: string): unknown | null {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Sport365 `match.start` is YYYYMMDDHHmmss (e.g. 20260620130000). */
export function parseSport365StartTimestamp(start: unknown): string | undefined {
  const n = asNumber(start);
  if (n === undefined) return undefined;
  const s = String(Math.floor(n)).padStart(14, "0");
  if (!/^\d{14}$/.test(s)) return undefined;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const mi = Number(s.slice(10, 12));
  const sec = Number(s.slice(12, 14));
  const dt = new Date(Date.UTC(y, mo, d, h, mi, sec));
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
}

export function slugHintFromSport365Url(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const namePart = parts.at(-2) ?? "";
  if (namePart.includes("-vs-")) {
    return namePart.replace(/-vs-/g, "-v-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  }
  return namePart.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function sport365StatusLabel(statusCode?: number, statusText?: string): string {
  const txt = statusText?.trim() ?? "";
  if (statusCode === 6 || /^FT$/i.test(txt) || /full.?time|finished/i.test(txt)) return "full_time";
  if (/^HT$|half.?time/i.test(txt) || statusCode === 3) return "half_time";
  if (statusCode === 1 || /^NS$|not.?started/i.test(txt)) return "not_started";
  if (txt) return txt.toLowerCase().replace(/\s+/g, "_");
  return "unknown";
}

function mapIncidentType(type: number): string {
  switch (type) {
    case 34:
      return "try";
    case 35:
      return "conversion";
    case 143:
      return "conversion_missed";
    case 10:
      return "card";
    case 1:
      return "substitution";
    case 4:
      return "penalty_goal";
    case 5:
      return "drop_goal";
    default:
      return `provider_type_${type}`;
  }
}

function parseIncidents(
  incs: unknown,
  homeTeam: string,
  awayTeam: string,
): ProviderIncident[] {
  if (!isRecord(incs)) return [];
  const rows: ProviderIncident[] = [];
  for (const periodEvents of Object.values(incs)) {
    if (!isRecord(periodEvents)) continue;
    for (const minuteEvents of Object.values(periodEvents)) {
      if (!Array.isArray(minuteEvents)) continue;
      for (const raw of minuteEvents) {
        if (!isRecord(raw)) continue;
        const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? "");
        const minute = asNumber(raw.min) ?? 0;
        const minutePlus = asNumber(raw.min_plus ?? raw.inj_time);
        const type = asNumber(raw.type) ?? -1;
        const teamPos = asNumber(raw.pos) ?? 0;
        const teamName = teamPos === 0 ? homeTeam : awayTeam;
        const playerName = typeof raw.pl_name === "string" ? raw.pl_name.trim() : undefined;
        const playerProviderId = typeof raw.pl_id === "string" ? raw.pl_id.trim() : undefined;
        const playerNameOut = typeof raw.pl_name_o === "string" ? raw.pl_name_o.trim() : undefined;
        const playerProviderIdOut = typeof raw.pl_id_o === "string" ? raw.pl_id_o.trim() : undefined;
        const scoreArr = Array.isArray(raw.score) ? raw.score : [];
        const homeScore = asNumber(scoreArr[0]) ?? 0;
        const awayScore = asNumber(scoreArr[1]) ?? 0;
        rows.push({
          id,
          minute,
          minutePlus,
          type,
          teamPos,
          teamName,
          playerName,
          playerProviderId,
          playerNameOut,
          playerProviderIdOut,
          scoreAfter: [homeScore, awayScore],
        });
      }
    }
  }
  return rows.sort((a, b) => {
    const ak = a.minute * 100 + (a.minutePlus ?? 0);
    const bk = b.minute * 100 + (b.minutePlus ?? 0);
    return ak - bk || a.id.localeCompare(b.id);
  });
}

export function parseSport365MatchSnapshotFromHtml(html: string, sourceUrl: string): MatchSnapshot | null {
  const nextData = extractSport365NextDataJson(html);
  if (!nextData || !isRecord(nextData)) return null;
  const pageProps =
    isRecord(nextData.props) && isRecord(nextData.props.pageProps) ? nextData.props.pageProps : null;
  const match = pageProps && isRecord(pageProps.match) ? pageProps.match : null;
  if (!match) return null;

  const teams = Array.isArray(match.teams) ? match.teams : [];
  const home = teams.find((t) => isRecord(t) && t.pos === 0) ?? teams[0];
  const away = teams.find((t) => isRecord(t) && t.pos === 1) ?? teams[1];
  const homeTeam = isRecord(home) && typeof home.name === "string" ? home.name.trim() : "";
  const awayTeam = isRecord(away) && typeof away.name === "string" ? away.name.trim() : "";
  const homeTeamProviderId =
    isRecord(home) && typeof home.id === "string" ? home.id.trim() : undefined;
  const awayTeamProviderId =
    isRecord(away) && typeof away.id === "string" ? away.id.trim() : undefined;
  if (!homeTeam || !awayTeam) return null;

  const scoreArr = Array.isArray(match.score) ? match.score : [];
  const homeScore = asNumber(scoreArr[0]) ?? 0;
  const awayScore = asNumber(scoreArr[1]) ?? 0;
  const statusCode = asNumber(match.status);
  const statusText = typeof match.status_txt === "string" ? match.status_txt.trim() : undefined;
  const statusLabel = sport365StatusLabel(statusCode, statusText);
  const competition = typeof match.c_name === "string" ? match.c_name.trim() : undefined;
  const competitionProviderId =
    typeof match.c_id === "string" ? match.c_id.trim() : undefined;
  const stageProviderId = typeof match.st_id === "string" ? match.st_id.trim() : undefined;
  const stageName = typeof match.st_name === "string" ? match.st_name.trim() : undefined;
  const elapsedSeconds = asNumber(match.elapsed_t);
  const kickoffAt = parseSport365StartTimestamp(match.start);
  const venueRaw = isRecord(match.venue) ? match.venue : null;
  const venueCapacity = venueRaw ? asNumber(venueRaw.capacity) : undefined;
  const venue =
    venueRaw && (typeof venueRaw.name === "string" || typeof venueRaw.city === "string")
      ? {
          name: typeof venueRaw.name === "string" ? venueRaw.name.trim() : undefined,
          city: typeof venueRaw.city === "string" ? venueRaw.city.trim() : undefined,
          capacity: venueCapacity,
        }
      : undefined;
  const matchId = extractSport365MatchId(sourceUrl);
  const incidents = parseIncidents(match.incs, homeTeam, awayTeam);
  const lineups = parseSport365Lineups(
    match.lineup,
    homeTeam,
    awayTeam,
    homeTeamProviderId,
    awayTeamProviderId,
  );

  return {
    matchId,
    sourceUrl,
    homeTeam,
    awayTeam,
    homeTeamProviderId,
    awayTeamProviderId,
    homeScore,
    awayScore,
    statusCode,
    statusText,
    statusLabel,
    competition,
    competitionProviderId,
    stageProviderId,
    stageName,
    kickoffAt,
    venue,
    elapsedSeconds,
    lineups,
    incidents,
    polledAt: new Date().toISOString(),
  };
}

export function incidentToEventType(incident: ProviderIncident): string {
  return mapIncidentType(incident.type);
}

export async function fetchSport365MatchPageHtml(sourceUrl: string): Promise<string> {
  const url = assertSport365RugbyMatchUrl(sourceUrl).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Rugby365MatchOperatorAgent/0.1",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sport365 HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}
