import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { fixturePlayers, matchEvents, playerRatings, players } from "@rugby365/db";
import { calculateAndPersistPlayerRating } from "./player-bio-packet-service";
import { getDb } from "./db";

export type BatchPlayerRatingsProgress = {
  index: number;
  total: number;
  playerId: string;
  playerName: string;
  displayRating: number | null;
  error?: string;
};

export type BatchPlayerRatingsSummary = {
  total: number;
  processed: number;
  rated: number;
  failed: number;
  skipped: number;
};

const hasSquadSql = sql`exists (
  select 1 from ${fixturePlayers} fp where fp.player_id = ${players.id}
)`;
const hasEventSql = sql`exists (
  select 1 from ${matchEvents} me where me.player_id = ${players.id}
)`;
const hasMatchDataSql = or(hasSquadSql, hasEventSql);

async function listRatingTargets(options: {
  onlyMissing: boolean;
  onlyWithSquads: boolean;
  onlyWithMatchData: boolean;
  limit?: number;
}) {
  const db = getDb();
  const activityFilter = options.onlyWithMatchData
    ? hasMatchDataSql
    : options.onlyWithSquads
      ? hasSquadSql
      : undefined;

  if (options.onlyMissing) {
    const rows = await db
      .selectDistinct({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
      .where(
        and(
          isNull(playerRatings.playerId),
          activityFilter,
        ),
      )
      .orderBy(asc(players.name));
    return options.limit ? rows.slice(0, options.limit) : rows;
  }

  const rows = await db
    .selectDistinct({
      id: players.id,
      name: players.name,
    })
    .from(players)
    .where(activityFilter)
    .orderBy(asc(players.name));
  return options.limit ? rows.slice(0, options.limit) : rows;
}

export async function batchCalculateAllPlayerRatings(
  options: {
    onlyMissing?: boolean;
    onlyWithSquads?: boolean;
    onlyWithMatchData?: boolean;
    limit?: number;
    onProgress?: (progress: BatchPlayerRatingsProgress) => void;
  } = {},
): Promise<BatchPlayerRatingsSummary> {
  const onlyMissing = options.onlyMissing ?? false;
  const onlyWithMatchData = options.onlyWithMatchData ?? false;
  const onlyWithSquads = onlyWithMatchData ? false : (options.onlyWithSquads ?? true);
  const targets = await listRatingTargets({
    onlyMissing,
    onlyWithSquads,
    onlyWithMatchData,
    limit: options.limit,
  });

  let rated = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, row] of targets.entries()) {
    try {
      const rating = await calculateAndPersistPlayerRating(row.id);
      if (rating.displayRating != null) {
        rated += 1;
      } else {
        skipped += 1;
      }
      options.onProgress?.({
        index: index + 1,
        total: targets.length,
        playerId: row.id,
        playerName: row.name,
        displayRating: rating.displayRating,
      });
    } catch (error) {
      failed += 1;
      options.onProgress?.({
        index: index + 1,
        total: targets.length,
        playerId: row.id,
        playerName: row.name,
        displayRating: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    total: targets.length,
    processed: rated + failed + skipped,
    rated,
    failed,
    skipped,
  };
}

export async function countPlayersPendingRatings() {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${players.id})::int` })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(and(isNull(playerRatings.playerId), hasMatchDataSql));
  return row?.count ?? 0;
}
