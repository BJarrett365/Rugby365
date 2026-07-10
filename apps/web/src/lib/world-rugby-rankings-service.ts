import { asc, eq } from "drizzle-orm";
import {
  fetchWorldRugbyRankings,
  worldRugbyRankingsUrl,
  type WorldRugbyRankingCategory,
  type WorldRugbyRankingsPayload,
} from "@rugby365/import-sdk";
import {
  teams,
  worldRankingFeeds,
  worldRankingRows,
  worldRankingSnapshots,
} from "@rugby365/db";
import { getDb } from "./db";
import { resolveTeam } from "./entity-resolve-service";

export const WORLD_RUGBY_PROVIDER = "world_rugby";

export const WORLD_RUGBY_RANKING_CATEGORIES: {
  category: WorldRugbyRankingCategory;
  label: string;
  publicPath: string;
}[] = [
  {
    category: "mru",
    label: "Men's Rugby Union",
    publicPath: "https://www.world.rugby/rankings/mru",
  },
  {
    category: "wru",
    label: "Women's Rugby Union",
    publicPath: "https://www.world.rugby/rankings/wru",
  },
];

export type WorldRankingRowView = {
  position: number;
  previousPosition: number | null;
  points: number;
  previousPoints: number | null;
  movement: number | null;
  pointsChange: number | null;
  teamName: string;
  teamAbbreviation: string | null;
  countryCode: string | null;
  worldRugbyTeamId: string;
  teamId: string | null;
  teamSlug: string | null;
};

export type WorldRankingFeedView = {
  category: WorldRugbyRankingCategory;
  label: string;
  sourceUrl: string;
  publicPath: string;
  effectiveDate: string | null;
  syncedAt: string | null;
  rowCount: number;
  rows: WorldRankingRowView[];
};

function worldRugbyExternalId(category: WorldRugbyRankingCategory, teamId: string): string {
  return `wr:${category}:${teamId}`;
}

export async function syncWorldRugbyRankings(
  category: WorldRugbyRankingCategory,
): Promise<{ rowsUpserted: number; effectiveDate: string }> {
  const payload = await fetchWorldRugbyRankings(category);
  return upsertWorldRugbyRankings(payload);
}

export async function syncAllWorldRugbyRankings(): Promise<
  Record<WorldRugbyRankingCategory, { rowsUpserted: number; effectiveDate: string }>
> {
  const results = {} as Record<
    WorldRugbyRankingCategory,
    { rowsUpserted: number; effectiveDate: string }
  >;

  for (const feed of WORLD_RUGBY_RANKING_CATEGORIES) {
    results[feed.category] = await syncWorldRugbyRankings(feed.category);
  }

  return results;
}

async function upsertWorldRugbyRankings(
  payload: WorldRugbyRankingsPayload,
): Promise<{ rowsUpserted: number; effectiveDate: string }> {
  const db = getDb();
  const syncedAt = new Date();
  const sourceUrl = worldRugbyRankingsUrl(payload.category);
  const meta = WORLD_RUGBY_RANKING_CATEGORIES.find((f) => f.category === payload.category);

  const [snapshot] = await db
    .insert(worldRankingSnapshots)
    .values({
      category: payload.category,
      effectiveDate: payload.effectiveDate,
    })
    .onConflictDoUpdate({
      target: [worldRankingSnapshots.category, worldRankingSnapshots.effectiveDate],
      set: { createdAt: syncedAt },
    })
    .returning();

  await db
    .delete(worldRankingRows)
    .where(eq(worldRankingRows.snapshotId, snapshot.id));

  let rowsUpserted = 0;
  for (const entry of payload.entries) {
    const externalProviderId = worldRugbyExternalId(payload.category, entry.team.id);
    const team = await resolveTeam({
      name: entry.team.name,
      externalProviderId,
      sourceProvider: WORLD_RUGBY_PROVIDER,
      createIfMissing: true,
    });

    await db.insert(worldRankingRows).values({
      snapshotId: snapshot.id,
      worldRugbyTeamId: entry.team.id,
      position: entry.position,
      previousPosition: entry.previousPosition,
      points: entry.points,
      previousPoints: entry.previousPoints,
      teamName: entry.team.name,
      teamAbbreviation: entry.team.abbreviation || null,
      countryCode: entry.team.countryCode || null,
      teamId: team?.id ?? null,
    });
    rowsUpserted += 1;
  }

  await db
    .insert(worldRankingFeeds)
    .values({
      category: payload.category,
      label: payload.label || meta?.label || payload.category,
      sourceUrl,
      currentSnapshotId: snapshot.id,
      syncedAt,
    })
    .onConflictDoUpdate({
      target: worldRankingFeeds.category,
      set: {
        label: payload.label || meta?.label || payload.category,
        sourceUrl,
        currentSnapshotId: snapshot.id,
        syncedAt,
      },
    });

  return { rowsUpserted, effectiveDate: payload.effectiveDate };
}

