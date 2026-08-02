import type { ParsedTeamMatchStats } from "@rugby365/import-sdk";
import type { RugbyDataListedMatch } from "./rugby-data-day-sync";

export type RugbyDataLeagueCatalogEntry = {
  id: number;
  name: string;
  slug?: string | null;
  season?: string | null;
  country?: string | null;
  categoryId?: number | null;
  source: "country_leagues" | "news_leagues";
};

export type RugbyDataLeagueTeam = {
  id: number;
  name: string;
  slug?: string | null;
  groupLabel?: string | null;
};

export type RugbyDataTableRow = {
  teamId: number;
  teamName: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  draw: number;
  points: number;
  form?: string | null;
  group?: string | null;
};

export type RugbyDataPlayerStatRow = {
  playerId: number;
  playerName: string;
  isHome: boolean;
  stats: Record<string, number>;
};

const IMPORT_DELAY_MS = Number(process.env.RUGBY_DATA_IMPORT_DELAY_MS ?? 300);
const IMPORT_CONCURRENCY = Math.max(
  1,
  Math.min(10, Number(process.env.RUGBY_DATA_IMPORT_CONCURRENCY ?? 3)),
);

export function rugbyDataImportDelayMs(): number {
  return IMPORT_DELAY_MS;
}

export function rugbyDataImportConcurrency(): number {
  return IMPORT_CONCURRENCY;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttleRugbyDataImport(): Promise<void> {
  await sleep(rugbyDataImportDelayMs());
}

/** Flatten `/league/:id/matches` date-grouped payload. */
export function flattenRugbyDataLeagueMatches(
  data: unknown,
  leagueMeta?: { id?: number | string; name?: string; season?: string },
): RugbyDataListedMatch[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataListedMatch[] = [];
  for (const group of data) {
    if (!group || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;
    const dateKey = typeof g.d === "string" ? g.d : null;
    const matches = Array.isArray(g.matches) ? g.matches : [];
    for (const raw of matches) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as RugbyDataListedMatch & {
        tournament?: { id?: number; nm?: string; sg?: string; sea?: string };
      };
      if (m.id == null) continue;
      const tournament = m.tournament;
      out.push({
        ...m,
        dt: m.dt ?? (dateKey ? `${dateKey} 00:00:00` : m.dt),
        leagueId: tournament?.id ?? leagueMeta?.id ?? m.tournament_id ?? m.leagueId,
        league: tournament?.nm ?? leagueMeta?.name ?? m.league,
        sea: tournament?.sea ?? leagueMeta?.season ?? m.sea,
      });
    }
  }
  return out;
}

export function flattenRugbyDataLeagueTeams(data: unknown): RugbyDataLeagueTeam[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataLeagueTeam[] = [];
  const seen = new Set<number>();
  for (const group of data) {
    if (!group || typeof group !== "object") continue;
    const g = group as { label?: string; teams?: Array<{ id?: number; name?: string; sg?: string }> };
    const label = g.label ?? null;
    for (const team of g.teams ?? []) {
      if (team?.id == null || !team.name) continue;
      if (seen.has(team.id)) continue;
      seen.add(team.id);
      out.push({
        id: team.id,
        name: team.name,
        slug: team.sg ?? null,
        groupLabel: label,
      });
    }
  }
  return out;
}

export function flattenRugbyDataLeagueTable(data: unknown): RugbyDataTableRow[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataTableRow[] = [];
  for (const group of data) {
    const rows = Array.isArray(group) ? group : [group];
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const teamId = Number(row.tid);
      const teamName = typeof row.tnm === "string" ? row.tnm : "";
      if (!Number.isFinite(teamId) || !teamName) continue;
      const form = Array.isArray(row.LFM) ? (row.LFM as string[]).join("") : null;
      out.push({
        teamId,
        teamName,
        rank: Number(row.pos ?? row.plc ?? 0) || 0,
        played: Number(row.mt ?? 0) || 0,
        won: Number(row.wo ?? 0) || 0,
        lost: Number(row.lo ?? 0) || 0,
        draw: Number(row.dr ?? 0) || 0,
        points: Number(row.pts ?? 0) || 0,
        form,
        group: typeof row.grp === "string" ? row.grp : null,
      });
    }
  }
  return out;
}

function parseStatValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}

function readSideStat(section: unknown, key: string, side: "ht" | "at"): number {
  if (!section || typeof section !== "object") return 0;
  const row = (section as Record<string, unknown>)[key];
  if (!row || typeof row !== "object") return 0;
  return parseStatValue((row as Record<string, unknown>)[side]);
}

