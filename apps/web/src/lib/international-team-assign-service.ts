import { and, eq, isNull, or } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerCareerStints,
  players,
  teams,
} from "@rugby365/db";
import { parseNationalityFromBirthPlace } from "@rugby365/import-sdk";
import { findCoachCategoryByCountry } from "./coach-wikipedia-category-catalog";
import {
  buildCoachTeamResolver,
  loadCmsTeamsForCoachAssignment,
} from "./coach-team-resolve-service";
import { createTeam } from "./entity-admin-service";
import { resolveTeam } from "./entity-resolve-service";
import { getDb } from "./db";
import {
  countryNameLooksLikeClubTeam,
  isInternationalCompetitionType,
  repairPlayerProfileFromSquads,
} from "./player-profile-fields";
import {
  isInternationalTeamId,
  isValidInternationalCountryName,
  loadTeamClassificationContext,
} from "./international-team-classify";

export type AssignInternationalTeamsResult = {
  total: number;
  nationalityFilled: number;
  internationalTeamLinked: number;
  teamsCreated: number;
  repairedFromSquads: number;
  failures: Array<{ playerId: string; playerName: string; error: string }>;
};

async function resolveInternationalTeamForCountry(countryName: string) {
  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const cmsTeams = await loadCmsTeamsForCoachAssignment();
  const resolver = buildCoachTeamResolver(cmsTeams);
  const existing = resolver.resolveCountry(trimmed);
  if (existing) return { team: existing, created: false };

  const catalog = findCoachCategoryByCountry(trimmed);
  if (catalog) {
    const name = catalog.teamNames?.[0] ?? trimmed;
    const slug = catalog.teamSlugs?.[0];
    const team = await createTeam({ name, slug });
    return { team, created: true };
  }

  const resolved = await resolveTeam({ name: trimmed, createIfMissing: true });
  return resolved ? { team: resolved, created: true } : null;
}

export async function linkInternationalTeamForPlayer(
  playerId: string,
  options?: { countryName?: string | null; createTeamIfMissing?: boolean },
): Promise<{ linked: boolean; teamId?: string; teamName?: string; created?: boolean }> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return { linked: false };

  if (player.internationalTeamId) {
    const ctx = await loadTeamClassificationContext();
    if (isInternationalTeamId(ctx, player.internationalTeamId)) {
      return { linked: false, teamId: player.internationalTeamId };
    }
    await db
      .update(players)
      .set({ internationalTeamId: null })
      .where(eq(players.id, playerId));
  }

  const countryName = options?.countryName ?? player.countryName;
  const ctx = await loadTeamClassificationContext();
  if (
    !countryName?.trim() ||
    !isValidInternationalCountryName(ctx, countryName, player.clubName)
  ) {
    return { linked: false };
  }

  const resolved = options?.createTeamIfMissing === false
    ? await loadCmsTeamsForCoachAssignment().then((cmsTeams) => {
        const team = buildCoachTeamResolver(cmsTeams).resolveCountry(countryName);
        return team ? { team, created: false } : null;
      })
    : await resolveInternationalTeamForCountry(countryName);

  if (!resolved?.team) return { linked: false };
  if (!isInternationalTeamId(ctx, resolved.team.id)) return { linked: false };

  await db
    .update(players)
    .set({
      internationalTeamId: resolved.team.id,
      countryName: player.countryName ?? countryName,
    })
    .where(eq(players.id, playerId));

  return {
    linked: true,
    teamId: resolved.team.id,
    teamName: resolved.team.name,
    created: resolved.created,
  };
}

async function internationalTeamFromSquads(playerId: string) {
  const db = getDb();
  const squads = await db
    .select({
      teamId: fixturePlayers.teamId,
      teamName: teams.name,
      competitionType: competitions.competitionType,
    })
    .from(fixturePlayers)
    .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixturePlayers.playerId, playerId));

  const intlCounts = new Map<string, { teamId: string; teamName: string; count: number }>();
  for (const row of squads) {
    if (!isInternationalCompetitionType(row.competitionType)) continue;
    const prev = intlCounts.get(row.teamId);
    if (prev) prev.count += 1;
    else intlCounts.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, count: 1 });
  }

  let best: { teamId: string; teamName: string } | null = null;
  for (const row of intlCounts.values()) {
    if (!best || row.count > best.count) best = row;
  }
  return best;
}

