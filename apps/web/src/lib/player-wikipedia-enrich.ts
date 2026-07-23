import { enrichPlayerFromWikipedia } from "./wikipedia-import-service";
import type { PlayerArchiveEnrichResult } from "./wikipedia-import-service";

/** Fire-and-forget Wikipedia archive lookup after player creation (read-only). */
export function schedulePlayerWikipediaEnrich(playerId: string, playerName: string): void {
  void enrichPlayerFromWikipedia(playerId, playerName).catch(() => {
    // Archive enrichment is best-effort; live match data remains authoritative.
  });
}

export async function enrichPlayerFromWikipediaAndWait(
  playerId: string,
  playerName?: string,
  options?: { fillMissingOnly?: boolean },
) {
  try {
    return await enrichPlayerFromWikipedia(playerId, playerName, options);
  } catch {
    return { enriched: false, playerId, reason: "enrich_failed" as const };
  }
}

export type PlayerWikiBulkEnrichOptions = {
  /** When true, skip players that already have archiveSyncedAt set. */
  onlyMissing?: boolean;
  /** When true, only players missing club, nation, or position. */
  onlyIncomplete?: boolean;
  /** Max players to process (for dry runs / partial batches). */
  limit?: number;
  /** Delay between players in ms to respect Wikipedia rate limits. */
  delayMs?: number;
  onProgress?: (progress: {
    index: number;
    total: number;
    playerId: string;
    playerName: string;
    result: PlayerArchiveEnrichResult;
  }) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichAllPlayersFromWikipedia(
  options: PlayerWikiBulkEnrichOptions = {},
): Promise<{
  total: number;
  processed: number;
  enriched: number;
  skipped: number;
  failed: number;
  results: PlayerArchiveEnrichResult[];
}> {
  const { getDb } = await import("./db");
  const { players } = await import("@rugby365/db");
  const { asc, isNull } = await import("drizzle-orm");
  const { playerProfileIncompleteWhere } = await import("./player-profile-fields");

  const db = getDb();
  const rows = options.onlyIncomplete
    ? await db
        .select({ id: players.id, name: players.name, archiveSyncedAt: players.archiveSyncedAt })
        .from(players)
        .where(playerProfileIncompleteWhere())
        .orderBy(asc(players.name))
    : options.onlyMissing
    ? await db
        .select({ id: players.id, name: players.name, archiveSyncedAt: players.archiveSyncedAt })
        .from(players)
        .where(isNull(players.archiveSyncedAt))
        .orderBy(asc(players.name))
    : await db
        .select({ id: players.id, name: players.name, archiveSyncedAt: players.archiveSyncedAt })
        .from(players)
        .orderBy(asc(players.name));

  const batch = options.limit ? rows.slice(0, options.limit) : rows;
  const results: PlayerArchiveEnrichResult[] = [];
  const delayMs = options.delayMs ?? 800;

  for (let index = 0; index < batch.length; index++) {
    const player = batch[index]!;
    const result = await enrichPlayerFromWikipediaAndWait(player.id, player.name);
    results.push(result);
    options.onProgress?.({
      index: index + 1,
      total: batch.length,
      playerId: player.id,
      playerName: player.name,
      result,
    });
    if (index < batch.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    total: rows.length,
    processed: batch.length,
    enriched: results.filter((row) => row.enriched).length,
    skipped: results.filter((row) => !row.enriched).length,
    failed: results.filter((row) => row.reason === "enrich_failed").length,
    results,
  };
}
