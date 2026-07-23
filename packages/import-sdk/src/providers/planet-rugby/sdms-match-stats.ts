const SDMS_BASE = "https://sdms.planetsport.com/api/rugby/union";

export type SdmsMatchStatsBundle = {
  match_id: string;
  summary: Record<string, number>;
  possession: Record<string, number>;
  territory: Record<string, number>;
  attack: Record<string, number>;
  defence: Record<string, number>;
  kicking: Record<string, number>;
  rucks: Record<string, number>;
  set_piece: Record<string, number>;
};

/** Planet Rugby Detailed tabs + snapshot leader sources. */
export type SdmsPlayerStatCategory = "attack" | "defend" | "kicking" | "errors" | "carries";

export const SDMS_PLAYER_STAT_CATEGORIES: SdmsPlayerStatCategory[] = [
  "attack",
  "defend",
  "kicking",
  "errors",
  "carries",
];

export type SdmsPlayerStatRow = {
  player_id?: string;
  player_name?: string;
  minutes_played?: number;
  [key: string]: string | number | null | undefined;
};

export type SdmsPlayerStatsBundle = {
  match_id: string;
  detail_list: SdmsPlayerStatRow[];
};

export type SdmsMatchPlayerStats = {
  home: Record<SdmsPlayerStatCategory, SdmsPlayerStatsBundle | null>;
  away: Record<SdmsPlayerStatCategory, SdmsPlayerStatsBundle | null>;
};

function emptySideStats(): Record<SdmsPlayerStatCategory, SdmsPlayerStatsBundle | null> {
  return {
    attack: null,
    defend: null,
    kicking: null,
    errors: null,
    carries: null,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
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

export async function fetchSdmsMatchStats(matchId: string): Promise<SdmsMatchStatsBundle | null> {
  const json = await fetchJson<{ data: SdmsMatchStatsBundle }>(`${SDMS_BASE}/match/${matchId}/match-stats`);
  return json?.data ?? null;
}

export async function fetchSdmsPlayerStats(
  matchId: string,
  side: "home" | "away",
  category: SdmsPlayerStatCategory,
): Promise<SdmsPlayerStatsBundle | null> {
  const json = await fetchJson<{ data: SdmsPlayerStatsBundle }>(
    `${SDMS_BASE}/match/${matchId}/player-stats/${side}/${category}`,
  );
  return json?.data ?? null;
}

export async function fetchSdmsMatchPlayerStats(matchId: string): Promise<SdmsMatchPlayerStats> {
  const sides: Array<"home" | "away"> = ["home", "away"];
  const results = await Promise.all(
    sides.flatMap((side) =>
      SDMS_PLAYER_STAT_CATEGORIES.map(async (category) => ({
        side,
        category,
        data: await fetchSdmsPlayerStats(matchId, side, category),
      })),
    ),
  );

  const out: SdmsMatchPlayerStats = {
    home: emptySideStats(),
    away: emptySideStats(),
  };
  for (const row of results) {
    out[row.side][row.category] = row.data;
  }
  return out;
}

/** Extract comparable home/away stat rows from SDMS prefixed keys. */
export function sdmsHomeAwayStatRows(
  section: Record<string, number> | undefined,
  labels?: Record<string, string>,
): { label: string; home: number; away: number; format?: "percent" }[] {
  if (!section) return [];
  const bases = new Set<string>();
  for (const key of Object.keys(section)) {
    if (key.startsWith("home_")) bases.add(key.slice(5));
    if (key.startsWith("away_")) bases.add(key.slice(5));
  }
  const rows: { label: string; home: number; away: number; format?: "percent" }[] = [];
  for (const base of [...bases].sort()) {
    const home = section[`home_${base}`];
    const away = section[`away_${base}`];
    if (home == null && away == null) continue;
    const isPercent = /percentage|ratio|success/.test(base);
    rows.push({
      label: labels?.[base] ?? base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      home: home ?? 0,
      away: away ?? 0,
      format: isPercent ? "percent" : undefined,
    });
  }
  return rows;
}

export function rankPlayerStatRows(
  rows: SdmsPlayerStatRow[],
  metric: string,
  limit = 5,
): Array<SdmsPlayerStatRow & { rank: number; value: number }> {
  return rows
    .map((row) => ({ ...row, value: Number(row[metric] ?? 0) }))
    .filter((row) => row.value > 0 && row.player_name?.trim())
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Flatten SDMS leader arrays (value + side) into rows usable by rankPlayerStatRows. */
export function leaderRowsFromPlayerStats(
  playerStats: SdmsMatchPlayerStats,
  metric: string,
  preferredCategories: SdmsPlayerStatCategory[] = ["attack", "defend", "carries"],
): Array<SdmsPlayerStatRow & { side: "home" | "away" }> {
  const byPlayer = new Map<string, SdmsPlayerStatRow & { side: "home" | "away"; value: number }>();

  for (const side of ["home", "away"] as const) {
    for (const category of preferredCategories) {
      const bundle = playerStats[side][category] as (SdmsPlayerStatsBundle & Record<string, unknown>) | null;
      if (!bundle) continue;
      const rows = bundle[metric];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row?.player_id || (row.side && row.side !== side)) continue;
        const value = Number(row.value ?? 0);
        if (!Number.isFinite(value) || value <= 0) continue;
        const key = String(row.player_id);
        const existing = byPlayer.get(key);
        if (!existing || value > existing.value) {
          byPlayer.set(key, {
            player_id: row.player_id,
            player_name: row.player_name,
            side,
            value,
            [metric]: value,
          });
        }
      }
    }
  }

  return [...byPlayer.values()];
}
