import type { MappedLineups, SdmsMatchPlayerStats } from "@rugby365/import-sdk";

/** Minimum squad size that counts as a usable animation lineup. */
export const DETAILED_SQUAD_MIN = 15;
/** Minimum performance-stat rows that count as detailed player data. */
export const DETAILED_PERF_MIN = 10;

export type DetailedMatchPlayerDataInput = {
  /** Mapped animation / key events available for the public pitch. */
  eventCount?: number;
  /** CMS fixture_players count. */
  squadCount?: number;
  /** CMS player_match_performance_stats count. */
  performanceStatCount?: number;
  /** SDMS mapped lineups (starting + bench). */
  lineups?: MappedLineups | null;
  /** SDMS player-stat categories used by Match Animation chips. */
  playerStats?: SdmsMatchPlayerStats | null;
};

function countLineupPlayers(lineups: MappedLineups | null | undefined): number {
  if (!lineups) return 0;
  let n = 0;
  for (const side of ["home", "away"] as const) {
    const pack = lineups[side];
    if (!pack) continue;
    n += (pack.starting?.length ?? 0) + (pack.substitutes?.length ?? 0);
  }
  return n;
}

function countSdmsPlayerStatPlayers(playerStats: SdmsMatchPlayerStats | null | undefined): number {
  if (!playerStats) return 0;
  const ids = new Set<string>();
  for (const side of ["home", "away"] as const) {
    const pack = playerStats[side];
    if (!pack) continue;
    for (const category of Object.values(pack)) {
      const rows = category?.detail_list;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const key = String(row.player_id ?? row.player_name ?? "").trim();
        if (key) ids.add(key);
      }
    }
  }
  return ids.size;
}

/**
 * True when a match has enough player-level detail to power Match Animation
 * (events, squads, performance stats, or SDMS lineups/player stats).
 */
export function hasDetailedMatchPlayerData(input: DetailedMatchPlayerDataInput): boolean {
  if ((input.eventCount ?? 0) > 0) return true;
  if ((input.squadCount ?? 0) >= DETAILED_SQUAD_MIN) return true;
  if ((input.performanceStatCount ?? 0) >= DETAILED_PERF_MIN) return true;
  if (countLineupPlayers(input.lineups) >= DETAILED_SQUAD_MIN) return true;
  if (countSdmsPlayerStatPlayers(input.playerStats) >= DETAILED_PERF_MIN) return true;
  return false;
}
