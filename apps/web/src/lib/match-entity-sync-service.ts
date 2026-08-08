import { eq } from "drizzle-orm";
import { fixturePlayers } from "@rugby365/db";
import { getFixtureSquad } from "./entity-admin-service";
import { enrichFixtureFromSdmsMatch } from "./planet-rugby-match-import-service";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam, SDMS_PROVIDER } from "./entity-resolve-service";
import type { MappedLineups, SdmsMatchDetail, SdmsMatchPlayerStats } from "@rugby365/import-sdk";

const SYNC_MAX_AGE_MS = 10 * 60 * 1000;
const PLAYER_RESOLVE_CONCURRENCY = 8;

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]!;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function collectPlayerStatRows(playerStats: SdmsMatchPlayerStats | null): Array<{
  playerId: string;
  playerName: string;
}> {
  if (!playerStats) return [];
  const byId = new Map<string, string>();
  for (const side of ["home", "away"] as const) {
    for (const category of ["attack", "defend", "kicking", "errors", "carries"] as const) {
      for (const row of playerStats[side][category]?.detail_list ?? []) {
        const id = row.player_id?.trim();
        const name = row.player_name?.trim();
        if (!id || !name) continue;
        if (!byId.has(id)) byId.set(id, name);
      }
    }
  }
  return [...byId.entries()].map(([playerId, playerName]) => ({ playerId, playerName }));
}

/** Register SDMS team/player provider IDs in CMS (one profile per external id). */
export async function ensureSdmsProvidersRegistered(
  detail: SdmsMatchDetail,
  lineups: MappedLineups | null,
  playerStats: SdmsMatchPlayerStats | null = null,
): Promise<void> {
  await ensureSdmsTeamsRegistered(detail);

  const pending = new Map<string, { name: string; positionName?: string; clubName?: string }>();

  if (lineups) {
    const rows = [
      ...lineups.home.starting,
      ...lineups.home.substitutes,
      ...lineups.away.starting,
      ...lineups.away.substitutes,
    ];
    for (const row of rows) {
      if (!row.providerId) continue;
      pending.set(row.providerId, {
        name: row.name,
        positionName: row.positionName,
        clubName: row.clubName,
      });
    }
  }

  for (const row of collectPlayerStatRows(playerStats)) {
    if (pending.has(row.playerId)) continue;
    pending.set(row.playerId, { name: row.playerName });
  }

  await mapPool([...pending.entries()], PLAYER_RESOLVE_CONCURRENCY, async ([providerId, row]) => {
    await resolvePlayer({
      name: row.name,
      externalProviderId: providerId,
      positionName: row.positionName,
      clubName: row.clubName,
      createIfMissing: true,
      sourceProvider: SDMS_PROVIDER,
      skipArchiveEnrich: true,
    });
  });
}

/** Fast path for Match Centre SSR — teams only (no sequential player upsert loop). */
export async function ensureSdmsTeamsRegistered(detail: SdmsMatchDetail): Promise<void> {
  await Promise.all([
    detail.home_team_id
      ? resolveTeam({
          name: detail.home_team_name,
          externalProviderId: detail.home_team_id,
          createIfMissing: true,
          sourceProvider: SDMS_PROVIDER,
          imageUrl: detail.home_team_icon,
        })
      : Promise.resolve(null),
    detail.away_team_id
      ? resolveTeam({
          name: detail.away_team_name,
          externalProviderId: detail.away_team_id,
          createIfMissing: true,
          sourceProvider: SDMS_PROVIDER,
          imageUrl: detail.away_team_icon,
        })
      : Promise.resolve(null),
  ]);
}

/** Idempotent sync: squads, events, and player IDs for a CMS fixture from SDMS. */
export async function syncSdmsMatchEntityLinks(
  fixtureId: string,
  matchId: string,
  options: { force?: boolean } = {},
): Promise<{ synced: boolean; squadCount: number }> {
  const squadDetail = await getFixtureSquad(fixtureId);
  if (!squadDetail) return { synced: false, squadCount: 0 };

  const snap = (squadDetail.fixture.providerSnapshot ?? {}) as { polledAt?: string; matchId?: string };
  const polledAt = snap.polledAt ? new Date(snap.polledAt).getTime() : 0;
  const stale = !polledAt || Date.now() - polledAt > SYNC_MAX_AGE_MS;
  const squadEmpty = (squadDetail.squad?.length ?? 0) === 0;
  const matchChanged = snap.matchId && snap.matchId !== matchId;

  if (!options.force && !stale && !squadEmpty && !matchChanged) {
    return { synced: false, squadCount: squadDetail.squad.length };
  }

  const result = await enrichFixtureFromSdmsMatch(fixtureId, matchId, { replaceEvents: false });
  return { synced: true, squadCount: result.squadPlayers };
}

export async function listFixtureSquadPlayerIds(fixtureId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));
  return rows.map((r) => r.playerId);
}
