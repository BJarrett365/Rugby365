import { eq, inArray, sql } from "drizzle-orm";
import { fixturePlayers, matchEvents } from "@rugby365/db";
import { getDb } from "./db";

export type PlayerScoringStats = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
};

const EMPTY_STATS: PlayerScoringStats = {
  tries: 0,
  conversions: 0,
  penalties: 0,
  dropGoals: 0,
  points: 0,
};

export function statsFromEventCounts(
  counts: Partial<Record<string, number>>,
): PlayerScoringStats {
  const tries = counts.try ?? 0;
  const conversions = counts.conversion ?? 0;
  const penalties = (counts.penalty_goal ?? 0) + (counts.penalty ?? 0);
  const dropGoals = counts.drop_goal ?? 0;
  return {
    tries,
    conversions,
    penalties,
    dropGoals,
    points: tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3,
  };
}

export async function batchPlayerCareerStats(
  playerIds: string[],
): Promise<Map<string, PlayerScoringStats>> {
  const result = new Map<string, PlayerScoringStats>();
  if (!playerIds.length) return result;

  const db = getDb();
  const firstId = playerIds[0]!;
  const playerFilter =
    playerIds.length === 1 ? eq(matchEvents.playerId, firstId) : inArray(matchEvents.playerId, playerIds);
  const rows = await db
    .select({
      playerId: matchEvents.playerId,
      eventType: matchEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(matchEvents)
    .where(playerFilter)
    .groupBy(matchEvents.playerId, matchEvents.eventType);

  const byPlayer = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!row.playerId) continue;
    const bucket = byPlayer.get(row.playerId) ?? {};
    bucket[row.eventType] = row.count;
    byPlayer.set(row.playerId, bucket);
  }

  for (const id of playerIds) {
    result.set(id, statsFromEventCounts(byPlayer.get(id) ?? {}));
  }
  return result;
}

export async function syncFixturePlayerStats(fixtureId: string): Promise<number> {
  const db = getDb();
  const squad = await db
    .select({ id: fixturePlayers.id, playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));

  let updated = 0;
  for (const row of squad) {
    const events = await db
      .select({ eventType: matchEvents.eventType })
      .from(matchEvents)
      .where(
        sql`${matchEvents.fixtureId} = ${fixtureId} and ${matchEvents.playerId} = ${row.playerId}`,
      );

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    const stats = statsFromEventCounts(counts);

    await db
      .update(fixturePlayers)
      .set({
        tries: stats.tries,
        conversions: stats.conversions,
        penalties: stats.penalties,
        dropGoals: stats.dropGoals,
        points: stats.points,
      })
      .where(eq(fixturePlayers.id, row.id));
    updated += 1;
  }
  return updated;
}

export async function getPlayerCareerStats(playerId: string): Promise<PlayerScoringStats> {
  const map = await batchPlayerCareerStats([playerId]);
  return map.get(playerId) ?? { ...EMPTY_STATS };
}
