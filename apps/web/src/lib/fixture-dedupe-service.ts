import { eq, inArray, sql } from "drizzle-orm";
import {
  commentarySuggestions,
  fixturePlayers,
  fixtures,
  matchCommentary,
  matchEvents,
  playerMatchPerformanceStats,
  playerMatchRatings,
  teamMatchStats,
} from "@rugby365/db";
import { canonicalCompetitionDisplayName } from "./competition-list-utils";
import { getDb } from "./db";
import { deleteFixture } from "./fixture-admin-service";

export type FixtureDedupeRow = {
  id: string;
  slug: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  kickoffAt: Date | null;
  competitionId: string | null;
  seasonId: string | null;
  competitionName: string | null;
  status: string;
  homeScore: number;
  awayScore: number;
  sport365Url: string | null;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  venueId: string | null;
  venueName: string | null;
  attendance: number | null;
  refereeId: string | null;
  refereeName: string | null;
  homeCoachId: string | null;
  awayCoachId: string | null;
  round: string | null;
  providerSnapshot: unknown;
  rugby365PotmPlayerId: string | null;
  officialPotmPlayerId: string | null;
  officialPotmName: string | null;
};

export type FixtureDuplicateGroup = {
  matchDay: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  fixtures: FixtureDedupeRow[];
};

export type FixtureDedupeAction = {
  keeperId: string;
  keeperSlug: string;
  removedIds: string[];
  mergedFields: string[];
};

export type FixtureDedupeReport = {
  dryRun: boolean;
  groupsFound: number;
  groupsMerged: number;
  fixturesRemoved: number;
  actions: FixtureDedupeAction[];
};

function kickoffDateKey(kickoffAt: Date | null): string | null {
  if (!kickoffAt) return null;
  return kickoffAt.toISOString().slice(0, 10);
}

export function fixtureIdentityKey(input: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  kickoffAt: Date | null;
}): string | null {
  if (!input.homeTeamId || !input.awayTeamId || !input.kickoffAt) return null;
  return `${input.homeTeamId}:${input.awayTeamId}:${kickoffDateKey(input.kickoffAt)}`;
}

export function scoreFixtureForCanonical(row: FixtureDedupeRow): number {
  let score = 0;
  if (row.planetRugbyUrl) score += 100;
  if (row.sport365Url) score += 60;
  if (row.externalMatchId && !row.externalMatchId.includes(":")) score += 50;
  if (row.competitionId) score += 30;
  if (row.seasonId) score += 25;
  if (row.venueId) score += 20;
  if (row.attendance != null && row.attendance > 0) score += 15;
  if (row.refereeId) score += 10;
  if (row.homeCoachId || row.awayCoachId) score += 8;
  if (row.providerSnapshot) score += 5;
  if (/-\d{4}-\d{2}-\d{2}$/.test(row.slug)) score += 12;
  if (row.externalMatchId?.startsWith("livesport:")) score -= 40;
  if (row.externalMatchId?.startsWith("wikipedia:")) score -= 30;
  if (row.slug.includes("-v-") && !/[a-z0-9]{6,}-v-/.test(row.slug)) score += 8;
  return score;
}

export function pickCanonicalFixture(rows: FixtureDedupeRow[]): FixtureDedupeRow {
  return [...rows].sort((a, b) => {
    const diff = scoreFixtureForCanonical(b) - scoreFixtureForCanonical(a);
    if (diff !== 0) return diff;
    return a.slug.localeCompare(b.slug);
  })[0]!;
}

