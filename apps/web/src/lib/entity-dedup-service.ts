import { and, eq } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  matchEvents,
  playerBioHistory,
  playerBioProfiles,
  playerBioSuggestions,
  playerCareerStints,
  playerExternalMatches,
  playerInjuries,
  playerLegends,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerProfileVerificationReports,
  playerRatings,
  playerSeasonStats,
  playerSelectionTrends,
  playerTeamMemberships,
  playerSuspensions,
  playerTransfers,
  players,
  standingRows,
  teamCoachingStaff,
  teamMatchStats,
  teams,
  venues,
  worldRankingRows,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  canonicalPlayerDisplayName,
  entityNameQualityScore,
  isSdmsExternalId,
  normalizePlayerName,
  normalizeTeamName,
  normalizedEntityKey,
} from "./entity-normalize";
import { normalizeSlug } from "./fixture-admin-service";

export type DuplicateEntityRow = {
  id: string;
  name: string;
  slug: string;
  externalProviderId: string | null;
  sourceProvider: string;
};

export type DuplicateEntityGroup = {
  key: string;
  normalizedName: string;
  canonicalId: string;
  rows: DuplicateEntityRow[];
  duplicateIds: string[];
};

export type DedupeSummary = {
  groups: number;
  merged: number;
  deleted: number;
  details: Array<{ key: string; kept: string; removed: string[] }>;
};

function scorePlayer(row: DuplicateEntityRow): number {
  let score = entityNameQualityScore(row.name);
  if (row.externalProviderId) score += 5;
  if (isSdmsExternalId(row.externalProviderId)) score += 8;
  return score;
}

function isJunkTeamSlug(slug: string): boolean {
  return (
    slug.startsWith("flagicon-") ||
    slug.includes("ref-cite") ||
    slug.includes("ref-name") ||
    slug.includes("url-https") ||
    slug.includes("access-date") ||
    slug.length > 60
  );
}

function scoreTeam(row: DuplicateEntityRow): number {
  let score = entityNameQualityScore(row.name);
  const canonicalSlug = normalizeSlug(normalizeTeamName(row.name));
  if (row.slug === canonicalSlug) score += 20;
  if (row.externalProviderId) score += 6;
  if (isSdmsExternalId(row.externalProviderId)) score += 4;
  if (/\brugby\b/i.test(row.name)) score += 2;
  if (!isJunkTeamSlug(row.slug)) score += 12;
  if (row.slug.length <= 32) score += 4;
  if (isJunkTeamSlug(row.slug)) score -= 80;
  return score;
}

function buildDuplicateGroups(
  rows: DuplicateEntityRow[],
  kind: "team" | "player",
): DuplicateEntityGroup[] {
  const buckets = new Map<string, DuplicateEntityRow[]>();
  for (const row of rows) {
    const key = normalizedEntityKey(row.name, kind);
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  const groups: DuplicateEntityGroup[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => {
      const scoreDiff = (kind === "player" ? scorePlayer(b) : scoreTeam(b)) -
        (kind === "player" ? scorePlayer(a) : scoreTeam(a));
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    });
    const canonical = sorted[0]!;
    groups.push({
      key,
      normalizedName: kind === "player" ? normalizePlayerName(canonical.name) : normalizeTeamName(canonical.name),
      canonicalId: canonical.id,
      rows: sorted,
      duplicateIds: sorted.slice(1).map((row) => row.id),
    });
  }

  return groups.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

export async function findDuplicatePlayers(): Promise<DuplicateEntityGroup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      externalProviderId: players.externalProviderId,
      sourceProvider: players.sourceProvider,
    })
    .from(players);
  return buildDuplicateGroups(rows, "player");
}

export async function findDuplicateTeams(): Promise<DuplicateEntityGroup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      externalProviderId: teams.externalProviderId,
      sourceProvider: teams.sourceProvider,
    })
    .from(teams);
  return buildDuplicateGroups(rows, "team");
}

