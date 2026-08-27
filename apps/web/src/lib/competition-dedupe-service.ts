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
  playerRadarCaches,
  playerSeasonStats,
  playerSuspensions,
  playerTeamMemberships,
  playerTransfers,
  shirtLibraryCompetitionPages,
  standingRows,
  teamMatchStats,
  teamOfWeekEditions,
  teamShirts,
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
  // Never keep Supabase-merge legacy clones as the canonical row.
  if (row.slug.includes("__legacy__")) score -= 500;
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

  // CASCADE-on-season tables the original merge missed — deleting the loser
  // season would otherwise wipe Team of the Week, kits, and radar caches.
  const keeperTotwKeys = new Set(
    (
      await db
        .select({
          competitionId: teamOfWeekEditions.competitionId,
          roundKey: teamOfWeekEditions.roundKey,
        })
        .from(teamOfWeekEditions)
        .where(eq(teamOfWeekEditions.seasonId, toSeasonId))
    ).map((r) => `${r.competitionId}:${r.roundKey}`),
  );
  const loserTotw = await db
    .select()
    .from(teamOfWeekEditions)
    .where(eq(teamOfWeekEditions.seasonId, fromSeasonId));
  for (const row of loserTotw) {
    if (keeperTotwKeys.has(`${row.competitionId}:${row.roundKey}`)) {
      await db.delete(teamOfWeekEditions).where(eq(teamOfWeekEditions.id, row.id));
    } else {
      await db
        .update(teamOfWeekEditions)
        .set({ seasonId: toSeasonId })
        .where(eq(teamOfWeekEditions.id, row.id));
    }
  }

  await db
    .update(teamShirts)
    .set({ seasonId: toSeasonId })
    .where(eq(teamShirts.seasonId, fromSeasonId));
  await db
    .update(playerRadarCaches)
    .set({ seasonId: toSeasonId })
    .where(eq(playerRadarCaches.seasonId, fromSeasonId));

  const keeperShirtPages = await db
    .select({ competitionId: shirtLibraryCompetitionPages.competitionId })
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.seasonId, toSeasonId));
  const keeperShirtPageComps = new Set(keeperShirtPages.map((r) => r.competitionId));
  const loserShirtPages = await db
    .select()
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.seasonId, fromSeasonId));
  for (const row of loserShirtPages) {
    if (keeperShirtPageComps.has(row.competitionId)) {
      await db.delete(shirtLibraryCompetitionPages).where(eq(shirtLibraryCompetitionPages.id, row.id));
    } else {
      await db
        .update(shirtLibraryCompetitionPages)
        .set({ seasonId: toSeasonId })
        .where(eq(shirtLibraryCompetitionPages.id, row.id));
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

  const keeperTotw = await db
    .select({ seasonId: teamOfWeekEditions.seasonId, roundKey: teamOfWeekEditions.roundKey })
    .from(teamOfWeekEditions)
    .where(eq(teamOfWeekEditions.competitionId, toId));
  const keeperTotwRound = new Set(keeperTotw.map((r) => `${r.seasonId}:${r.roundKey}`));
  const loserTotw = await db
    .select()
    .from(teamOfWeekEditions)
    .where(eq(teamOfWeekEditions.competitionId, fromId));
  for (const row of loserTotw) {
    if (keeperTotwRound.has(`${row.seasonId}:${row.roundKey}`)) {
      await db.delete(teamOfWeekEditions).where(eq(teamOfWeekEditions.id, row.id));
    } else {
      await db
        .update(teamOfWeekEditions)
        .set({ competitionId: toId })
        .where(eq(teamOfWeekEditions.id, row.id));
    }
  }

  await db.update(teamShirts).set({ competitionId: toId }).where(eq(teamShirts.competitionId, fromId));

  const keeperPages = await db
    .select({ seasonId: shirtLibraryCompetitionPages.seasonId })
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.competitionId, toId));
  const keeperPageSeasons = new Set(keeperPages.map((r) => r.seasonId));
  const loserPages = await db
    .select()
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.competitionId, fromId));
  for (const row of loserPages) {
    if (keeperPageSeasons.has(row.seasonId)) {
      await db.delete(shirtLibraryCompetitionPages).where(eq(shirtLibraryCompetitionPages.id, row.id));
    } else {
      await db
        .update(shirtLibraryCompetitionPages)
        .set({ competitionId: toId })
        .where(eq(shirtLibraryCompetitionPages.id, row.id));
    }
  }
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

  // Clear unique keys on the loser first so we can move them onto the keeper
  // (or delete the loser) without colliding with competitions_*_unique.
  const loserProviderId = loser.externalProviderId;
  const loserSdms = loser.sdmsCompCode;
  if (loserProviderId || loserSdms) {
    await db
      .update(competitions)
      .set({
        externalProviderId: null,
        sdmsCompCode: null,
      })
      .where(eq(competitions.id, loser.id));
  }

  // Prefer richer provider ids on keeper when missing.
  const patch: Partial<typeof competitions.$inferInsert> = {
    name: canonicalCompetitionDisplayName(keeper.name),
  };
  if (!keeper.externalProviderId && loserProviderId) {
    const clash = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.externalProviderId, loserProviderId))
      .limit(1);
    if (!clash.length) patch.externalProviderId = loserProviderId;
  }
  if (!keeper.sdmsCompCode && loserSdms) {
    const clash = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.sdmsCompCode, loserSdms))
      .limit(1);
    if (!clash.length) patch.sdmsCompCode = loserSdms;
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