function mergeScalarFields(
  keeper: FixtureDedupeRow,
  losers: FixtureDedupeRow[],
): { patch: Partial<FixtureDedupeRow>; mergedFields: string[] } {
  const patch: Partial<FixtureDedupeRow> = {};
  const mergedFields: string[] = [];

  const preferBareExternalId = (current: string | null, candidate: string | null) => {
    if (!candidate) return current;
    if (!current) return candidate;
    if (current.includes(":") && !candidate.includes(":")) return candidate;
    if (!current.includes(":") && candidate.includes(":")) return current;
    return current;
  };

  for (const loser of losers) {
    if (!keeper.planetRugbyUrl && loser.planetRugbyUrl) {
      keeper.planetRugbyUrl = loser.planetRugbyUrl;
      patch.planetRugbyUrl = loser.planetRugbyUrl;
      mergedFields.push("planetRugbyUrl");
    }
    if (!keeper.sport365Url && loser.sport365Url) {
      keeper.sport365Url = loser.sport365Url;
      patch.sport365Url = loser.sport365Url;
      mergedFields.push("sport365Url");
    }
    const nextExternal = preferBareExternalId(keeper.externalMatchId, loser.externalMatchId);
    if (nextExternal !== keeper.externalMatchId) {
      keeper.externalMatchId = nextExternal;
      patch.externalMatchId = nextExternal;
      mergedFields.push("externalMatchId");
    }
    if (!keeper.competitionId && loser.competitionId) {
      keeper.competitionId = loser.competitionId;
      patch.competitionId = loser.competitionId;
      mergedFields.push("competitionId");
    }
    if (!keeper.seasonId && loser.seasonId) {
      keeper.seasonId = loser.seasonId;
      patch.seasonId = loser.seasonId;
      mergedFields.push("seasonId");
    }
    if (!keeper.venueId && loser.venueId) {
      keeper.venueId = loser.venueId;
      patch.venueId = loser.venueId;
      mergedFields.push("venueId");
    }
    if (!keeper.venueName && loser.venueName) {
      keeper.venueName = loser.venueName;
      patch.venueName = loser.venueName;
      mergedFields.push("venueName");
    }
    if ((keeper.attendance == null || keeper.attendance === 0) && loser.attendance) {
      keeper.attendance = loser.attendance;
      patch.attendance = loser.attendance;
      mergedFields.push("attendance");
    }
    if (!keeper.refereeId && loser.refereeId) {
      keeper.refereeId = loser.refereeId;
      patch.refereeId = loser.refereeId;
      mergedFields.push("refereeId");
    }
    if (!keeper.refereeName && loser.refereeName) {
      keeper.refereeName = loser.refereeName;
      patch.refereeName = loser.refereeName;
      mergedFields.push("refereeName");
    }
    if (!keeper.homeCoachId && loser.homeCoachId) {
      keeper.homeCoachId = loser.homeCoachId;
      patch.homeCoachId = loser.homeCoachId;
      mergedFields.push("homeCoachId");
    }
    if (!keeper.awayCoachId && loser.awayCoachId) {
      keeper.awayCoachId = loser.awayCoachId;
      patch.awayCoachId = loser.awayCoachId;
      mergedFields.push("awayCoachId");
    }
    if (!keeper.round && loser.round) {
      keeper.round = loser.round;
      patch.round = loser.round;
      mergedFields.push("round");
    }
    if (!keeper.providerSnapshot && loser.providerSnapshot) {
      keeper.providerSnapshot = loser.providerSnapshot;
      patch.providerSnapshot = loser.providerSnapshot;
      mergedFields.push("providerSnapshot");
    }
    if (!keeper.rugby365PotmPlayerId && loser.rugby365PotmPlayerId) {
      keeper.rugby365PotmPlayerId = loser.rugby365PotmPlayerId;
      patch.rugby365PotmPlayerId = loser.rugby365PotmPlayerId;
      mergedFields.push("rugby365PotmPlayerId");
    }
    if (!keeper.officialPotmPlayerId && loser.officialPotmPlayerId) {
      keeper.officialPotmPlayerId = loser.officialPotmPlayerId;
      patch.officialPotmPlayerId = loser.officialPotmPlayerId;
      mergedFields.push("officialPotmPlayerId");
    }
    if (!keeper.officialPotmName && loser.officialPotmName) {
      keeper.officialPotmName = loser.officialPotmName;
      patch.officialPotmName = loser.officialPotmName;
      mergedFields.push("officialPotmName");
    }
  }

  const canonicalCompetitionName = canonicalCompetitionDisplayName(
    keeper.competitionName ?? losers.find((row) => row.competitionName)?.competitionName ?? "",
  );
  if (canonicalCompetitionName && canonicalCompetitionName !== keeper.competitionName) {
    keeper.competitionName = canonicalCompetitionName;
    patch.competitionName = canonicalCompetitionName;
    mergedFields.push("competitionName");
  }

  return { patch, mergedFields: [...new Set(mergedFields)] };
}

