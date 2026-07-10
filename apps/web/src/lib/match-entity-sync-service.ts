import { eq } from "drizzle-orm";
import { fixturePlayers } from "@rugby365/db";
import { getFixtureSquad } from "./entity-admin-service";
import { enrichFixtureFromSdmsMatch } from "./planet-rugby-match-import-service";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam, SDMS_PROVIDER } from "./entity-resolve-service";
import type { MappedLineups, SdmsMatchDetail } from "@rugby365/import-sdk";

const SYNC_MAX_AGE_MS = 10 * 60 * 1000;

/** Register SDMS team/player provider IDs in CMS (one profile per external id). */
export async function ensureSdmsProvidersRegistered(
  detail: SdmsMatchDetail,
  lineups: MappedLineups | null,
): Promise<void> {
  await Promise.all([
    detail.home_team_id
      ? resolveTeam({
          name: detail.home_team_name,
          externalProviderId: detail.home_team_id,
          createIfMissing: true,
          sourceProvider: SDMS_PROVIDER,
        })
      : Promise.resolve(null),
    detail.away_team_id
      ? resolveTeam({
          name: detail.away_team_name,
          externalProviderId: detail.away_team_id,
          createIfMissing: true,
          sourceProvider: SDMS_PROVIDER,
        })
      : Promise.resolve(null),
  ]);

  if (!lineups) return;

  const rows = [
    ...lineups.home.starting,
    ...lineups.home.substitutes,
    ...lineups.away.starting,
    ...lineups.away.substitutes,
  ];

  for (const row of rows) {
    if (!row.providerId) continue;
    await resolvePlayer({
      name: row.name,
      externalProviderId: row.providerId,
      positionName: row.positionName,
      clubName: row.clubName,
      createIfMissing: true,
      sourceProvider: SDMS_PROVIDER,
      skipArchiveEnrich: true,
    });
  }
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
