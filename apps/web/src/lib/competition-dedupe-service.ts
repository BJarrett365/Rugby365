/**
 * Merge duplicate competitions that share the same canonical display name.
 * Hard rule: one live competition row per canonical name (men’s Internationals, etc.).
 */
import { and, eq, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerSeasonStats,
  playerSuspensions,
  playerTeamMemberships,
  playerTransfers,
  standingRows,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  canonicalCompetitionDisplayName,
  competitionPickerScore,
} from "./competition-list-utils";
import { parseSeasonStartYear } from "./season-label-utils";

export type CompetitionDedupeSummary = {
  groups: number;
  merged: number;
  deleted: number;
  details: Array<{
    canonicalName: string;
    keptId: string;
    keptSlug: string;
    removedIds: string[];
  }>;
};

type CompRow = typeof competitions.$inferSelect & {
  fixtureCount: number;
  seasonCount: number;
};

function scoreCompetition(row: CompRow): number {
  let score = competitionPickerScore({
    id: row.id,
    name: row.name,
    slug: row.slug,
    activeSeason: row.seasonCount > 0 ? { id: "x" } : null,
  });
  if (row.sdmsCompCode) score += 40;
  if (row.externalProviderId && !/^\d+$/.test(row.externalProviderId)) score += 20;
  if (row.externalProviderId) score += 10;
  score += Math.min(50, row.fixtureCount);
  score += Math.min(40, row.seasonCount);
  return score;
}

async function loadCompetitionRows(): Promise<CompRow[]> {
  const db = getDb();
  const rows = await db.select().from(competitions);
  const fixtureCounts = await db
    .select({
      competitionId: fixtures.competitionId,
      count: sql<number>`count(*)::int`,
    })
    .from(fixtures)
    .groupBy(fixtures.competitionId);
  const seasonCounts = await db
    .select({
      competitionId: competitionSeasons.competitionId,
      count: sql<number>`count(*)::int`,
    })
    .from(competitionSeasons)
    .groupBy(competitionSeasons.competitionId);

  const fixtureCountById = new Map(
    fixtureCounts.map((r) => [r.competitionId, Number(r.count ?? 0)]),
  );
  const seasonCountById = new Map(
    seasonCounts.map((r) => [r.competitionId, Number(r.count ?? 0)]),
  );

  return rows.map((row) => ({
    ...row,
    fixtureCount: fixtureCountById.get(row.id) ?? 0,
    seasonCount: seasonCountById.get(row.id) ?? 0,
  }));
}

export async function migrateSeasonId(fromSeasonId: string, toSeasonId: string) {
  if (fromSeasonId === toSeasonId) return;
  const db = getDb();

  // Standing rows: avoid unique conflicts by deleting losers already present on keeper.
  const keeperStandingTeamIds = await db
    .select({ teamId: standingRows.teamId })
    .from(standingRows)
    .where(eq(standingRows.seasonId, toSeasonId));
  const keeperTeams = new Set(keeperStandingTeamIds.map((r) => r.teamId));
  const loserStandings = await db
    .select()
    .from(standingRows)
    .where(eq(standingRows.seasonId, fromSeasonId));
  for (const row of loserStandings) {
    if (keeperTeams.has(row.teamId)) {
      await db.delete(standingRows).where(eq(standingRows.id, row.id));
    } else {
      await db
        .update(standingRows)
        .set({ seasonId: toSeasonId })
        .where(eq(standingRows.id, row.id));
    }
  }

  await db
    .update(fixtures)
    .set({ seasonId: toSeasonId })
    .where(eq(fixtures.seasonId, fromSeasonId));
  await db
    .update(playerTransfers)
    .set({ seasonId: toSeasonId })
    .where(eq(playerTransfers.seasonId, fromSeasonId));
  await db
    .update(playerTeamMemberships)
    .set({ seasonId: toSeasonId })
    .where(eq(playerTeamMemberships.seasonId, fromSeasonId));
  await db
    .update(teamMatchStats)
    .set({ seasonId: toSeasonId })
    .where(eq(teamMatchStats.seasonId, fromSeasonId));
  await db
    .update(playerMatchPerformanceStats)
    .set({ seasonId: toSeasonId })
    .where(eq(playerMatchPerformanceStats.seasonId, fromSeasonId));
  await db
    .update(playerMatchRatings)
    .set({ seasonId: toSeasonId })
    .where(eq(playerMatchRatings.seasonId, fromSeasonId));
  await db
    .update(playerSuspensions)
    .set({ seasonId: toSeasonId })
    .where(eq(playerSuspensions.seasonId, fromSeasonId));

  // player_season_stats unique on player+season+team — drop losers that conflict.
  const keeperStats = await db
    .select({ playerId: playerSeasonStats.playerId, teamId: playerSeasonStats.teamId })
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.seasonId, toSeasonId));
  const keeperKeys = new Set(keeperStats.map((r) => `${r.playerId}:${r.teamId}`));
  const loserStats = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.seasonId, fromSeasonId));
  for (const row of loserStats) {
    if (keeperKeys.has(`${row.playerId}:${row.teamId}`)) {
      await db.delete(playerSeasonStats).where(eq(playerSeasonStats.id, row.id));
    } else {
      await db
        .update(playerSeasonStats)
        .set({ seasonId: toSeasonId })
        .where(eq(playerSeasonStats.id, row.id));
    }
  }
}