/** Merge duplicate player rows into a canonical player, rewiring related records. */
export async function mergePlayerRecords(
  canonicalId: string,
  duplicateIds: string[],
  options: { displayName?: string } = {},
) {
  if (duplicateIds.length === 0) return;
  const db = getDb();

  const [canonical] = await db.select().from(players).where(eq(players.id, canonicalId)).limit(1);
  if (!canonical) throw new Error("Canonical player not found");

  const patch: Partial<typeof players.$inferInsert> = {
    name: options.displayName ?? canonicalPlayerDisplayName(canonical.name),
  };

  let bestExternal = canonical.externalProviderId
    ? {
        id: canonical.externalProviderId,
        source: canonical.sourceProvider,
        score: canonical.sourceProvider === "sdms" ? 3 : isSdmsExternalId(canonical.externalProviderId) ? 2 : 1,
      }
    : null;

  for (const duplicateId of duplicateIds) {
    const [dup] = await db.select().from(players).where(eq(players.id, duplicateId)).limit(1);
    if (!dup) continue;
    if (dup.externalProviderId) {
      const score = dup.sourceProvider === "sdms" ? 3 : isSdmsExternalId(dup.externalProviderId) ? 2 : 1;
      if (!bestExternal || score > bestExternal.score) {
        bestExternal = { id: dup.externalProviderId, source: dup.sourceProvider, score };
      }
    }
    if (!canonical.clubTeamId && dup.clubTeamId) patch.clubTeamId = dup.clubTeamId;
    if (!canonical.birthDate && dup.birthDate) patch.birthDate = dup.birthDate;
    if (!canonical.countryName && dup.countryName) patch.countryName = dup.countryName;
    if (!canonical.positionName && dup.positionName) patch.positionName = dup.positionName;
    if (!canonical.fullName && dup.fullName) patch.fullName = dup.fullName;
    if (!canonical.imageUrl && dup.imageUrl) patch.imageUrl = dup.imageUrl;
    if (!canonical.rugbypassPlayerId && dup.rugbypassPlayerId) {
      patch.rugbypassPlayerId = dup.rugbypassPlayerId;
      patch.rugbypassSlug = dup.rugbypassSlug;
      patch.rugbypassUrl = dup.rugbypassUrl;
    }
  }

  if (bestExternal && bestExternal.id !== canonical.externalProviderId) {
    // Clear colliding external IDs on duplicates before assigning to canonical.
    for (const duplicateId of duplicateIds) {
      await db
        .update(players)
        .set({ externalProviderId: null, sourceProvider: "manual" })
        .where(eq(players.id, duplicateId));
    }
    patch.externalProviderId = bestExternal.id;
    patch.sourceProvider = bestExternal.source;
  }

  await db.update(players).set(patch).where(eq(players.id, canonicalId));

  for (const duplicateId of duplicateIds) {
    const squadRows = await db
      .select()
      .from(fixturePlayers)
      .where(eq(fixturePlayers.playerId, duplicateId));

    for (const squad of squadRows) {
      const [existing] = await db
        .select({ id: fixturePlayers.id })
        .from(fixturePlayers)
        .where(and(eq(fixturePlayers.fixtureId, squad.fixtureId), eq(fixturePlayers.playerId, canonicalId)))
        .limit(1);

      if (existing) {
        await db.delete(fixturePlayers).where(eq(fixturePlayers.id, squad.id));
      } else {
        await db.update(fixturePlayers).set({ playerId: canonicalId }).where(eq(fixturePlayers.id, squad.id));
      }
    }

    await db.update(matchEvents).set({ playerId: canonicalId }).where(eq(matchEvents.playerId, duplicateId));
    await db
      .update(playerTransfers)
      .set({ playerId: canonicalId })
      .where(eq(playerTransfers.playerId, duplicateId));
    await db
      .update(playerCareerStints)
      .set({ playerId: canonicalId })
      .where(eq(playerCareerStints.playerId, duplicateId));

    const membershipRows = await db
      .select()
      .from(playerTeamMemberships)
      .where(eq(playerTeamMemberships.playerId, duplicateId));
    for (const row of membershipRows) {
      const [existing] = await db
        .select({ id: playerTeamMemberships.id })
        .from(playerTeamMemberships)
        .where(
          and(
            eq(playerTeamMemberships.playerId, canonicalId),
            eq(playerTeamMemberships.teamId, row.teamId),
            eq(playerTeamMemberships.seasonId, row.seasonId),
          ),
        )
        .limit(1);
      if (existing) await db.delete(playerTeamMemberships).where(eq(playerTeamMemberships.id, row.id));
      else
        await db
          .update(playerTeamMemberships)
          .set({ playerId: canonicalId })
          .where(eq(playerTeamMemberships.id, row.id));
    }

    const perfRows = await db
      .select()
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.playerId, duplicateId));
    for (const row of perfRows) {
      const [existing] = await db
        .select({ id: playerMatchPerformanceStats.id })
        .from(playerMatchPerformanceStats)
        .where(
          and(
            eq(playerMatchPerformanceStats.fixtureId, row.fixtureId),
            eq(playerMatchPerformanceStats.playerId, canonicalId),
          ),
        )
        .limit(1);
      if (existing) await db.delete(playerMatchPerformanceStats).where(eq(playerMatchPerformanceStats.id, row.id));
      else
        await db
          .update(playerMatchPerformanceStats)
          .set({ playerId: canonicalId })
          .where(eq(playerMatchPerformanceStats.id, row.id));
    }

    const seasonRows = await db
      .select()
      .from(playerSeasonStats)
      .where(eq(playerSeasonStats.playerId, duplicateId));
    for (const row of seasonRows) {
      const [existing] = await db
        .select({ id: playerSeasonStats.id })
        .from(playerSeasonStats)
        .where(
          and(
            eq(playerSeasonStats.playerId, canonicalId),
            eq(playerSeasonStats.seasonId, row.seasonId),
            eq(playerSeasonStats.teamId, row.teamId),
          ),
        )
        .limit(1);
      if (existing) await db.delete(playerSeasonStats).where(eq(playerSeasonStats.id, row.id));
      else
        await db
          .update(playerSeasonStats)
          .set({ playerId: canonicalId })
          .where(eq(playerSeasonStats.id, row.id));
    }

    const matchRatingRows = await db
      .select()
      .from(playerMatchRatings)
      .where(eq(playerMatchRatings.playerId, duplicateId));
    for (const row of matchRatingRows) {
      const [existing] = await db
        .select({ id: playerMatchRatings.id })
        .from(playerMatchRatings)
        .where(
          and(eq(playerMatchRatings.fixtureId, row.fixtureId), eq(playerMatchRatings.playerId, canonicalId)),
        )
        .limit(1);
      if (existing) await db.delete(playerMatchRatings).where(eq(playerMatchRatings.id, row.id));
      else
        await db
          .update(playerMatchRatings)
          .set({ playerId: canonicalId })
          .where(eq(playerMatchRatings.id, row.id));
    }

    const trendRows = await db
      .select()
      .from(playerSelectionTrends)
      .where(eq(playerSelectionTrends.playerId, duplicateId));
    for (const row of trendRows) {
      const [existing] = await db
        .select({ id: playerSelectionTrends.id })
        .from(playerSelectionTrends)
        .where(
          and(
            eq(playerSelectionTrends.fixtureId, row.fixtureId),
            eq(playerSelectionTrends.playerId, canonicalId),
          ),
        )
        .limit(1);
      if (existing) await db.delete(playerSelectionTrends).where(eq(playerSelectionTrends.id, row.id));
      else
        await db
          .update(playerSelectionTrends)
          .set({ playerId: canonicalId })
          .where(eq(playerSelectionTrends.id, row.id));
    }

    const [canonicalRating] = await db
      .select()
      .from(playerRatings)
      .where(eq(playerRatings.playerId, canonicalId))
      .limit(1);
    if (canonicalRating) {
      await db.delete(playerRatings).where(eq(playerRatings.playerId, duplicateId));
    } else {
      await db
        .update(playerRatings)
        .set({ playerId: canonicalId })
        .where(eq(playerRatings.playerId, duplicateId));
    }

    const [canonicalBio] = await db
      .select()
      .from(playerBioProfiles)
      .where(eq(playerBioProfiles.playerId, canonicalId))
      .limit(1);
    if (canonicalBio) {
      await db.delete(playerBioProfiles).where(eq(playerBioProfiles.playerId, duplicateId));
    } else {
      await db
        .update(playerBioProfiles)
        .set({ playerId: canonicalId })
        .where(eq(playerBioProfiles.playerId, duplicateId));
    }

    await db
      .update(playerBioSuggestions)
      .set({ playerId: canonicalId })
      .where(eq(playerBioSuggestions.playerId, duplicateId));
    await db
      .update(playerBioHistory)
      .set({ playerId: canonicalId })
      .where(eq(playerBioHistory.playerId, duplicateId));
    await db
      .update(playerProfileVerificationReports)
      .set({ playerId: canonicalId })
      .where(eq(playerProfileVerificationReports.playerId, duplicateId));
    await db
      .update(playerInjuries)
      .set({ playerId: canonicalId })
      .where(eq(playerInjuries.playerId, duplicateId));
    await db
      .update(playerSuspensions)
      .set({ playerId: canonicalId })
      .where(eq(playerSuspensions.playerId, duplicateId));
    await db
      .update(playerExternalMatches)
      .set({ playerId: canonicalId })
      .where(eq(playerExternalMatches.playerId, duplicateId));
    await db
      .update(playerLegends)
      .set({ playerId: canonicalId })
      .where(eq(playerLegends.playerId, duplicateId));

    await db
      .update(fixtures)
      .set({ rugby365PotmPlayerId: canonicalId })
      .where(eq(fixtures.rugby365PotmPlayerId, duplicateId));
    await db
      .update(fixtures)
      .set({ officialPotmPlayerId: canonicalId })
      .where(eq(fixtures.officialPotmPlayerId, duplicateId));

    await db.delete(players).where(eq(players.id, duplicateId));
  }
}