export async function getWorldRankingFeed(
  category: WorldRugbyRankingCategory,
): Promise<WorldRankingFeedView | null> {
  const db = getDb();
  const [feed] = await db
    .select()
    .from(worldRankingFeeds)
    .where(eq(worldRankingFeeds.category, category))
    .limit(1);

  if (!feed?.currentSnapshotId) return null;

  const [snapshot] = await db
    .select()
    .from(worldRankingSnapshots)
    .where(eq(worldRankingSnapshots.id, feed.currentSnapshotId))
    .limit(1);

  const rows = await db
    .select({
      position: worldRankingRows.position,
      previousPosition: worldRankingRows.previousPosition,
      points: worldRankingRows.points,
      previousPoints: worldRankingRows.previousPoints,
      teamName: worldRankingRows.teamName,
      teamAbbreviation: worldRankingRows.teamAbbreviation,
      countryCode: worldRankingRows.countryCode,
      worldRugbyTeamId: worldRankingRows.worldRugbyTeamId,
      teamId: worldRankingRows.teamId,
      teamSlug: teams.slug,
    })
    .from(worldRankingRows)
    .leftJoin(teams, eq(worldRankingRows.teamId, teams.id))
    .where(eq(worldRankingRows.snapshotId, feed.currentSnapshotId))
    .orderBy(asc(worldRankingRows.position));

  const meta = WORLD_RUGBY_RANKING_CATEGORIES.find((f) => f.category === category);

  return {
    category,
    label: feed.label,
    sourceUrl: feed.sourceUrl,
    publicPath: meta?.publicPath ?? "https://www.world.rugby/rankings",
    effectiveDate: snapshot?.effectiveDate ?? null,
    syncedAt: feed.syncedAt?.toISOString() ?? null,
    rowCount: rows.length,
    rows: rows.map((row) => ({
      position: row.position,
      previousPosition: row.previousPosition,
      points: row.points,
      previousPoints: row.previousPoints,
      movement:
        row.previousPosition === null ? null : row.previousPosition - row.position,
      pointsChange:
        row.previousPoints === null ? null : row.points - row.previousPoints,
      teamName: row.teamName,
      teamAbbreviation: row.teamAbbreviation,
      countryCode: row.countryCode,
      worldRugbyTeamId: row.worldRugbyTeamId,
      teamId: row.teamId,
      teamSlug: row.teamSlug,
    })),
  };
}

export async function listWorldRankingFeeds(): Promise<WorldRankingFeedView[]> {
  const feeds: WorldRankingFeedView[] = [];
  for (const item of WORLD_RUGBY_RANKING_CATEGORIES) {
    const feed = await getWorldRankingFeed(item.category);
    feeds.push(
      feed ?? {
        category: item.category,
        label: item.label,
        sourceUrl: worldRugbyRankingsUrl(item.category),
        publicPath: item.publicPath,
        effectiveDate: null,
        syncedAt: null,
        rowCount: 0,
        rows: [],
      },
    );
  }
  return feeds;
}