async function assignPlayerInternationalTeam(playerId: string): Promise<{
  nationalityFilled: boolean;
  internationalTeamLinked: boolean;
  teamsCreated: number;
}> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  let nationalityFilled = false;
  let internationalTeamLinked = false;
  let teamsCreated = 0;

  await repairPlayerProfileFromSquads(playerId);
  const [refreshed] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!refreshed) throw new Error("Player not found");

  if (!refreshed.countryName?.trim() && refreshed.birthPlace?.trim()) {
    const nationality = parseNationalityFromBirthPlace(refreshed.birthPlace);
    if (nationality && !countryNameLooksLikeClubTeam(nationality, refreshed.clubName)) {
      await db.update(players).set({ countryName: nationality }).where(eq(players.id, playerId));
      nationalityFilled = true;
    }
  }

  const [current] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!current) throw new Error("Player not found");

  const ctx = await loadTeamClassificationContext();

  if (!current.internationalTeamId) {
    const intlStint = await db
      .select({ teamId: playerCareerStints.teamId, teamName: playerCareerStints.teamName })
      .from(playerCareerStints)
      .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "international")))
      .limit(1);

    if (intlStint[0]?.teamId && isInternationalTeamId(ctx, intlStint[0].teamId)) {
      await db
        .update(players)
        .set({
          internationalTeamId: intlStint[0].teamId,
          countryName: current.countryName ?? intlStint[0].teamName,
        })
        .where(eq(players.id, playerId));
      internationalTeamLinked = true;
    } else {
      const squadIntl = await internationalTeamFromSquads(playerId);
      if (squadIntl && isInternationalTeamId(ctx, squadIntl.teamId)) {
        await db
          .update(players)
          .set({
            internationalTeamId: squadIntl.teamId,
            countryName: current.countryName ?? squadIntl.teamName,
          })
          .where(eq(players.id, playerId));
        internationalTeamLinked = true;
      }
    }
  }

  const [afterIntl] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (afterIntl && !afterIntl.internationalTeamId && afterIntl.countryName?.trim()) {
    const linked = await linkInternationalTeamForPlayer(playerId, {
      countryName: afterIntl.countryName,
      createTeamIfMissing: true,
    });
    if (linked.linked) {
      internationalTeamLinked = true;
      if (linked.created) teamsCreated += 1;
    }
  }

  return { nationalityFilled, internationalTeamLinked, teamsCreated };
}

export async function assignAllPlayerInternationalTeams(options?: {
  onlyMissing?: boolean;
  limit?: number;
  onProgress?: (progress: { index: number; total: number; playerName: string }) => void;
}): Promise<AssignInternationalTeamsResult> {
  const db = getDb();
  const rows = options?.onlyMissing
    ? await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(
          or(
            isNull(players.internationalTeamId),
            isNull(players.countryName),
            eq(players.countryName, ""),
          ),
        )
    : await db.select({ id: players.id, name: players.name }).from(players);

  const batch = options?.limit ? rows.slice(0, options.limit) : rows;
  const result: AssignInternationalTeamsResult = {
    total: batch.length,
    nationalityFilled: 0,
    internationalTeamLinked: 0,
    teamsCreated: 0,
    repairedFromSquads: 0,
    failures: [],
  };

  for (let index = 0; index < batch.length; index++) {
    const row = batch[index]!;
    try {
      const rowResult = await assignPlayerInternationalTeam(row.id);
      if (rowResult.nationalityFilled) result.nationalityFilled += 1;
      if (rowResult.internationalTeamLinked) result.internationalTeamLinked += 1;
      result.teamsCreated += rowResult.teamsCreated;
      options?.onProgress?.({ index: index + 1, total: batch.length, playerName: row.name });
    } catch (error) {
      result.failures.push({
        playerId: row.id,
        playerName: row.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function listPlayersMissingInternationalContext(limit = 20) {
  const db = getDb();
  return db
    .select({
      id: players.id,
      name: players.name,
      countryName: players.countryName,
      internationalTeamId: players.internationalTeamId,
      clubName: players.clubName,
    })
    .from(players)
    .where(
      or(
        isNull(players.internationalTeamId),
        isNull(players.countryName),
        eq(players.countryName, ""),
      ),
    )
    .limit(limit);
}