/** Merge duplicate team rows into a canonical team, rewiring related records. */
export async function mergeTeamRecords(canonicalId: string, duplicateIds: string[]) {
  if (duplicateIds.length === 0) return;
  const db = getDb();

  const [canonical] = await db.select().from(teams).where(eq(teams.id, canonicalId)).limit(1);
  if (!canonical) throw new Error("Canonical team not found");

  const patch: Partial<typeof teams.$inferInsert> = {
    name: normalizeTeamName(canonical.name),
  };

  for (const duplicateId of duplicateIds) {
    const [dup] = await db.select().from(teams).where(eq(teams.id, duplicateId)).limit(1);
    if (!dup) continue;
    if (!canonical.externalProviderId && !patch.externalProviderId && dup.externalProviderId) {
      await db
        .update(teams)
        .set({ externalProviderId: null, sourceProvider: "manual" })
        .where(eq(teams.id, duplicateId));
      patch.externalProviderId = dup.externalProviderId;
      patch.sourceProvider = dup.sourceProvider;
    }
  }

  if (Object.keys(patch).length > 1 || patch.name !== canonical.name) {
    await db.update(teams).set(patch).where(eq(teams.id, canonicalId));
  }

  for (const duplicateId of duplicateIds) {
    await db
      .update(fixtures)
      .set({ homeTeamId: canonicalId })
      .where(eq(fixtures.homeTeamId, duplicateId));
    await db
      .update(fixtures)
      .set({ awayTeamId: canonicalId })
      .where(eq(fixtures.awayTeamId, duplicateId));
    await db.update(venues).set({ teamId: canonicalId }).where(eq(venues.teamId, duplicateId));
    await db.update(teams).set({ homeVenueId: null }).where(eq(teams.homeVenueId, duplicateId));
    await db.update(players).set({ clubTeamId: canonicalId }).where(eq(players.clubTeamId, duplicateId));
    await db
      .update(players)
      .set({ internationalTeamId: canonicalId })
      .where(eq(players.internationalTeamId, duplicateId));
    await db
      .update(playerTransfers)
      .set({ fromTeamId: canonicalId })
      .where(eq(playerTransfers.fromTeamId, duplicateId));
    await db
      .update(playerTransfers)
      .set({ toTeamId: canonicalId })
      .where(eq(playerTransfers.toTeamId, duplicateId));
    await db
      .update(playerCareerStints)
      .set({ teamId: canonicalId })
      .where(eq(playerCareerStints.teamId, duplicateId));
    await db
      .update(fixturePlayers)
      .set({ teamId: canonicalId })
      .where(eq(fixturePlayers.teamId, duplicateId));
    await db.update(matchEvents).set({ teamId: canonicalId }).where(eq(matchEvents.teamId, duplicateId));

    const coachingDupes = await db
      .select()
      .from(teamCoachingStaff)
      .where(eq(teamCoachingStaff.teamId, duplicateId));
    for (const row of coachingDupes) {
      const [conflict] = await db
        .select({ id: teamCoachingStaff.id })
        .from(teamCoachingStaff)
        .where(
          and(
            eq(teamCoachingStaff.teamId, canonicalId),
            eq(teamCoachingStaff.coachId, row.coachId),
            eq(teamCoachingStaff.role, row.role),
          ),
        )
        .limit(1);
      if (conflict) await db.delete(teamCoachingStaff).where(eq(teamCoachingStaff.id, row.id));
      else await db.update(teamCoachingStaff).set({ teamId: canonicalId }).where(eq(teamCoachingStaff.id, row.id));
    }

    const teamStatsDupes = await db
      .select()
      .from(teamMatchStats)
      .where(eq(teamMatchStats.teamId, duplicateId));
    for (const row of teamStatsDupes) {
      const [conflict] = await db
        .select({ id: teamMatchStats.id })
        .from(teamMatchStats)
        .where(
          and(
            eq(teamMatchStats.fixtureId, row.fixtureId),
            eq(teamMatchStats.teamId, canonicalId),
            eq(teamMatchStats.sourceProvider, row.sourceProvider),
          ),
        )
        .limit(1);
      if (conflict) await db.delete(teamMatchStats).where(eq(teamMatchStats.id, row.id));
      else await db.update(teamMatchStats).set({ teamId: canonicalId }).where(eq(teamMatchStats.id, row.id));
    }

    await db
      .update(playerMatchPerformanceStats)
      .set({ teamId: canonicalId })
      .where(eq(playerMatchPerformanceStats.teamId, duplicateId));

    const seasonStatsDupes = await db
      .select()
      .from(playerSeasonStats)
      .where(eq(playerSeasonStats.teamId, duplicateId));
    for (const row of seasonStatsDupes) {
      const [conflict] = await db
        .select({ id: playerSeasonStats.id })
        .from(playerSeasonStats)
        .where(
          and(
            eq(playerSeasonStats.playerId, row.playerId),
            eq(playerSeasonStats.seasonId, row.seasonId),
            eq(playerSeasonStats.competitionId, row.competitionId),
            eq(playerSeasonStats.teamId, canonicalId),
          ),
        )
        .limit(1);
      if (conflict) await db.delete(playerSeasonStats).where(eq(playerSeasonStats.id, row.id));
      else await db.update(playerSeasonStats).set({ teamId: canonicalId }).where(eq(playerSeasonStats.id, row.id));
    }

    await db.update(worldRankingRows).set({ teamId: canonicalId }).where(eq(worldRankingRows.teamId, duplicateId));
    await db.update(playerInjuries).set({ teamId: canonicalId }).where(eq(playerInjuries.teamId, duplicateId));
    await db.update(playerSuspensions).set({ teamId: canonicalId }).where(eq(playerSuspensions.teamId, duplicateId));

    const standingDupes = await db
      .select()
      .from(standingRows)
      .where(eq(standingRows.teamId, duplicateId));

    for (const row of standingDupes) {
      const [conflict] = await db
        .select({ id: standingRows.id })
        .from(standingRows)
        .where(
          and(
            eq(standingRows.seasonId, row.seasonId),
            eq(standingRows.teamId, canonicalId),
            eq(standingRows.view, row.view),
          ),
        )
        .limit(1);

      if (conflict) {
        await db.delete(standingRows).where(eq(standingRows.id, row.id));
      } else {
        await db.update(standingRows).set({ teamId: canonicalId }).where(eq(standingRows.id, row.id));
      }
    }

    await db.delete(teams).where(eq(teams.id, duplicateId));
  }
}