async function repointChildRows(keeperId: string, loserId: string) {
  const db = getDb();

  const keeperPlayers = await db
    .select({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, keeperId));
  const keeperPlayerIds = new Set(keeperPlayers.map((row) => row.playerId));

  const loserPlayers = await db
    .select()
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, loserId));
  for (const row of loserPlayers) {
    if (keeperPlayerIds.has(row.playerId)) {
      await db.delete(fixturePlayers).where(eq(fixturePlayers.id, row.id));
    } else {
      await db.update(fixturePlayers).set({ fixtureId: keeperId }).where(eq(fixturePlayers.id, row.id));
      keeperPlayerIds.add(row.playerId);
    }
  }

  await db.update(matchEvents).set({ fixtureId: keeperId }).where(eq(matchEvents.fixtureId, loserId));
  await db
    .update(commentarySuggestions)
    .set({ fixtureId: keeperId })
    .where(eq(commentarySuggestions.fixtureId, loserId));
  await db.update(matchCommentary).set({ fixtureId: keeperId }).where(eq(matchCommentary.fixtureId, loserId));

  const loserTeamStats = await db
    .select()
    .from(teamMatchStats)
    .where(eq(teamMatchStats.fixtureId, loserId));
  for (const row of loserTeamStats) {
    const [conflict] = await db
      .select({ id: teamMatchStats.id })
      .from(teamMatchStats)
      .where(
        sql`${teamMatchStats.fixtureId} = ${keeperId} AND ${teamMatchStats.teamId} = ${row.teamId} AND ${teamMatchStats.sourceProvider} = ${row.sourceProvider}`,
      )
      .limit(1);
    if (conflict) {
      await db.delete(teamMatchStats).where(eq(teamMatchStats.id, row.id));
    } else {
      await db.update(teamMatchStats).set({ fixtureId: keeperId }).where(eq(teamMatchStats.id, row.id));
    }
  }

  const loserPlayerStats = await db
    .select()
    .from(playerMatchPerformanceStats)
    .where(eq(playerMatchPerformanceStats.fixtureId, loserId));
  for (const row of loserPlayerStats) {
    const [conflict] = await db
      .select({ id: playerMatchPerformanceStats.id })
      .from(playerMatchPerformanceStats)
      .where(
        sql`${playerMatchPerformanceStats.fixtureId} = ${keeperId} AND ${playerMatchPerformanceStats.playerId} = ${row.playerId}`,
      )
      .limit(1);
    if (conflict) {
      await db.delete(playerMatchPerformanceStats).where(eq(playerMatchPerformanceStats.id, row.id));
    } else {
      await db
        .update(playerMatchPerformanceStats)
        .set({ fixtureId: keeperId })
        .where(eq(playerMatchPerformanceStats.id, row.id));
    }
  }

  const loserRatings = await db
    .select()
    .from(playerMatchRatings)
    .where(eq(playerMatchRatings.fixtureId, loserId));
  for (const row of loserRatings) {
    const [conflict] = await db
      .select({ id: playerMatchRatings.id })
      .from(playerMatchRatings)
      .where(
        sql`${playerMatchRatings.fixtureId} = ${keeperId} AND ${playerMatchRatings.playerId} = ${row.playerId}`,
      )
      .limit(1);
    if (conflict) {
      await db.delete(playerMatchRatings).where(eq(playerMatchRatings.id, row.id));
    } else {
      await db.update(playerMatchRatings).set({ fixtureId: keeperId }).where(eq(playerMatchRatings.id, row.id));
    }
  }
}

export async function findDuplicateFixtureGroups(): Promise<FixtureDuplicateGroup[]> {
  const db = getDb();
  const duplicateKeys = await db.execute<{
    home_team_id: string;
    away_team_id: string;
    match_day: string;
    home_name: string;
    away_name: string;
  }>(sql`
    SELECT
      f.home_team_id,
      f.away_team_id,
      date(f.kickoff_at)::text AS match_day,
      ht.name AS home_name,
      at.name AS away_name
    FROM fixtures f
    JOIN teams ht ON ht.id = f.home_team_id
    JOIN teams at ON at.id = f.away_team_id
    WHERE f.kickoff_at IS NOT NULL
      AND f.home_team_id IS NOT NULL
      AND f.away_team_id IS NOT NULL
    GROUP BY f.home_team_id, f.away_team_id, date(f.kickoff_at), ht.name, at.name
    HAVING count(*) > 1
    ORDER BY match_day DESC, home_name
  `);

  const groups: FixtureDuplicateGroup[] = [];
  for (const keyRow of duplicateKeys) {
    const rows = await db
      .select()
      .from(fixtures)
      .where(
        sql`${fixtures.homeTeamId} = ${keyRow.home_team_id}
          AND ${fixtures.awayTeamId} = ${keyRow.away_team_id}
          AND date(${fixtures.kickoffAt}) = ${keyRow.match_day}::date`,
      );
    groups.push({
      matchDay: keyRow.match_day,
      homeTeamId: keyRow.home_team_id,
      awayTeamId: keyRow.away_team_id,
      homeName: keyRow.home_name,
      awayName: keyRow.away_name,
      fixtures: rows as FixtureDedupeRow[],
    });
  }

  return groups;
}