/**
 * Merge Supabase-sync `__legacy__` slug clones into the competition whose slug
 * matches the prefix before `__legacy__` (e.g. rugby-championship__legacy__db2fe388
 * → rugby-championship). Falls back to best non-legacy row with the same
 * canonical display name when the exact base slug is missing.
 */
export async function findLegacySlugCompetitionGroups(): Promise<
  Array<{ canonicalName: string; rows: CompRow[] }>
> {
  const rows = await loadCompetitionRows();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const groups = new Map<string, CompRow[]>();

  for (const row of rows) {
    const marker = row.slug.indexOf("__legacy__");
    if (marker < 0) continue;
    const baseSlug = row.slug.slice(0, marker);
    if (!baseSlug) continue;

    const keeper =
      bySlug.get(baseSlug) ??
      rows
        .filter(
          (r) =>
            !r.slug.includes("__legacy__") &&
            canonicalCompetitionDisplayName(r.name).toLowerCase() ===
              canonicalCompetitionDisplayName(row.name).toLowerCase(),
        )
        .sort((a, b) => scoreCompetition(b) - scoreCompetition(a))[0] ??
      null;
    if (!keeper || keeper.id === row.id) continue;

    const key = keeper.id;
    const list = groups.get(key) ?? [keeper];
    if (!list.some((r) => r.id === row.id)) list.push(row);
    groups.set(key, list);
  }

  return [...groups.values()]
    .filter((list) => list.length > 1)
    .map((list) => {
      const sorted = [...list].sort((a, b) => scoreCompetition(b) - scoreCompetition(a));
      return {
        canonicalName: canonicalCompetitionDisplayName(sorted[0]!.name),
        rows: sorted,
      };
    });
}

export async function mergeDuplicateCompetitions(options?: {
  dryRun?: boolean;
}): Promise<CompetitionDedupeSummary> {
  const dryRun = options?.dryRun ?? false;
  // Slug-legacy first (handles renamed display names), then name duplicates.
  const groups = [
    ...(await findLegacySlugCompetitionGroups()),
    ...(await findDuplicateCompetitionGroups()),
  ];
  const summary: CompetitionDedupeSummary = {
    groups: 0,
    merged: 0,
    deleted: 0,
    details: [],
  };
  const seenLosers = new Set<string>();

  for (const group of groups) {
    const [keeper, ...losers] = group.rows;
    if (!keeper) continue;
    const pending = losers.filter((l) => l.id !== keeper.id && !seenLosers.has(l.id));
    if (!pending.length) continue;
    for (const loser of pending) seenLosers.add(loser.id);
    summary.groups += 1;
    summary.details.push({
      canonicalName: group.canonicalName,
      keptId: keeper.id,
      keptSlug: keeper.slug,
      removedIds: pending.map((l) => l.id),
    });
    summary.merged += 1;
    summary.deleted += pending.length;
    if (dryRun) continue;
    for (const loser of pending) {
      await mergeCompetitionPair(keeper, loser);
    }
  }

  return summary;
}

/** Merge `slug__legacy__*` clones into the live `slug` row only. */
export async function mergeLegacyClonesForBaseSlug(
  baseSlug: string,
  options?: { dryRun?: boolean },
): Promise<CompetitionDedupeSummary> {
  const dryRun = options?.dryRun ?? false;
  const groups = await findLegacySlugCompetitionGroups();
  const group = groups.find((g) =>
    g.rows.some((r) => r.slug === baseSlug || r.slug.startsWith(`${baseSlug}__legacy__`)),
  );
  const summary: CompetitionDedupeSummary = {
    groups: 0,
    merged: 0,
    deleted: 0,
    details: [],
  };
  if (!group) return summary;
  const keeper = group.rows.find((r) => r.slug === baseSlug) ?? group.rows[0];
  if (!keeper) return summary;
  const pending = group.rows.filter((r) => r.id !== keeper.id);
  if (!pending.length) return summary;
  summary.groups = 1;
  summary.merged = 1;
  summary.deleted = pending.length;
  summary.details.push({
    canonicalName: group.canonicalName,
    keptId: keeper.id,
    keptSlug: keeper.slug,
    removedIds: pending.map((l) => l.id),
  });
  if (dryRun) return summary;
  // Merge the richest clone first so TotW / stats land on the keeper before empty shells.
  pending.sort((a, b) => b.fixtureCount - a.fixtureCount);
  for (const loser of pending) {
    await mergeCompetitionPair(keeper, loser);
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
