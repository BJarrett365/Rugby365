import { and, eq } from "drizzle-orm";
import {
  coachMatchRatings,
  coaches,
  fixturePlayers,
  fixtures,
  legendCollectionMembers,
  matchEvents,
  playerBioHistory,
  playerBioProfiles,
  playerBioSuggestions,
  playerCareerStints,
  playerExternalMatches,
  playerImageLearningRules,
  playerImages,
  playerInjuries,
  playerLegends,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerProfileVerificationReports,
  playerRadarCaches,
  playerRatings,
  playerSeasonStats,
  playerSelectionTrends,
  playerTeamMemberships,
  playerSuspensions,
  playerTransfers,
  players,
  providerEntityMappings,
  refereeAppointments,
  refereeMatchRatings,
  referees,
  standingRows,
  teamCoachingStaff,
  teamMatchStats,
  teamOfWeekAwards,
  teams,
  venues,
  worldRankingRows,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  canonicalPlayerDisplayName,
  clubNameFromJunkSlug,
  entityNameQualityScore,
  isJunkTeamSlug,
  isSdmsExternalId,
  normalizePlayerName,
  normalizeTeamName,
  normalizedEntityKey,
  stripTeamSponsorAndSeasonLabels,
  teamDedupBaseName,
  teamDedupKey,
} from "./entity-normalize";
import { normalizeSlug } from "./fixture-admin-service";
import { parseWikiTeamLabel } from "@rugby365/import-sdk";

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
  if (row.sourceProvider === "sport365" || row.sourceProvider === "sdms") score += 3;
  if (row.sourceProvider === "rugby_data") score += 2;
  // Prefer clean display names over transfer-note junk ("… released").
  if (/\b(released|retired|left|departed|joined|signed|loaned|deceased|died)\b/i.test(row.name)) {
    score -= 40;
  }
  if (/<[^>]+>/.test(row.name) || /__legacy__/i.test(row.slug)) score -= 20;
  return score;
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
  if (row.slug.includes("__legacy__")) score -= 40;
  if (row.slug.startsWith("orphan-") || /^unknown\b/i.test(row.name)) score -= 100;
  if (/^\{\{/.test(row.name)) score -= 50;
  if (/^t=/i.test(row.name)) score -= 8;
  // Prefer short franchise labels over historic union / sponsor / cite variants.
  if (/\[[\d]+\]/.test(row.name)) score -= 15;
  const base = teamDedupBaseName(row.name);
  const compact = stripTeamSponsorAndSeasonLabels(row.name)
    .replace(/\s*\[\d+\]\s*$/g, "")
    .trim()
    .toLowerCase();
  if (compact === base) score += 10;
  return score;
}

function teamDedupKeysForRow(row: DuplicateEntityRow): string[] {
  const keys = new Set<string>();
  const primary = normalizedEntityKey(row.name, "team");
  if (primary) keys.add(primary);
  if (isJunkTeamSlug(row.slug)) {
    const fromSlug = clubNameFromJunkSlug(row.slug);
    if (fromSlug) keys.add(teamDedupKey(fromSlug));
  }
  if (/^\{\{/.test(row.name)) {
    const parsed = parseWikiTeamLabel(row.name);
    if (parsed) keys.add(teamDedupKey(parsed));
  }
  return [...keys];
}

function buildDuplicateGroups(
  rows: DuplicateEntityRow[],
  kind: "team" | "player",
): DuplicateEntityGroup[] {
  const buckets = new Map<string, DuplicateEntityRow[]>();
  for (const row of rows) {
    const keys =
      kind === "team"
        ? teamDedupKeysForRow(row)
        : [normalizedEntityKey(row.name, kind)].filter((key): key is string => Boolean(key));
    for (const key of keys) {
      const bucket = buckets.get(key) ?? [];
      if (!bucket.some((candidate) => candidate.id === row.id)) bucket.push(row);
      buckets.set(key, bucket);
    }
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

/** Merge overlapping duplicate groups (transitive links via shared team rows). */
function consolidateDuplicateGroups(groups: DuplicateEntityGroup[]): DuplicateEntityGroup[] {
  if (groups.length <= 1) return groups;

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current !== id) {
      const root = find(current);
      parent.set(id, root);
      return root;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  const rowsById = new Map<string, DuplicateEntityRow>();
  for (const group of groups) {
    for (const row of group.rows) {
      rowsById.set(row.id, row);
      union(group.canonicalId, row.id);
    }
  }

  const components = new Map<string, DuplicateEntityRow[]>();
  for (const row of rowsById.values()) {
    const root = find(row.id);
    const bucket = components.get(root) ?? [];
    if (!bucket.some((candidate) => candidate.id === row.id)) bucket.push(row);
    components.set(root, bucket);
  }

  const consolidated: DuplicateEntityGroup[] = [];
  for (const bucket of components.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => scoreTeam(b) - scoreTeam(a) || a.name.localeCompare(b.name));
    const canonical = sorted[0]!;
    consolidated.push({
      key: normalizedEntityKey(canonical.name, "team"),
      normalizedName: normalizeTeamName(canonical.name),
      canonicalId: canonical.id,
      rows: sorted,
      duplicateIds: sorted.slice(1).map((row) => row.id),
    });
  }

  return consolidated.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
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
  return consolidateDuplicateGroups(buildDuplicateGroups(rows, "team"));
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
    if (!canonical.internationalTeamId && dup.internationalTeamId) {
      patch.internationalTeamId = dup.internationalTeamId;
    }
    if (!canonical.birthDate && dup.birthDate) patch.birthDate = dup.birthDate;
    if (!canonical.countryName && dup.countryName) patch.countryName = dup.countryName;
    if (!canonical.positionName && dup.positionName) patch.positionName = dup.positionName;
    if (!canonical.fullName && dup.fullName) patch.fullName = dup.fullName;
    if (!canonical.imageUrl && dup.imageUrl) patch.imageUrl = dup.imageUrl;
    if (!canonical.primaryImageId && dup.primaryImageId) patch.primaryImageId = dup.primaryImageId;
    if (!canonical.wikipediaUrl && dup.wikipediaUrl) patch.wikipediaUrl = dup.wikipediaUrl;
    if (canonical.heightCm == null && dup.heightCm != null) patch.heightCm = dup.heightCm;
    if (canonical.weightKg == null && dup.weightKg != null) patch.weightKg = dup.weightKg;
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

  if (patch.rugbypassPlayerId || patch.rugbypassSlug) {
    // Unique indexes on rugbypass_player_id / rugbypass_slug — clear every holder first.
    if (patch.rugbypassPlayerId) {
      await db
        .update(players)
        .set({ rugbypassPlayerId: null, rugbypassSlug: null, rugbypassUrl: null })
        .where(eq(players.rugbypassPlayerId, patch.rugbypassPlayerId));
    }
    if (patch.rugbypassSlug) {
      await db
        .update(players)
        .set({ rugbypassSlug: null, rugbypassUrl: null })
        .where(eq(players.rugbypassSlug, patch.rugbypassSlug));
    }
    for (const duplicateId of duplicateIds) {
      await db
        .update(players)
        .set({ rugbypassPlayerId: null, rugbypassSlug: null, rugbypassUrl: null })
        .where(eq(players.id, duplicateId));
    }
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

    const careerRows = await db
      .select()
      .from(playerCareerStints)
      .where(eq(playerCareerStints.playerId, duplicateId));
    for (const row of careerRows) {
      const [existing] = await db
        .select({ id: playerCareerStints.id })
        .from(playerCareerStints)
        .where(
          and(
            eq(playerCareerStints.playerId, canonicalId),
            eq(playerCareerStints.careerType, row.careerType),
            eq(playerCareerStints.yearsLabel, row.yearsLabel),
            eq(playerCareerStints.teamName, row.teamName),
          ),
        )
        .limit(1);
      if (existing) await db.delete(playerCareerStints).where(eq(playerCareerStints.id, row.id));
      else
        await db
          .update(playerCareerStints)
          .set({ playerId: canonicalId })
          .where(eq(playerCareerStints.id, row.id));
    }

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

    const imageRows = await db.select().from(playerImages).where(eq(playerImages.playerId, duplicateId));
    for (const row of imageRows) {
      const [existing] = await db
        .select({ id: playerImages.id })
        .from(playerImages)
        .where(and(eq(playerImages.playerId, canonicalId), eq(playerImages.imageUrl, row.imageUrl)))
        .limit(1);
      if (existing) await db.delete(playerImages).where(eq(playerImages.id, row.id));
      else await db.update(playerImages).set({ playerId: canonicalId }).where(eq(playerImages.id, row.id));
    }

    await db
      .update(playerImageLearningRules)
      .set({ playerId: canonicalId })
      .where(eq(playerImageLearningRules.playerId, duplicateId));

    // Radar caches are regenerable; drop dupes rather than risk unique collisions.
    await db.delete(playerRadarCaches).where(eq(playerRadarCaches.playerId, duplicateId));

    await db
      .update(providerEntityMappings)
      .set({ rugby365Id: canonicalId })
      .where(
        and(eq(providerEntityMappings.entityType, "player"), eq(providerEntityMappings.rugby365Id, duplicateId)),
      );

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
export async function mergeTeamRecords(
  canonicalId: string,
  duplicateIds: string[],
  options: { displayName?: string; shortName?: string } = {},
) {
  if (duplicateIds.length === 0) return;
  const db = getDb();

  const [canonical] = await db.select().from(teams).where(eq(teams.id, canonicalId)).limit(1);
  if (!canonical) throw new Error("Canonical team not found");

  const patch: Partial<typeof teams.$inferInsert> = {
    name: (options.displayName ?? normalizeTeamName(canonical.name)).replace(/^t=/i, "").trim(),
  };
  if (options.shortName) patch.shortName = options.shortName;

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
  const errors: string[] = [];

  for (const group of groups) {
    try {
      await mergePlayerRecords(group.canonicalId, group.duplicateIds, {
        displayName: canonicalPlayerDisplayName(group.normalizedName),
      });
      deleted += group.duplicateIds.length;
      details.push({
        key: group.key,
        kept: group.canonicalId,
        removed: group.duplicateIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${group.normalizedName}: ${message}`);
      console.error(`  ✗ merge failed for ${group.normalizedName}: ${message}`);
    }
  }

  if (errors.length) {
    console.error(`Player dedupe completed with ${errors.length} group error(s).`);
  }

  return { groups: groups.length, merged: details.length, deleted, details };
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

// ---------------------------------------------------------------------------
// Referee dedup
// ---------------------------------------------------------------------------

function scoreReferee(row: DuplicateEntityRow): number {
  let score = entityNameQualityScore(row.name);
  if (row.externalProviderId) score += 5;
  if (isSdmsExternalId(row.externalProviderId)) score += 8;
  if (row.sourceProvider === "sport365" || row.sourceProvider === "sdms") score += 3;
  if (row.sourceProvider === "rugby_data") score += 2;
  if (/<[^>]+>/.test(row.name) || /__legacy__/i.test(row.slug)) score -= 20;
  return score;
}

export async function findDuplicateReferees(): Promise<DuplicateEntityGroup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: referees.id,
      name: referees.name,
      slug: referees.slug,
      externalProviderId: referees.externalProviderId,
      sourceProvider: referees.sourceProvider,
    })
    .from(referees);

  const buckets = new Map<string, DuplicateEntityRow[]>();
  for (const row of rows) {
    const key = normalizePlayerName(row.name).toLowerCase();
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  const groups: DuplicateEntityGroup[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => scoreReferee(b) - scoreReferee(a) || a.name.localeCompare(b.name));
    const canonical = sorted[0]!;
    groups.push({
      key,
      normalizedName: normalizePlayerName(canonical.name),
      canonicalId: canonical.id,
      rows: sorted,
      duplicateIds: sorted.slice(1).map((r) => r.id),
    });
  }
  return groups.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

export async function mergeRefereeRecords(canonicalId: string, duplicateIds: string[]) {
  if (duplicateIds.length === 0) return;
  const db = getDb();

  const [canonical] = await db.select().from(referees).where(eq(referees.id, canonicalId)).limit(1);
  if (!canonical) throw new Error("Canonical referee not found");

  const patch: Partial<typeof referees.$inferInsert> = {};

  let bestExternal = canonical.externalProviderId
    ? { id: canonical.externalProviderId, source: canonical.sourceProvider, score: canonical.sourceProvider === "sdms" ? 3 : isSdmsExternalId(canonical.externalProviderId) ? 2 : 1 }
    : null;

  for (const dupId of duplicateIds) {
    const [dup] = await db.select().from(referees).where(eq(referees.id, dupId)).limit(1);
    if (!dup) continue;
    if (dup.externalProviderId) {
      const score = dup.sourceProvider === "sdms" ? 3 : isSdmsExternalId(dup.externalProviderId) ? 2 : 1;
      if (!bestExternal || score > bestExternal.score) bestExternal = { id: dup.externalProviderId, source: dup.sourceProvider, score };
    }
    if (!canonical.birthDate && dup.birthDate) patch.birthDate = dup.birthDate;
    if (!canonical.nationality && dup.nationality) patch.nationality = dup.nationality;
    if (!canonical.countryName && dup.countryName) patch.countryName = dup.countryName;
    if (!canonical.imageUrl && dup.imageUrl) patch.imageUrl = dup.imageUrl;
    if (!canonical.wikipediaUrl && dup.wikipediaUrl) patch.wikipediaUrl = dup.wikipediaUrl;
  }

  if (bestExternal && bestExternal.id !== canonical.externalProviderId) {
    for (const dupId of duplicateIds) {
      await db.update(referees).set({ externalProviderId: null, sourceProvider: "manual" }).where(eq(referees.id, dupId));
    }
    patch.externalProviderId = bestExternal.id;
    patch.sourceProvider = bestExternal.source;
  }

  if (Object.keys(patch).length) {
    await db.update(referees).set(patch).where(eq(referees.id, canonicalId));
  }

  for (const dupId of duplicateIds) {
    await db.update(fixtures).set({ refereeId: canonicalId }).where(eq(fixtures.refereeId, dupId));

    const apptRows = await db.select().from(refereeAppointments).where(eq(refereeAppointments.refereeId, dupId));
    for (const row of apptRows) {
      if (row.fixtureId) {
        const [existing] = await db.select({ id: refereeAppointments.id }).from(refereeAppointments)
          .where(and(eq(refereeAppointments.refereeId, canonicalId), eq(refereeAppointments.fixtureId, row.fixtureId)))
          .limit(1);
        if (existing) { await db.delete(refereeAppointments).where(eq(refereeAppointments.id, row.id)); continue; }
      }
      await db.update(refereeAppointments).set({ refereeId: canonicalId }).where(eq(refereeAppointments.id, row.id));
    }

    const ratingRows = await db.select().from(refereeMatchRatings).where(eq(refereeMatchRatings.refereeId, dupId));
    for (const row of ratingRows) {
      const [existing] = await db.select({ id: refereeMatchRatings.id }).from(refereeMatchRatings)
        .where(and(eq(refereeMatchRatings.fixtureId, row.fixtureId), eq(refereeMatchRatings.refereeId, canonicalId)))
        .limit(1);
      if (existing) await db.delete(refereeMatchRatings).where(eq(refereeMatchRatings.id, row.id));
      else await db.update(refereeMatchRatings).set({ refereeId: canonicalId }).where(eq(refereeMatchRatings.id, row.id));
    }

    await db.update(teamOfWeekAwards).set({ refereeId: canonicalId }).where(eq(teamOfWeekAwards.refereeId, dupId));

    await db.update(providerEntityMappings).set({ rugby365Id: canonicalId })
      .where(and(eq(providerEntityMappings.entityType, "referee"), eq(providerEntityMappings.rugby365Id, dupId)));

    await db.delete(referees).where(eq(referees.id, dupId));
  }
}

export async function dedupeReferees(): Promise<DedupeSummary> {
  const groups = await findDuplicateReferees();
  const details: DedupeSummary["details"] = [];
  let deleted = 0;
  const errors: string[] = [];

  for (const group of groups) {
    try {
      await mergeRefereeRecords(group.canonicalId, group.duplicateIds);
      deleted += group.duplicateIds.length;
      details.push({ key: group.key, kept: group.canonicalId, removed: group.duplicateIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${group.normalizedName}: ${message}`);
      console.error(`  ✗ referee merge failed for ${group.normalizedName}: ${message}`);
    }
  }

  if (errors.length) console.error(`Referee dedupe completed with ${errors.length} error(s).`);
  return { groups: groups.length, merged: details.length, deleted, details };
}

// ---------------------------------------------------------------------------
// Coach dedup
// ---------------------------------------------------------------------------

function scoreCoach(row: DuplicateEntityRow): number {
  let score = entityNameQualityScore(row.name);
  if (row.externalProviderId) score += 5;
  if (isSdmsExternalId(row.externalProviderId)) score += 8;
  if (row.sourceProvider === "sport365" || row.sourceProvider === "sdms") score += 3;
  if (row.sourceProvider === "rugby_data") score += 2;
  if (/<[^>]+>/.test(row.name) || /__legacy__/i.test(row.slug)) score -= 20;
  return score;
}

export async function findDuplicateCoaches(): Promise<DuplicateEntityGroup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: coaches.id,
      name: coaches.name,
      slug: coaches.slug,
      externalProviderId: coaches.externalProviderId,
      sourceProvider: coaches.sourceProvider,
    })
    .from(coaches);

  const buckets = new Map<string, DuplicateEntityRow[]>();
  for (const row of rows) {
    const key = normalizePlayerName(row.name).toLowerCase();
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  const groups: DuplicateEntityGroup[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => scoreCoach(b) - scoreCoach(a) || a.name.localeCompare(b.name));
    const canonical = sorted[0]!;
    groups.push({
      key,
      normalizedName: normalizePlayerName(canonical.name),
      canonicalId: canonical.id,
      rows: sorted,
      duplicateIds: sorted.slice(1).map((r) => r.id),
    });
  }
  return groups.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

export async function mergeCoachRecords(canonicalId: string, duplicateIds: string[]) {
  if (duplicateIds.length === 0) return;
  const db = getDb();

  const [canonical] = await db.select().from(coaches).where(eq(coaches.id, canonicalId)).limit(1);
  if (!canonical) throw new Error("Canonical coach not found");

  const patch: Partial<typeof coaches.$inferInsert> = {};

  let bestExternal = canonical.externalProviderId
    ? { id: canonical.externalProviderId, source: canonical.sourceProvider, score: canonical.sourceProvider === "sdms" ? 3 : isSdmsExternalId(canonical.externalProviderId) ? 2 : 1 }
    : null;

  for (const dupId of duplicateIds) {
    const [dup] = await db.select().from(coaches).where(eq(coaches.id, dupId)).limit(1);
    if (!dup) continue;
    if (dup.externalProviderId) {
      const score = dup.sourceProvider === "sdms" ? 3 : isSdmsExternalId(dup.externalProviderId) ? 2 : 1;
      if (!bestExternal || score > bestExternal.score) bestExternal = { id: dup.externalProviderId, source: dup.sourceProvider, score };
    }
    if (!canonical.birthDate && dup.birthDate) patch.birthDate = dup.birthDate;
    if (!canonical.nationality && dup.nationality) patch.nationality = dup.nationality;
    if (!canonical.imageUrl && dup.imageUrl) patch.imageUrl = dup.imageUrl;
    if (!canonical.wikipediaUrl && dup.wikipediaUrl) patch.wikipediaUrl = dup.wikipediaUrl;
  }

  if (bestExternal && bestExternal.id !== canonical.externalProviderId) {
    for (const dupId of duplicateIds) {
      await db.update(coaches).set({ externalProviderId: null, sourceProvider: "manual" }).where(eq(coaches.id, dupId));
    }
    patch.externalProviderId = bestExternal.id;
    patch.sourceProvider = bestExternal.source;
  }

  if (Object.keys(patch).length) {
    await db.update(coaches).set(patch).where(eq(coaches.id, canonicalId));
  }

  for (const dupId of duplicateIds) {
    await db.update(fixtures).set({ homeCoachId: canonicalId }).where(eq(fixtures.homeCoachId, dupId));
    await db.update(fixtures).set({ awayCoachId: canonicalId }).where(eq(fixtures.awayCoachId, dupId));

    const staffRows = await db.select().from(teamCoachingStaff).where(eq(teamCoachingStaff.coachId, dupId));
    for (const row of staffRows) {
      const [existing] = await db.select({ id: teamCoachingStaff.id }).from(teamCoachingStaff)
        .where(and(eq(teamCoachingStaff.teamId, row.teamId), eq(teamCoachingStaff.coachId, canonicalId), eq(teamCoachingStaff.role, row.role)))
        .limit(1);
      if (existing) await db.delete(teamCoachingStaff).where(eq(teamCoachingStaff.id, row.id));
      else await db.update(teamCoachingStaff).set({ coachId: canonicalId }).where(eq(teamCoachingStaff.id, row.id));
    }

    const ratingRows = await db.select().from(coachMatchRatings).where(eq(coachMatchRatings.coachId, dupId));
    for (const row of ratingRows) {
      const [existing] = await db.select({ id: coachMatchRatings.id }).from(coachMatchRatings)
        .where(and(eq(coachMatchRatings.fixtureId, row.fixtureId), eq(coachMatchRatings.coachId, canonicalId)))
        .limit(1);
      if (existing) await db.delete(coachMatchRatings).where(eq(coachMatchRatings.id, row.id));
      else await db.update(coachMatchRatings).set({ coachId: canonicalId }).where(eq(coachMatchRatings.id, row.id));
    }

    const legendRows = await db.select().from(legendCollectionMembers).where(eq(legendCollectionMembers.coachId, dupId));
    for (const row of legendRows) {
      const [existing] = await db.select({ id: legendCollectionMembers.id }).from(legendCollectionMembers)
        .where(and(eq(legendCollectionMembers.collectionId, row.collectionId), eq(legendCollectionMembers.coachId, canonicalId)))
        .limit(1);
      if (existing) await db.delete(legendCollectionMembers).where(eq(legendCollectionMembers.id, row.id));
      else await db.update(legendCollectionMembers).set({ coachId: canonicalId }).where(eq(legendCollectionMembers.id, row.id));
    }

    await db.update(teamOfWeekAwards).set({ coachId: canonicalId }).where(eq(teamOfWeekAwards.coachId, dupId));

    await db.update(providerEntityMappings).set({ rugby365Id: canonicalId })
      .where(and(eq(providerEntityMappings.entityType, "coach"), eq(providerEntityMappings.rugby365Id, dupId)));

    await db.delete(coaches).where(eq(coaches.id, dupId));
  }
}

export async function dedupeCoaches(): Promise<DedupeSummary> {
  const groups = await findDuplicateCoaches();
  const details: DedupeSummary["details"] = [];
  let deleted = 0;
  const errors: string[] = [];

  for (const group of groups) {
    try {
      await mergeCoachRecords(group.canonicalId, group.duplicateIds);
      deleted += group.duplicateIds.length;
      details.push({ key: group.key, kept: group.canonicalId, removed: group.duplicateIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${group.normalizedName}: ${message}`);
      console.error(`  ✗ coach merge failed for ${group.normalizedName}: ${message}`);
    }
  }

  if (errors.length) console.error(`Coach dedupe completed with ${errors.length} error(s).`);
  return { groups: groups.length, merged: details.length, deleted, details };
}

// ---------------------------------------------------------------------------
// Combined dedup
// ---------------------------------------------------------------------------

export async function dedupeAllEntities(): Promise<{
  players: DedupeSummary;
  teams: DedupeSummary;
  referees: DedupeSummary;
  coaches: DedupeSummary;
}> {
  const playerResult = await dedupePlayers();
  const teamResult = await dedupeTeams();
  const refereeResult = await dedupeReferees();
  const coachResult = await dedupeCoaches();
  return { players: playerResult, teams: teamResult, referees: refereeResult, coaches: coachResult };
}

export async function duplicateEntityCounts() {
  const [playerGroups, teamGroups, refereeGroups, coachGroups] = await Promise.all([
    findDuplicatePlayers(),
    findDuplicateTeams(),
    findDuplicateReferees(),
    findDuplicateCoaches(),
  ]);
  return {
    players: {
      groups: playerGroups.length,
      rows: playerGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
    teams: {
      groups: teamGroups.length,
      rows: teamGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
    referees: {
      groups: refereeGroups.length,
      rows: refereeGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
    coaches: {
      groups: coachGroups.length,
      rows: coachGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    },
  };
}