async function migrateCompetitionId(fromId: string, toId: string) {
  if (fromId === toId) return;
  const db = getDb();
  await db.update(fixtures).set({ competitionId: toId }).where(eq(fixtures.competitionId, fromId));
  await db
    .update(playerTransfers)
    .set({ competitionId: toId })
    .where(eq(playerTransfers.competitionId, fromId));
  await db
    .update(playerTeamMemberships)
    .set({ competitionId: toId })
    .where(eq(playerTeamMemberships.competitionId, fromId));
  await db
    .update(teamMatchStats)
    .set({ competitionId: toId })
    .where(eq(teamMatchStats.competitionId, fromId));
  await db
    .update(playerMatchPerformanceStats)
    .set({ competitionId: toId })
    .where(eq(playerMatchPerformanceStats.competitionId, fromId));
  await db
    .update(playerMatchRatings)
    .set({ competitionId: toId })
    .where(eq(playerMatchRatings.competitionId, fromId));
  await db
    .update(playerSuspensions)
    .set({ competitionId: toId })
    .where(eq(playerSuspensions.competitionId, fromId));
  await db
    .update(playerSeasonStats)
    .set({ competitionId: toId })
    .where(eq(playerSeasonStats.competitionId, fromId));
}

async function mergeCompetitionPair(keeper: CompRow, loser: CompRow) {
  const db = getDb();
  const loserSeasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, loser.id));
  const keeperSeasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, keeper.id));

  for (const season of loserSeasons) {
    const year = season.year ?? parseSeasonStartYear(season.label);
    const match =
      keeperSeasons.find((k) => k.year === year) ??
      keeperSeasons.find((k) => k.label === season.label) ??
      null;

    if (match) {
      await migrateSeasonId(season.id, match.id);
      await db.delete(competitionSeasons).where(eq(competitionSeasons.id, season.id));
    } else {
      await db
        .update(competitionSeasons)
        .set({ competitionId: keeper.id })
        .where(eq(competitionSeasons.id, season.id));
      keeperSeasons.push({ ...season, competitionId: keeper.id });
    }
  }

  await migrateCompetitionId(loser.id, keeper.id);

  // Prefer richer provider ids on keeper when missing.
  const patch: Partial<typeof competitions.$inferInsert> = {
    name: canonicalCompetitionDisplayName(keeper.name),
  };
  if (!keeper.externalProviderId && loser.externalProviderId) {
    patch.externalProviderId = loser.externalProviderId;
  }
  if (!keeper.sdmsCompCode && loser.sdmsCompCode) {
    patch.sdmsCompCode = loser.sdmsCompCode;
  }
  await db.update(competitions).set(patch).where(eq(competitions.id, keeper.id));

  await db.delete(competitions).where(eq(competitions.id, loser.id));
}

export async function findDuplicateCompetitionGroups(): Promise<
  Array<{ canonicalName: string; rows: CompRow[] }>
> {
  const rows = await loadCompetitionRows();
  const byName = new Map<string, CompRow[]>();
  for (const row of rows) {
    const key = canonicalCompetitionDisplayName(row.name).toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }
  return [...byName.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([canonicalName, list]) => ({
      canonicalName: canonicalCompetitionDisplayName(list[0]!.name),
      rows: list.sort((a, b) => scoreCompetition(b) - scoreCompetition(a)),
    }));
}

export async function mergeDuplicateCompetitions(options?: {
  dryRun?: boolean;
}): Promise<CompetitionDedupeSummary> {
  const dryRun = options?.dryRun ?? false;
  const groups = await findDuplicateCompetitionGroups();
  const summary: CompetitionDedupeSummary = {
    groups: groups.length,
    merged: 0,
    deleted: 0,
    details: [],
  };

  for (const group of groups) {
    const [keeper, ...losers] = group.rows;
    if (!keeper || !losers.length) continue;
    summary.details.push({
      canonicalName: group.canonicalName,
      keptId: keeper.id,
      keptSlug: keeper.slug,
      removedIds: losers.map((l) => l.id),
    });
    summary.merged += 1;
    summary.deleted += losers.length;
    if (dryRun) continue;
    for (const loser of losers) {
      await mergeCompetitionPair(keeper, loser);
    }
  }

  return summary;
}

/** Find an existing competition by canonical display name (hard no-duplicate rule). */
export async function findCompetitionByCanonicalName(
  name: string,
): Promise<typeof competitions.$inferSelect | null> {
  const key = canonicalCompetitionDisplayName(name).toLowerCase();
  if (!key) return null;
  const db = getDb();
  const rows = await db.select().from(competitions);
  const matches = rows.filter(
    (row) => canonicalCompetitionDisplayName(row.name).toLowerCase() === key,
  );
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0]!;

  // Prefer the richer row when duplicates still exist.
  const enriched = await loadCompetitionRows();
  const scored = enriched
    .filter((row) => canonicalCompetitionDisplayName(row.name).toLowerCase() === key)
    .sort((a, b) => scoreCompetition(b) - scoreCompetition(a));
  return scored[0] ?? matches[0]!;
}