export async function dedupeFixtureGroups(options?: { dryRun?: boolean }): Promise<FixtureDedupeReport> {
  const dryRun = options?.dryRun ?? true;
  const groups = await findDuplicateFixtureGroups();
  const db = getDb();
  const actions: FixtureDedupeAction[] = [];

  for (const group of groups) {
    const keeper = pickCanonicalFixture(group.fixtures);
    const losers = group.fixtures.filter((row) => row.id !== keeper.id);
    const { patch, mergedFields } = mergeScalarFields({ ...keeper }, losers);

    actions.push({
      keeperId: keeper.id,
      keeperSlug: keeper.slug,
      removedIds: losers.map((row) => row.id),
      mergedFields,
    });

    if (dryRun) continue;

    if (Object.keys(patch).length > 0) {
      await db.update(fixtures).set(patch).where(eq(fixtures.id, keeper.id));
    }

    for (const loser of losers) {
      await repointChildRows(keeper.id, loser.id);
      await deleteFixture(loser.id);
    }
  }

  return {
    dryRun,
    groupsFound: groups.length,
    groupsMerged: dryRun ? 0 : groups.length,
    fixturesRemoved: dryRun ? 0 : actions.reduce((sum, action) => sum + action.removedIds.length, 0),
    actions,
  };
}

export async function countFixturesByIds(ids: string[]) {
  if (!ids.length) return 0;
  const db = getDb();
  const rows = await db.select({ id: fixtures.id }).from(fixtures).where(inArray(fixtures.id, ids));
  return rows.length;
}

/** Same home/away + kickoff day as this fixture (excluding itself). */
export async function findDuplicatesForFixture(fixtureId: string): Promise<FixtureDedupeRow[]> {
  const db = getDb();
  const [row] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!row?.homeTeamId || !row.awayTeamId || !row.kickoffAt) return [];

  const matchDay = kickoffDateKey(row.kickoffAt);
  if (!matchDay) return [];

  const peers = await db
    .select()
    .from(fixtures)
    .where(
      sql`${fixtures.homeTeamId} = ${row.homeTeamId}
        AND ${fixtures.awayTeamId} = ${row.awayTeamId}
        AND date(${fixtures.kickoffAt}) = ${matchDay}::date
        AND ${fixtures.id} <> ${fixtureId}`,
    );

  return peers as FixtureDedupeRow[];
}

/** Merge one duplicate into another. Keeper wins identity; loser is deleted after child repoint. */
export async function mergeFixtureDuplicatePair(input: {
  keeperId: string;
  loserId: string;
  dryRun?: boolean;
}): Promise<FixtureDedupeAction> {
  if (input.keeperId === input.loserId) {
    throw new Error("Cannot merge a fixture into itself");
  }
  const dryRun = input.dryRun ?? false;
  const db = getDb();
  const rows = (await db
    .select()
    .from(fixtures)
    .where(inArray(fixtures.id, [input.keeperId, input.loserId]))) as FixtureDedupeRow[];

  if (rows.length !== 2) throw new Error("Both fixtures must exist to merge");

  const keeper = rows.find((r) => r.id === input.keeperId)!;
  const loser = rows.find((r) => r.id === input.loserId)!;
  const { patch, mergedFields } = mergeScalarFields({ ...keeper }, [loser]);

  const action: FixtureDedupeAction = {
    keeperId: keeper.id,
    keeperSlug: keeper.slug,
    removedIds: [loser.id],
    mergedFields,
  };

  if (dryRun) return action;

  if (Object.keys(patch).length > 0) {
    await db.update(fixtures).set(patch).where(eq(fixtures.id, keeper.id));
  }
  await repointChildRows(keeper.id, loser.id);
  await deleteFixture(loser.id);
  return action;
}