/** Parse Rugby Data `/match/:id/stat` into home/away team summaries. */
export function parseRugbyDataTeamStats(data: unknown): {
  home: ParsedTeamMatchStats;
  away: ParsedTeamMatchStats;
} {
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const summary = root["Match Summary"] ?? {};
  const attack = root.Attack ?? {};
  const defence = root.Defence ?? {};

  function build(side: "ht" | "at"): ParsedTeamMatchStats {
    const sections: Record<string, Record<string, number>> = {};
    for (const [sectionName, section] of Object.entries(root)) {
      if (!section || typeof section !== "object" || sectionName === "Match Summary") continue;
      const bucket: Record<string, number> = {};
      for (const [metric, values] of Object.entries(section as Record<string, unknown>)) {
        if (!values || typeof values !== "object") continue;
        bucket[metric] = parseStatValue((values as Record<string, unknown>)[side]);
      }
      if (Object.keys(bucket).length) sections[sectionName] = bucket;
    }

    return {
      tries: readSideStat(summary, "tries", side) || readSideStat(attack, "tries", side),
      conversions: readSideStat(summary, "goals", side) || readSideStat(attack, "goals", side),
      penalties: readSideStat(attack, "penalty_goals", side),
      dropGoals: readSideStat(summary, "drop_goals", side),
      carries: readSideStat(summary, "carries", side) || readSideStat(attack, "carries", side),
      metres: readSideStat(summary, "metres", side) || readSideStat(attack, "metres", side),
      tackles: readSideStat(summary, "tackles", side) || readSideStat(defence, "tackles", side),
      turnoversWon: 0,
      sections,
    };
  }

  return { home: build("ht"), away: build("at") };
}

const PLAYER_STAT_FIELD_MAP: Record<string, keyof ReturnType<typeof emptyPlayerPerf>> = {
  Goals: "points",
  Tries: "tries",
  Carries: "carries",
  Metres: "metresCarried",
  "Metres carried": "metresCarried",
  Tackles: "tacklesMade",
  "Tackles made": "tacklesMade",
  "Tackles completed": "tacklesCompleted",
  "Dominant tackles": "dominantTackles",
  "Turnovers won": "turnoversWon",
  "Try assists": "tryAssists",
  "Line breaks": "lineBreaks",
  "Defenders beaten": "defendersBeaten",
  Touches: "touches",
  "Post contact metres": "postContactMetres",
  Minutes: "minutesPlayed",
};

function emptyPlayerPerf() {
  return {
    minutesPlayed: 0,
    tries: 0,
    points: 0,
    carries: 0,
    metresCarried: 0,
    tacklesMade: 0,
    tacklesCompleted: 0,
    dominantTackles: 0,
    turnoversWon: 0,
    tryAssists: 0,
    lineBreaks: 0,
    defendersBeaten: 0,
    touches: 0,
    postContactMetres: 0,
    ruckArrivalEffectiveness: 0,
    extras: {} as Record<string, number>,
  };
}

/** Aggregate Rugby Data `/match/:id/player-stat` rows per player. */
export function parseRugbyDataPlayerStats(data: unknown): RugbyDataPlayerStatRow[] {
  if (!data || typeof data !== "object") return [];
  type Bucket = RugbyDataPlayerStatRow & {
    perf: ReturnType<typeof emptyPlayerPerf>;
  };
  const buckets = new Map<string, Bucket>();

  for (const [type, rows] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as {
        player_id?: number;
        value?: string;
        is_home?: number;
        player?: { id?: number; name?: string };
        type?: string;
      };
      const playerId = Number(row.player_id ?? row.player?.id);
      const playerName = row.player?.name ?? "";
      if (!Number.isFinite(playerId) || !playerName) continue;
      const key = String(playerId);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          playerId,
          playerName,
          isHome: row.is_home === 1,
          stats: {},
          perf: emptyPlayerPerf(),
        };
        buckets.set(key, bucket);
      }
      const value = parseStatValue(row.value);
      const statType = row.type ?? type;
      bucket.stats[statType] = (bucket.stats[statType] ?? 0) + value;

      const mapped = PLAYER_STAT_FIELD_MAP[statType];
      if (mapped && mapped in bucket.perf) {
        (bucket.perf as Record<string, number>)[mapped] =
          ((bucket.perf as Record<string, number>)[mapped] ?? 0) + value;
      } else {
        bucket.perf.extras[statType] = (bucket.perf.extras[statType] ?? 0) + value;
      }
    }
  }

  return [...buckets.values()].map(({ perf, ...rest }) => ({
    ...rest,
    stats: {
      ...rest.stats,
      ...perf.extras,
      Minutes: perf.minutesPlayed,
      Tries: perf.tries,
      Goals: perf.points,
      Carries: perf.carries,
      Metres: perf.metresCarried,
      "Tackles made": perf.tacklesMade,
      "Tackles completed": perf.tacklesCompleted,
      "Dominant tackles": perf.dominantTackles,
      "Turnovers won": perf.turnoversWon,
      "Try assists": perf.tryAssists,
      "Line breaks": perf.lineBreaks,
      "Defenders beaten": perf.defendersBeaten,
      Touches: perf.touches,
      "Post contact metres": perf.postContactMetres,
    },
  }));
}

export function parseRugbyDataKickoffIso(dt: string | null | undefined): string | null {
  if (!dt || typeof dt !== "string") return null;
  const trimmed = dt.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
