/** Pure helpers for Rugby Data (P1) day score/event sync. */

export type RugbyDataListedMatch = {
  id: number | string;
  dt?: string | null;
  st?: string | null;
  cp?: string | null;
  ft?: string | null;
  ht?: string | null;
  cfs?: string | null;
  mins?: string | number | null;
  tournament_id?: number | string | null;
  leagueId?: number | string | null;
  league?: string | null;
  sea?: string | null;
  competitors?: {
    htid?: number | string | null;
    atid?: number | string | null;
    htn?: string | null;
    atn?: string | null;
  } | null;
};

export type RugbyDataInfoEvent = {
  ty?: string | null;
  mins?: number | string | null;
  isH?: number | boolean | null;
  pl?: { id?: number | string | null; name?: string | null } | null;
  sc?: string | null;
};

/** Flatten `/matches?date=` payload (array of leagues with nested matches). */
export function flattenRugbyDataDayMatches(data: unknown): RugbyDataListedMatch[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataListedMatch[] = [];
  for (const group of data) {
    if (!group || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;
    const matches = Array.isArray(g.matches) ? g.matches : [];
    for (const raw of matches) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as RugbyDataListedMatch;
      if (m.id == null) continue;
      out.push({
        ...m,
        leagueId: (g.id as number | string | undefined) ?? m.leagueId,
        league: typeof g.nm === "string" ? g.nm : m.league,
        sea: typeof g.sea === "string" ? g.sea : m.sea,
      });
    }
  }
  return out;
}

export function filterRugbyDataMatchesOnDate(
  matches: RugbyDataListedMatch[],
  dateKey: string,
): RugbyDataListedMatch[] {
  return matches.filter((m) => String(m.dt ?? "").slice(0, 10) === dateKey);
}

export function parseRugbyDataScore(score: string | null | undefined): {
  homeScore: number;
  awayScore: number;
} | null {
  if (!score || typeof score !== "string") return null;
  const m = score.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { homeScore: Number(m[1]), awayScore: Number(m[2]) };
}

export function rugbyDataStatusToFixtureStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "scheduled";
  if (
    s === "finished" ||
    s === "ft" ||
    s === "full time" ||
    s === "fulltime" ||
    s === "result" ||
    s === "result only" ||
    s === "final" ||
    s === "completed" ||
    s === "aet" ||
    s.includes("result only")
  ) {
    return "full_time";
  }
  if (s.includes("half") && (s.includes("time") || s === "ht")) return "half_time";
  if (
    s.includes("inprogress") ||
    s.includes("in progress") ||
    s.includes("live") ||
    s.includes("first") ||
    s.includes("second") ||
    s === "1h" ||
    s === "2h"
  ) {
    return "live";
  }
  if (s === "fixture" || s === "scheduled" || s === "not started" || s === "ns") return "scheduled";
  if (s.includes(" postpon") || s === "postponed") return "postponed";
  if (s.includes("cancel")) return "cancelled";
  return "scheduled";
}

export function rugbyDataEventTypeToMatchEvent(type: string | null | undefined): string | null {
  const t = (type ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "try") return "try";
  if (t === "conversion") return "conversion";
  if (t.includes("missed conversion")) return "conversion_missed";
  if (t === "penalty" || t === "penalty goal" || t.includes("penalty goal")) return "penalty_goal";
  if (t.includes("missed penalty")) return "penalty_missed";
  if (t.includes("drop")) return "drop_goal";
  if (t.includes("yellow")) return "yellow_card";
  if (t.includes("red")) return "red_card";
  if (t === "sub" || t.includes("substitut")) return "substitution";
  return null;
}

export function buildRugbyDataEventId(
  matchId: string | number,
  event: RugbyDataInfoEvent,
  index: number,
): string {
  const type = (event.ty ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "event";
  const minute = Number(event.mins);
  const mins = Number.isFinite(minute) ? minute : 0;
  const player = event.pl?.id != null ? String(event.pl.id) : "no-player";
  const side = event.isH === 1 || event.isH === true ? "h" : "a";
  return `rd:${matchId}:${type}:${mins}:${player}:${side}:${index}`;
}

export function teamNameKey(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function listedMatchIdentityKey(match: RugbyDataListedMatch): string | null {
  const date = String(match.dt ?? "").slice(0, 10);
  const home = teamNameKey(match.competitors?.htn);
  const away = teamNameKey(match.competitors?.atn);
  if (!date || !home || !away) return null;
  return `${date}:${home}:${away}`;
}