export async function dedupePlayers(): Promise<DedupeSummary> {
  const groups = await findDuplicatePlayers();
  const details: DedupeSummary["details"] = [];
  let deleted = 0;

  for (const group of groups) {
    await mergePlayerRecords(group.canonicalId, group.duplicateIds);
    deleted += group.duplicateIds.length;
    details.push({
      key: group.key,
      kept: group.canonicalId,
      removed: group.duplicateIds,
    });
  }

  return { groups: groups.length, merged: groups.length, deleted, details };
}

export async function dedupeTeams(): Promise<DedupeSummary> {
  const groups = await findDuplicateTeams();
  const details: DedupeSummary["details"] = [];
  let deleted = 0;

  for (const group of groups) {
    await mergeTeamRecords(group.canonicalId, group.duplicateIds);
    deleted += group.duplicateIds.length;
    details.push({
      key: group.key,
      kept: group.canonicalId,
      removed: group.duplicateIds,
    });
  }

  return { groups: groups.length, merged: groups.length, deleted, details };
}

export async function dedupeAllEntities(): Promise<{ players: DedupeSummary; teams: DedupeSummary }> {
  const players = await dedupePlayers();
  const teams = await dedupeTeams();
  return { players, teams };
}

export async function duplicateEntityCounts() {
  const [playerGroups, teamGroups] = await Promise.all([findDuplicatePlayers(), findDuplicateTeams()]);
  return {
    players: {
      groups: playerGroups.length,
      rows: playerGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
    teams: {
      groups: teamGroups.length,
      rows: teamGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
  };
}
