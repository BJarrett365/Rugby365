import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  competitionSeasons,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerCareerStints,
  playerExternalMatches,
  playerMatchRatings,
  playerTransfers,
  playerRatings,
  players,
  referees,
  teams,
  venues,
} from "@rugby365/db";
import type { Sport365Lineups } from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import {
  linkFixtureEventPlayerIds,
  resolvePlayer,
  resolveTeam,
  syncFixtureSquad,
} from "./entity-resolve-service";
import { listFixtures, normalizeSlug, validateSlug } from "./fixture-admin-service";
import { resolveFixtureSeasonLabel } from "./fixture-season-utils";
import { normalizePlayerListLetter, type PlayerListFilters } from "./player-list-filters";
import { batchPlayerCareerStats, syncFixturePlayerStats, type PlayerScoringStats } from "./player-stats";
import { repairAllPlayerProfilesFromSquads, backfillAllPlayerProfilesFromEventPayloads, batchPlayerListDisplayFields } from "./player-profile-fields";
import { sanitizeTransferPlayerName } from "./transfer-display";
import { normalizePlayerCareerStatus } from "./player-career-status";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  emptySquadRankings,
  listSquadRankingsForPlayerIds,
  type SquadPlayerRankings,
} from "./match-rating-service";
import { loadTeamClassificationContext, resolveDisplayNation, isInternationalTeamId } from "./international-team-classify";
import {
  canonicalPlayerDisplayName,
  normalizePlayerName,
  normalizeTeamName,
} from "./entity-normalize";

function uniqueSlug(base: string, externalProviderId?: string): string {
  const slug = normalizeSlug(base);
  if (!externalProviderId) return slug;
  const suffix = externalProviderId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase();
  return suffix ? `${slug}-${suffix}` : slug;
}

// ——— Teams ———

export async function getTeamById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return row ?? null;
}

export type TeamFixtureRow = {
  id: string;
  slug: string;
  kickoffAt: Date | null;
  status: string;
  competitionName: string | null;
  side: "home" | "away";
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  result: "won" | "lost" | "draw" | null;
  attendance: number | null;
  venueName: string | null;
};

export type TeamPlayerRow = {
  playerId: string;
  name: string;
  slug: string;
  positionName: string | null;
  clubName: string | null;
  countryName: string | null;
  nationCode: string | null;
  jerseyNumber: number | null;
  fixtureCount: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
};

export type TeamCurrentSquadPlayer = TeamPlayerRow & {
  squadRole: string;
  rankings: SquadPlayerRankings;
};

export type TeamDepartedPlayer = TeamPlayerRow & {
  lastSeenAt: Date | null;
  lastOpponentName: string | null;
  rankings: SquadPlayerRankings;
};

export type TeamRecentSquadFixture = {
  id: string;
  slug: string;
  kickoffAt: Date | null;
  opponentName: string;
  side: "home" | "away";
  status: string;
};

function fixtureResult(
  status: string,
  teamScore: number,
  opponentScore: number,
): "won" | "lost" | "draw" | null {
  if (status !== "full_time" && status !== "live") return null;
  if (teamScore > opponentScore) return "won";
  if (teamScore < opponentScore) return "lost";
  if (status === "full_time") return "draw";
  return null;
}

export async function getTeamDetail(id: string) {
  const team = await getTeamById(id);
  if (!team) return null;

  const db = getDb();
  const allTeams = await db.select().from(teams);
  const teamById = Object.fromEntries(allTeams.map((t) => [t.id, t]));

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, id), eq(fixtures.awayTeamId, id)))
    .orderBy(desc(fixtures.kickoffAt));

  const venueRows = await db.select().from(venues);
  const venueById = Object.fromEntries(venueRows.map((v) => [v.id, v]));

  const fixtureList: TeamFixtureRow[] = fixtureRows.map((f) => {
    const isHome = f.homeTeamId === id;
    const opponentId = isHome ? f.awayTeamId : f.homeTeamId;
    const opponent = opponentId ? teamById[opponentId] : null;
    const teamScore = isHome ? f.homeScore : f.awayScore;
    const opponentScore = isHome ? f.awayScore : f.homeScore;
    const venue = f.venueId ? venueById[f.venueId] : null;
    return {
      id: f.id,
      slug: f.slug,
      kickoffAt: f.kickoffAt,
      status: f.status,
      competitionName: f.competitionName,
      side: isHome ? "home" : "away",
      homeTeam: f.homeTeamId ? (teamById[f.homeTeamId]?.name ?? null) : null,
      awayTeam: f.awayTeamId ? (teamById[f.awayTeamId]?.name ?? null) : null,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      opponentName: opponent?.name ?? "TBC",
      teamScore,
      opponentScore,
      result: fixtureResult(f.status, teamScore, opponentScore),
      attendance: f.attendance,
      venueName: venue?.name ?? f.venueName,
    };
  });

  const squadRows = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      playerSlug: players.slug,
      positionName: players.positionName,
      clubName: players.clubName,
      countryName: players.countryName,
      nationCode: players.nationCode,
      jerseyNumber: fixturePlayers.jerseyNumber,
      squadRole: fixturePlayers.squadRole,
      fixtureId: fixtures.id,
      tries: fixturePlayers.tries,
      conversions: fixturePlayers.conversions,
      penalties: fixturePlayers.penalties,
      dropGoals: fixturePlayers.dropGoals,
      points: fixturePlayers.points,
      kickoffAt: fixtures.kickoffAt,
      fixtureStatus: fixtures.status,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(eq(fixturePlayers.teamId, id))
    .orderBy(desc(fixtures.kickoffAt));

  const fixtureMetaById = new Map(
    fixtureList.map((f) => [
      f.id,
      { opponentName: f.opponentName, side: f.side, kickoffAt: f.kickoffAt, status: f.status },
    ]),
  );

  const playerAgg = new Map<string, TeamPlayerRow>();
  const lastSeenByPlayer = new Map<
    string,
    { lastSeenAt: Date | null; lastOpponentName: string | null }
  >();
  for (const row of squadRows) {
    if (!lastSeenByPlayer.has(row.playerId)) {
      const meta = fixtureMetaById.get(row.fixtureId);
      lastSeenByPlayer.set(row.playerId, {
        lastSeenAt: row.kickoffAt,
        lastOpponentName: meta?.opponentName ?? null,
      });
    }
    const existing = playerAgg.get(row.playerId);
    if (!existing) {
      playerAgg.set(row.playerId, {
        playerId: row.playerId,
        name: row.playerName,
        slug: row.playerSlug,
        positionName: row.positionName,
        clubName: row.clubName,
        countryName: row.countryName,
        nationCode: row.nationCode,
        jerseyNumber: row.jerseyNumber,
        fixtureCount: 1,
        tries: row.tries,
        conversions: row.conversions,
        penalties: row.penalties,
        dropGoals: row.dropGoals,
        points: row.points,
      });
    } else {
      existing.fixtureCount += 1;
      existing.tries += row.tries;
      existing.conversions += row.conversions;
      existing.penalties += row.penalties;
      existing.dropGoals += row.dropGoals;
      existing.points += row.points;
    }
  }

  const recentSquadFixtureRow = fixtureList.find(
    (f) => f.status === "full_time" || f.status === "live",
  );
  let recentSquadFixture: TeamRecentSquadFixture | null = null;
  let currentSquadBase: Array<TeamPlayerRow & { squadRole: string }> = [];
  let currentSquadIds = new Set<string>();
  if (recentSquadFixtureRow) {
    recentSquadFixture = {
      id: recentSquadFixtureRow.id,
      slug: recentSquadFixtureRow.slug,
      kickoffAt: recentSquadFixtureRow.kickoffAt,
      opponentName: recentSquadFixtureRow.opponentName,
      side: recentSquadFixtureRow.side,
      status: recentSquadFixtureRow.status,
    };
    currentSquadBase = squadRows
      .filter((row) => row.fixtureId === recentSquadFixtureRow.id)
      .map((row) => {
        currentSquadIds.add(row.playerId);
        const agg = playerAgg.get(row.playerId)!;
        return {
          ...agg,
          jerseyNumber: row.jerseyNumber,
          squadRole: row.squadRole ?? "starting",
          positionName: row.positionName ?? agg.positionName,
        };
      })
      .sort((a, b) => {
        const roleOrder = (r: string) => (r === "starting" ? 0 : 1);
        const roleDiff = roleOrder(a.squadRole) - roleOrder(b.squadRole);
        if (roleDiff !== 0) return roleDiff;
        return (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99);
      });
  }

  const departedPlayersBase: Array<
    TeamPlayerRow & { lastSeenAt: Date | null; lastOpponentName: string | null }
  > = [...playerAgg.values()]
    .filter((p) => !currentSquadIds.has(p.playerId))
    .map((p) => {
      const last = lastSeenByPlayer.get(p.playerId);
      return {
        ...p,
        lastSeenAt: last?.lastSeenAt ?? null,
        lastOpponentName: last?.lastOpponentName ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastSeenAt?.getTime() ?? 0;
      const bTime = b.lastSeenAt?.getTime() ?? 0;
      return bTime - aTime;
    });

  const squadPlayerIds = [
    ...currentSquadBase.map((p) => p.playerId),
    ...departedPlayersBase.map((p) => p.playerId),
  ];
  const rankingsMap = await listSquadRankingsForPlayerIds(squadPlayerIds, {
    latestFixtureId: recentSquadFixture?.id ?? null,
    latestFixturePublished: recentSquadFixture
      ? isFixtureRatingsPublished(recentSquadFixture.status)
      : false,
    seasonId: recentSquadFixtureRow
      ? (fixtureRows.find((f) => f.id === recentSquadFixtureRow.id)?.seasonId ?? null)
      : null,
  });
  const withRankings = <T extends { playerId: string }>(rows: T[]) =>
    rows.map((row) => ({
      ...row,
      rankings: rankingsMap.get(row.playerId) ?? emptySquadRankings(),
    }));
  const currentSquad: TeamCurrentSquadPlayer[] = withRankings(currentSquadBase);
  const departedPlayers: TeamDepartedPlayer[] = withRankings(departedPlayersBase);

  const homeVenue = team.homeVenueId ? venueById[team.homeVenueId] ?? null : null;

  const resultsSummary = {
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    scheduled: 0,
  };
  for (const f of fixtureList) {
    if (f.status === "scheduled" || f.status === "postponed" || f.status === "cancelled") {
      resultsSummary.scheduled += 1;
      continue;
    }
    if (f.result === "won") {
      resultsSummary.played += 1;
      resultsSummary.won += 1;
    } else if (f.result === "lost") {
      resultsSummary.played += 1;
      resultsSummary.lost += 1;
    } else if (f.result === "draw") {
      resultsSummary.played += 1;
      resultsSummary.drawn += 1;
    }
  }

  return {
    team,
    homeVenue,
    fixtures: fixtureList,
    players: [...playerAgg.values()].sort((a, b) => a.name.localeCompare(b.name)),
    currentSquad,
    recentSquadFixture,
    departedPlayers,
    resultsSummary,
  };
}

export async function repairTeamPlayerDisplayNames(teamId: string) {
  const db = getDb();
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");

  const squadPlayerIds = await db
    .selectDistinct({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.teamId, teamId));

  const clubPlayers = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.clubTeamId, teamId));

  const playerIds = new Set([
    ...squadPlayerIds.map((r) => r.playerId),
    ...clubPlayers.map((r) => r.id),
  ]);

  const updated: Array<{ id: string; from: string; to: string }> = [];
  for (const playerId of playerIds) {
    const [row] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!row) continue;
    const canonical = canonicalPlayerDisplayName(row.name);
    if (canonical === row.name) continue;
    await db.update(players).set({ name: canonical }).where(eq(players.id, playerId));
    updated.push({ id: playerId, from: row.name, to: canonical });
  }

  return { teamId, teamName: team.name, updated, count: updated.length };
}

export async function createTeam(input: {
  name: string;
  slug?: string;
  shortName?: string;
  externalProviderId?: string;
}) {
  const name = normalizeTeamName(input.name.trim());
  if (!name) throw new Error("Team name is required");

  const team = await resolveTeam({
    name,
    externalProviderId: input.externalProviderId,
    createIfMissing: true,
    sourceProvider: input.externalProviderId ? "sport365" : "manual",
  });
  if (!team) throw new Error("Failed to create team");

  if (input.shortName?.trim() || input.slug?.trim()) {
    return updateTeam(team.id, {
      shortName: input.shortName,
      slug: input.slug,
    });
  }

  return team;
}

export async function updateTeam(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    shortName: string;
    externalProviderId: string;
    homeVenueId: string | null;
    bioSummary: string | null;
    countryName: string | null;
    region: string | null;
    hemisphere: string | null;
    teamType: string | null;
    foundedYear: number | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!existing) throw new Error("Team not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const [row] = await db
    .update(teams)
    .set({
      ...(input.name !== undefined ? { name: normalizeTeamName(input.name) } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.shortName !== undefined ? { shortName: input.shortName.trim() || null } : {}),
      ...(input.externalProviderId !== undefined
        ? { externalProviderId: input.externalProviderId.trim() || null }
        : {}),
      ...(input.homeVenueId !== undefined ? { homeVenueId: input.homeVenueId || null } : {}),
      ...(input.bioSummary !== undefined ? { bioSummary: input.bioSummary?.trim() || null } : {}),
      ...(input.countryName !== undefined ? { countryName: input.countryName?.trim() || null } : {}),
      ...(input.region !== undefined ? { region: input.region?.trim() || null } : {}),
      ...(input.hemisphere !== undefined ? { hemisphere: input.hemisphere?.trim() || null } : {}),
      ...(input.teamType !== undefined ? { teamType: input.teamType?.trim() || null } : {}),
      ...(input.foundedYear !== undefined ? { foundedYear: input.foundedYear ?? null } : {}),
    })
    .where(eq(teams.id, id))
    .returning();
  return row;
}

export async function deleteTeam(id: string) {
  const db = getDb();
  const [used] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, id), eq(fixtures.awayTeamId, id)))
    .limit(1);
  if (used) throw new Error("Cannot delete team — it is used on one or more matches");

  const [row] = await db.delete(teams).where(eq(teams.id, id)).returning({ id: teams.id });
  if (!row) throw new Error("Team not found");
  return row;
}

// ——— Players ———

export type PlayerListRow = typeof players.$inferSelect & {
  fixtureCount: number;
  eventCount: number;
  clubTeamName: string | null;
  internationalTeamName: string | null;
  stats: PlayerScoringStats;
  jerseyNumber: number | null;
  displayRating: number | null;
  displayNation: string | null;
};

export type PlayerPickerRow = {
  id: string;
  name: string;
  clubTeamName: string | null;
};

export async function listPlayersForPicker(filters?: {
  competitionId?: string;
  seasonId?: string;
  teamId?: string;
}): Promise<PlayerPickerRow[]> {
  if (filters?.competitionId && filters?.seasonId && filters?.teamId) {
    const { listSeasonScopedPlayers } = await import("./season-scoped-picker-service");
    const rows = await listSeasonScopedPlayers({
      competitionId: filters.competitionId,
      seasonId: filters.seasonId,
      teamId: filters.teamId,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      clubTeamName: row.clubTeamName,
    }));
  }

  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      clubTeamId: players.clubTeamId,
    })
    .from(players)
    .orderBy(asc(players.name));

  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamById = Object.fromEntries(teamRows.map((team) => [team.id, team.name]));

  return rows.map((player) => ({
    id: player.id,
    name: player.name,
    clubTeamName: player.clubTeamId ? (teamById[player.clubTeamId] ?? null) : null,
  }));
}

export type { PlayerListFilters } from "./player-list-filters";

export type PlayerListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function buildPlayerListWhere(filters: PlayerListFilters, membershipPlayerIds?: string[]) {
  const conditions = [];
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(ilike(players.name, q), ilike(players.fullName, q), ilike(players.slug, q)),
    );
  }
  if (membershipPlayerIds) {
    if (membershipPlayerIds.length === 0) {
      conditions.push(sql`false`);
    } else {
      conditions.push(inArray(players.id, membershipPlayerIds));
    }
  } else if (filters.teamId) {
    conditions.push(
      or(eq(players.clubTeamId, filters.teamId), eq(players.internationalTeamId, filters.teamId)),
    );
  }
  const letter = normalizePlayerListLetter(filters.letter);
  if (letter === "#") {
    conditions.push(sql`upper(substring(${players.name} from 1 for 1)) !~ '^[A-Z]'`);
  } else if (letter) {
    conditions.push(sql`upper(substring(${players.name} from 1 for 1)) = ${letter}`);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function enrichPlayerListRows(
  rows: (typeof players.$inferSelect)[],
): Promise<PlayerListRow[]> {
  const db = getDb();
  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));
  const playerIds = rows.map((p) => p.id);
  const statsByPlayer = await batchPlayerCareerStats(playerIds);
  const displayFields = await batchPlayerListDisplayFields(playerIds);
  const teamClassification = await loadTeamClassificationContext();

  const fixtureCounts =
    playerIds.length > 0
      ? await db
          .select({
            playerId: fixturePlayers.playerId,
            count: sql<number>`count(*)::int`,
          })
          .from(fixturePlayers)
          .where(inArray(fixturePlayers.playerId, playerIds))
          .groupBy(fixturePlayers.playerId)
      : [];

  const eventCounts =
    playerIds.length > 0
      ? await db
          .select({
            playerId: matchEvents.playerId,
            count: sql<number>`count(*)::int`,
          })
          .from(matchEvents)
          .where(and(sql`${matchEvents.playerId} is not null`, inArray(matchEvents.playerId, playerIds)))
          .groupBy(matchEvents.playerId)
      : [];

  const fixtureByPlayer = Object.fromEntries(fixtureCounts.map((r) => [r.playerId, r.count]));
  const eventByPlayer = Object.fromEntries(
    eventCounts.filter((r) => r.playerId).map((r) => [r.playerId!, r.count]),
  );

  const jerseyRows =
    playerIds.length > 0
      ? await db
          .select({
            playerId: fixturePlayers.playerId,
            jerseyNumber: fixturePlayers.jerseyNumber,
            kickoffAt: fixtures.kickoffAt,
          })
          .from(fixturePlayers)
          .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
          .where(inArray(fixturePlayers.playerId, playerIds))
          .orderBy(desc(fixtures.kickoffAt))
      : [];

  const jerseyByPlayer = new Map<string, number | null>();
  for (const row of jerseyRows) {
    if (!jerseyByPlayer.has(row.playerId)) {
      jerseyByPlayer.set(row.playerId, row.jerseyNumber);
    }
  }

  return rows.map((p) => {
    const fallback = displayFields.get(p.id);
    const clubTeamName =
      (p.clubTeamId ? (teamById[p.clubTeamId] ?? null) : null) ??
      fallback?.clubTeamName ??
      p.clubName ??
      fallback?.clubName ??
      null;
    const internationalTeamNameRaw =
      (p.internationalTeamId ? (teamById[p.internationalTeamId] ?? null) : null) ??
      fallback?.internationalTeamName ??
      null;
    const internationalTeamName =
      p.internationalTeamId && isInternationalTeamId(teamClassification, p.internationalTeamId)
        ? internationalTeamNameRaw
        : null;

    const displayNation = resolveDisplayNation(teamClassification, {
      nationCode: p.nationCode,
      countryName: p.countryName ?? fallback?.countryName ?? null,
      clubName: clubTeamName ?? p.clubName,
      internationalTeamId: p.internationalTeamId,
      internationalTeamName,
    });

    return {
      ...p,
      positionName: p.positionName ?? fallback?.positionName ?? null,
      clubName: p.clubName ?? fallback?.clubName ?? clubTeamName,
      countryName: displayNation,
      fixtureCount: fixtureByPlayer[p.id] ?? 0,
      eventCount: eventByPlayer[p.id] ?? 0,
      clubTeamName,
      internationalTeamName,
      displayNation,
      stats: statsByPlayer.get(p.id) ?? {
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
        points: 0,
      },
      jerseyNumber: p.squadNumber ?? jerseyByPlayer.get(p.id) ?? null,
      displayRating: null,
    };
  });
}

export async function listPlayers(filters: PlayerListFilters = {}): Promise<{
  players: PlayerListRow[];
  pagination: PlayerListPagination;
}> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  let membershipPlayerIds: string[] | undefined;
  if (filters.teamId && filters.seasonId) {
    const { listPlayerIdsForTeamSeason } = await import("./player-membership-service");
    membershipPlayerIds = await listPlayerIdsForTeamSeason(filters.teamId, filters.seasonId);
  }

  const whereClause = buildPlayerListWhere(filters, membershipPlayerIds);
  const sortBy = filters.sortBy ?? "rank";
  const displayRatingSql = sql<number | null>`coalesce(${playerRatings.manualOverrideRating}, ${playerRatings.playerRating})`;
  const careerPointsSql = sql<number>`coalesce((
    select sum(${fixturePlayers.points})::int
    from ${fixturePlayers}
    where ${fixturePlayers.playerId} = ${players.id}
  ), 0)`;

  const baseQuery = db
    .select({
      player: players,
      displayRating: displayRatingSql,
    })
    .from(players)
    .leftJoin(playerRatings, eq(players.id, playerRatings.playerId))
    .where(whereClause);

  const rows =
    sortBy === "name"
      ? await baseQuery.orderBy(asc(players.name)).limit(pageSize).offset(offset)
      : await baseQuery
          .orderBy(
            sql`${displayRatingSql} desc nulls last`,
            desc(careerPointsSql),
            asc(players.name),
          )
          .limit(pageSize)
          .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players)
    .where(whereClause);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const ratingById = Object.fromEntries(rows.map((row) => [row.player.id, row.displayRating]));

  return {
    players: (await enrichPlayerListRows(rows.map((row) => row.player))).map((player) => ({
      ...player,
      displayRating: ratingById[player.id] ?? null,
    })),
    pagination: { page, pageSize, total, totalPages },
  };
}

export async function getPlayerById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return row ?? null;
}

export async function getPlayerDetail(id: string) {
  const player = await getPlayerById(id);
  if (!player) return null;

  const db = getDb();
  const [transfers, squads, events, careerStints, externalMatches, statsMap] = await Promise.all([
    db
      .select()
      .from(playerTransfers)
      .where(eq(playerTransfers.playerId, id))
      .orderBy(desc(playerTransfers.effectiveDate)),
    db
      .select({
        id: fixturePlayers.id,
        fixtureId: fixturePlayers.fixtureId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        positionName: fixturePlayers.positionName,
        clubName: fixturePlayers.clubName,
        tries: fixturePlayers.tries,
        conversions: fixturePlayers.conversions,
        penalties: fixturePlayers.penalties,
        dropGoals: fixturePlayers.dropGoals,
        points: fixturePlayers.points,
        fixtureSlug: fixtures.slug,
        kickoffAt: fixtures.kickoffAt,
        status: fixtures.status,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        competitionId: fixtures.competitionId,
        competitionName: fixtures.competitionName,
        teamName: teams.name,
      })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
      .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
      .where(eq(fixturePlayers.playerId, id))
      .orderBy(desc(fixtures.kickoffAt)),
    db
      .select({
        id: matchEvents.id,
        eventType: matchEvents.eventType,
        minute: matchEvents.minute,
        fixtureId: fixtures.id,
        fixtureSlug: fixtures.slug,
        kickoffAt: fixtures.kickoffAt,
        competitionId: fixtures.competitionId,
        competitionName: fixtures.competitionName,
        teamName: teams.name,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(matchEvents)
      .innerJoin(fixtures, eq(matchEvents.fixtureId, fixtures.id))
      .leftJoin(teams, eq(matchEvents.teamId, teams.id))
      .where(eq(matchEvents.playerId, id))
      .orderBy(desc(fixtures.kickoffAt), asc(matchEvents.minute)),
    db
      .select()
      .from(playerCareerStints)
      .where(eq(playerCareerStints.playerId, id))
      .orderBy(asc(playerCareerStints.careerType), asc(playerCareerStints.sortOrder)),
    db
      .select()
      .from(playerExternalMatches)
      .where(eq(playerExternalMatches.playerId, id))
      .orderBy(desc(playerExternalMatches.kickoffAt)),
    batchPlayerCareerStats([id]),
  ]);

  const [seasonRows, allTeams, matchRatingRows] = await Promise.all([
    db
      .select({
        competitionId: competitionSeasons.competitionId,
        label: competitionSeasons.label,
        year: competitionSeasons.year,
      })
      .from(competitionSeasons),
    db.select().from(teams),
    squads.length
      ? db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            rating: playerMatchRatings.rating,
            ratingStatus: playerMatchRatings.ratingStatus,
            minutesPlayed: playerMatchRatings.minutesPlayed,
            performanceTrend: playerMatchRatings.performanceTrend,
            ratingChange: playerMatchRatings.ratingChange,
          })
          .from(playerMatchRatings)
          .where(
            and(
              eq(playerMatchRatings.playerId, id),
              inArray(
                playerMatchRatings.fixtureId,
                squads.map((s) => s.fixtureId),
              ),
            ),
          )
      : Promise.resolve([] as Array<{
          fixtureId: string;
          rating: number | null;
          ratingStatus: string;
          minutesPlayed: number;
          performanceTrend: string | null;
          ratingChange: number | null;
        }>),
  ]);

  const ratingByFixture = new Map(matchRatingRows.map((r) => [r.fixtureId, r]));
  const teamById = Object.fromEntries(allTeams.map((t) => [t.id, t]));
  const stats = statsMap.get(id)!;

  const squadsWithResults = squads.map((s) => {
    const home = s.homeTeamId ? teamById[s.homeTeamId]?.name : null;
    const away = s.awayTeamId ? teamById[s.awayTeamId]?.name : null;
    const scoreline = `${s.homeScore}–${s.awayScore}`;
    const seasonLabel = resolveFixtureSeasonLabel({
      kickoffAt: s.kickoffAt,
      competitionId: s.competitionId,
      seasons: seasonRows,
    });
    const matchRating = ratingByFixture.get(s.fixtureId);
    return {
      ...s,
      homeTeam: home,
      awayTeam: away,
      scoreline,
      opponentName: s.teamName === home ? away : home,
      seasonLabel,
      matchRating: matchRating?.rating ?? null,
      matchRatingStatus: matchRating?.ratingStatus ?? null,
      matchMinutes: matchRating?.minutesPlayed ?? null,
      matchRatingChange: matchRating?.ratingChange ?? null,
      matchPerformanceTrend: matchRating?.performanceTrend ?? null,
    };
  });

  const eventsWithSeason = events.map((event) => ({
    ...event,
    seasonLabel: resolveFixtureSeasonLabel({
      kickoffAt: event.kickoffAt,
      competitionId: event.competitionId,
      seasons: seasonRows,
    }),
  }));

  return {
    player,
    transfers,
    squads: squadsWithResults,
    events: eventsWithSeason,
    stats,
    careerStints,
    externalMatches,
    clubTeam: player.clubTeamId ? teamById[player.clubTeamId] ?? null : null,
    internationalTeam: player.internationalTeamId
      ? teamById[player.internationalTeamId] ?? null
      : null,
  };
}

export async function createPlayer(input: {
  name: string;
  slug?: string;
  positionName?: string;
  clubName?: string;
  countryName?: string;
  externalProviderId?: string;
}) {
  const name = normalizePlayerName(input.name.trim());
  if (!name) throw new Error("Player name is required");

  const player = await resolvePlayer({
    name,
    externalProviderId: input.externalProviderId,
    positionName: input.positionName,
    clubName: input.clubName,
    countryName: input.countryName,
    createIfMissing: true,
    skipArchiveEnrich: true,
  });

  if (!player) throw new Error("Failed to create player");

  const { enrichPlayerFromWikipediaAndWait } = await import("./player-wikipedia-enrich");
  const archive = await enrichPlayerFromWikipediaAndWait(player.id, player.name);
  const refreshed = archive.enriched ? await getPlayerById(player.id) : player;

  return {
    player: refreshed ?? player,
    archiveEnriched: archive.enriched,
    wikipediaUrl: archive.wikipediaUrl,
    careerStints: archive.careerStints,
  };
}

export async function updatePlayer(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    positionName: string;
    clubName: string;
    countryName: string;
    externalProviderId: string;
    nationCode: string;
    clubTeamId: string | null;
    internationalTeamId: string | null;
    fullName: string | null;
    birthDate: string | null;
    birthPlace: string | null;
    heightCm: number | null;
    weightKg: number | null;
    socialAccounts: Record<string, string | null>;
    squadNumber: number | null;
    bioSummary: string | null;
    careerStatus?: string;
    isPublic?: boolean;
    publishStatus?: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
    ogImageUrl?: string | null;
    imageUrl?: string | null;
    publicIntroOverride?: string | null;
    preferredFoot?: string | null;
    statusOverride?: string | null;
    contractExpiresOn?: string | null;
    reportedSalaryGbp?: number | null;
    salaryAsOf?: string | null;
    agentName?: string | null;
    agentAgency?: string | null;
    clubDebutOn?: string | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!existing) throw new Error("Player not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const nextName =
    input.name !== undefined ? sanitizeTransferPlayerName(input.name) : existing.name;

  const nextClub = input.clubName !== undefined ? input.clubName.trim() || null : existing.clubName;
  if (
    nextClub &&
    existing.clubName &&
    nextClub !== existing.clubName &&
    input.clubName !== undefined
  ) {
    await db.insert(playerTransfers).values({
      playerId: id,
      fromClub: existing.clubName,
      toClub: nextClub,
      effectiveDate: new Date(),
      sourceProvider: "manual",
      notes: "Updated via CMS player edit",
    });
  }

  const [row] = await db
    .update(players)
    .set({
      ...(input.name !== undefined ? { name: nextName } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.positionName !== undefined ? { positionName: input.positionName.trim() || null } : {}),
      ...(input.clubName !== undefined ? { clubName: nextClub } : {}),
      ...(input.countryName !== undefined ? { countryName: input.countryName.trim() || null } : {}),
      ...(input.externalProviderId !== undefined
        ? { externalProviderId: input.externalProviderId.trim() || null }
        : {}),
      ...(input.nationCode !== undefined ? { nationCode: input.nationCode.trim() || null } : {}),
      ...(input.clubTeamId !== undefined ? { clubTeamId: input.clubTeamId || null } : {}),
      ...(input.internationalTeamId !== undefined
        ? { internationalTeamId: input.internationalTeamId || null }
        : {}),
      ...(input.fullName !== undefined ? { fullName: input.fullName?.trim() || null } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate || null } : {}),
      ...(input.birthPlace !== undefined ? { birthPlace: input.birthPlace?.trim() || null } : {}),
      ...(input.heightCm !== undefined ? { heightCm: input.heightCm ?? null } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg ?? null } : {}),
      ...(input.socialAccounts !== undefined ? { socialAccounts: input.socialAccounts } : {}),
      ...(input.squadNumber !== undefined ? { squadNumber: input.squadNumber ?? null } : {}),
      ...(input.bioSummary !== undefined ? { bioSummary: input.bioSummary?.trim() || null } : {}),
      ...(input.careerStatus !== undefined
        ? { careerStatus: normalizePlayerCareerStatus(input.careerStatus) }
        : {}),
      ...(input.isPublic !== undefined ? { isPublic: Boolean(input.isPublic) } : {}),
      ...(input.publishStatus !== undefined
        ? {
            publishStatus: ["published", "draft", "hidden"].includes(input.publishStatus)
              ? input.publishStatus
              : existing.publishStatus,
          }
        : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle?.trim() || null } : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: input.seoDescription?.trim() || null }
        : {}),
      ...(input.ogImageUrl !== undefined ? { ogImageUrl: input.ogImageUrl?.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.publicIntroOverride !== undefined
        ? { publicIntroOverride: input.publicIntroOverride?.trim() || null }
        : {}),
      ...(input.preferredFoot !== undefined
        ? { preferredFoot: input.preferredFoot?.trim() || null }
        : {}),
      ...(input.statusOverride !== undefined
        ? { statusOverride: input.statusOverride?.trim() || null }
        : {}),
      ...(input.contractExpiresOn !== undefined
        ? { contractExpiresOn: input.contractExpiresOn || null }
        : {}),
      ...(input.reportedSalaryGbp !== undefined
        ? { reportedSalaryGbp: input.reportedSalaryGbp ?? null }
        : {}),
      ...(input.salaryAsOf !== undefined ? { salaryAsOf: input.salaryAsOf || null } : {}),
      ...(input.agentName !== undefined ? { agentName: input.agentName?.trim() || null } : {}),
      ...(input.agentAgency !== undefined
        ? { agentAgency: input.agentAgency?.trim() || null }
        : {}),
      ...(input.clubDebutOn !== undefined ? { clubDebutOn: input.clubDebutOn || null } : {}),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, id))
    .returning();

  // Club change: discover new Planet Rugby images without replacing an approved primary.
  if (
    input.clubName !== undefined &&
    existing.clubName &&
    nextClub &&
    nextClub !== existing.clubName
  ) {
    try {
      const { refreshPlayerPlanetRugbyImages } = await import("./player-image-service");
      await refreshPlayerPlanetRugbyImages(id, "club_change");
    } catch {
      // Non-blocking enrichment
    }
  }

  return row;
}

export async function deletePlayer(id: string) {
  const db = getDb();
  const [row] = await db.delete(players).where(eq(players.id, id)).returning({ id: players.id });
  if (!row) throw new Error("Player not found");
  return row;
}

// ——— Referees ———

export async function listReferees() {
  const db = getDb();
  const rows = await db.select().from(referees).orderBy(asc(referees.name));

  const matchCounts = await db
    .select({
      refereeId: fixtures.refereeId,
      count: sql<number>`count(*)::int`,
    })
    .from(fixtures)
    .where(sql`${fixtures.refereeId} is not null`)
    .groupBy(fixtures.refereeId);

  const countByRef = Object.fromEntries(
    matchCounts.filter((r) => r.refereeId).map((r) => [r.refereeId!, r.count]),
  );

  return rows.map((r) => ({ ...r, matchCount: countByRef[r.id] ?? 0 }));
}

export async function getRefereeById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(referees).where(eq(referees.id, id)).limit(1);
  return row ?? null;
}

export async function resolveReferee(input: {
  name: string;
  countryName?: string;
  externalProviderId?: string;
  createIfMissing?: boolean;
}) {
  const db = getDb();
  const name = input.name.trim();
  if (!name) return null;

  if (input.externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(referees)
      .where(eq(referees.externalProviderId, input.externalProviderId))
      .limit(1);
    if (byExternal) return byExternal;
  }

  const lower = name.toLowerCase();
  const all = await db.select().from(referees);
  const byName = all.find((r) => r.name.toLowerCase() === lower);
  if (byName) return byName;

  if (input.createIfMissing === false) return null;

  const slug = uniqueSlug(name, input.externalProviderId);
  const [row] = await db
    .insert(referees)
    .values({
      name,
      slug,
      countryName: input.countryName?.trim() || null,
      externalProviderId: input.externalProviderId ?? null,
      sourceProvider: input.externalProviderId ? "sport365" : "manual",
    })
    .returning();
  return row;
}

export async function createReferee(input: {
  name: string;
  slug?: string;
  countryName?: string;
  externalProviderId?: string;
}) {
  const row = await resolveReferee({ ...input, createIfMissing: true });
  if (!row) throw new Error("Failed to create referee");
  if (input.slug && input.slug !== row.slug) {
    const db = getDb();
    const slug = normalizeSlug(input.slug);
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
    const [updated] = await db
      .update(referees)
      .set({ slug })
      .where(eq(referees.id, row.id))
      .returning();
    return updated;
  }
  return row;
}

export async function updateReferee(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    countryName: string;
    externalProviderId: string;
    nationality: string | null;
    birthDate: string | null;
    imageUrl: string | null;
    bioSummary: string | null;
    wikipediaUrl: string | null;
    wikidataId: string | null;
    sourceUrl: string | null;
    notes: string | null;
    socialAccounts: Record<string, string | null>;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(referees).where(eq(referees.id, id)).limit(1);
  if (!existing) throw new Error("Referee not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const [row] = await db
    .update(referees)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.countryName !== undefined ? { countryName: input.countryName.trim() || null } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality?.trim() || null } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.bioSummary !== undefined ? { bioSummary: input.bioSummary?.trim() || null } : {}),
      ...(input.wikipediaUrl !== undefined ? { wikipediaUrl: input.wikipediaUrl?.trim() || null } : {}),
      ...(input.wikidataId !== undefined ? { wikidataId: input.wikidataId?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.socialAccounts !== undefined ? { socialAccounts: input.socialAccounts } : {}),
      ...(input.externalProviderId !== undefined
        ? { externalProviderId: input.externalProviderId.trim() || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(referees.id, id))
    .returning();
  return row;
}

export async function deleteReferee(id: string) {
  const db = getDb();
  await db.update(fixtures).set({ refereeId: null }).where(eq(fixtures.refereeId, id));
  const [row] = await db.delete(referees).where(eq(referees.id, id)).returning({ id: referees.id });
  if (!row) throw new Error("Referee not found");
  return row;
}

// ——— Transfers ———

export async function listTransfers() {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerTransfers)
    .orderBy(desc(playerTransfers.effectiveDate));

  const playerRows = await db.select().from(players);
  const teamRows = await db.select().from(teams);
  const playerById = Object.fromEntries(playerRows.map((p) => [p.id, p]));
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  return rows.map((t) => ({
    ...t,
    playerName: playerById[t.playerId]?.name ?? "Unknown",
    fromTeamName: t.fromTeamId ? teamById[t.fromTeamId]?.name : t.fromClub,
    toTeamName: t.toTeamId ? teamById[t.toTeamId]?.name : t.toClub,
  }));
}

export async function createPlayerTransfer(input: {
  playerId: string;
  fromClub?: string;
  toClub?: string;
  fromTeamId?: string;
  toTeamId?: string;
  transferType?: "club" | "international";
  effectiveDate?: string;
  notes?: string;
}) {
  const { createTransferRecord } = await import("./transfer-admin-service");
  const { transfer } = await createTransferRecord({
    playerId: input.playerId,
    fromClub: input.fromClub,
    toClub: input.toClub,
    fromTeamId: input.fromTeamId,
    toTeamId: input.toTeamId,
    transferType: input.transferType,
    effectiveDate: input.effectiveDate,
    notes: input.notes,
    sourceProvider: "manual",
  });
  if (!transfer) {
    throw new Error("Transfer skipped — destination matches the current club (no change).");
  }
  return transfer;
}

export async function deletePlayerTransfer(id: string) {
  const db = getDb();
  const [row] = await db
    .delete(playerTransfers)
    .where(eq(playerTransfers.id, id))
    .returning({ id: playerTransfers.id });
  if (!row) throw new Error("Transfer not found");
  return row;
}

// ——— Squads (fixture_players) ———

export type FixtureSquadSummary = {
  fixtureId: string;
  slug: string;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoffAt: Date | null;
  status: string;
  squadCount: number;
};

export async function listFixtureSquads(): Promise<FixtureSquadSummary[]> {
  const fixtureRows = await listFixtures();
  const db = getDb();

  const counts = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      count: sql<number>`count(*)::int`,
    })
    .from(fixturePlayers)
    .groupBy(fixturePlayers.fixtureId);

  const countByFixture = Object.fromEntries(counts.map((c) => [c.fixtureId, c.count]));

  return fixtureRows.map((f) => ({
    fixtureId: f.id,
    slug: f.slug,
    homeTeam: f.homeTeam?.name ?? null,
    awayTeam: f.awayTeam?.name ?? null,
    kickoffAt: f.kickoffAt,
    status: f.status,
    squadCount: countByFixture[f.id] ?? 0,
  }));
}

export async function getFixtureSquad(fixtureId: string) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return null;

  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  const squadRows = await db
    .select({
      id: fixturePlayers.id,
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      jerseyNumber: fixturePlayers.jerseyNumber,
      squadRole: fixturePlayers.squadRole,
      positionName: fixturePlayers.positionName,
      clubName: fixturePlayers.clubName,
      playerName: players.name,
      playerSlug: players.slug,
      externalProviderId: players.externalProviderId,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, fixtureId))
    .orderBy(asc(fixturePlayers.jerseyNumber));

  const snap = (fixture.providerSnapshot ?? {}) as { lineups?: Sport365Lineups };
  const snapshotPlayerCount = snap.lineups
    ? snap.lineups.home.starting.length +
      snap.lineups.home.substitutes.length +
      snap.lineups.away.starting.length +
      snap.lineups.away.substitutes.length
    : 0;

  return {
    fixture: {
      ...fixture,
      homeTeam: fixture.homeTeamId ? teamById[fixture.homeTeamId] : null,
      awayTeam: fixture.awayTeamId ? teamById[fixture.awayTeamId] : null,
    },
    squad: squadRows,
    snapshotPlayerCount,
    hasSnapshotLineups: Boolean(snap.lineups),
  };
}

export async function addFixtureSquadPlayer(input: {
  fixtureId: string;
  playerId: string;
  teamId: string;
  jerseyNumber?: number;
  squadRole: string;
  positionName?: string;
  clubName?: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(fixturePlayers)
    .where(
      and(
        eq(fixturePlayers.fixtureId, input.fixtureId),
        eq(fixturePlayers.playerId, input.playerId),
      ),
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(fixturePlayers)
      .set({
        teamId: input.teamId,
        jerseyNumber: input.jerseyNumber ?? null,
        squadRole: input.squadRole,
        positionName: input.positionName ?? null,
        clubName: input.clubName ?? null,
      })
      .where(eq(fixturePlayers.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(fixturePlayers)
    .values({
      fixtureId: input.fixtureId,
      playerId: input.playerId,
      teamId: input.teamId,
      jerseyNumber: input.jerseyNumber ?? null,
      squadRole: input.squadRole,
      positionName: input.positionName ?? null,
      clubName: input.clubName ?? null,
    })
    .returning();
  return row;
}

export async function updateFixtureSquadPlayer(
  id: string,
  input: Partial<{
    jerseyNumber: number;
    squadRole: string;
    positionName: string;
    clubName: string;
    teamId: string;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(fixturePlayers)
    .set({
      ...(input.jerseyNumber !== undefined ? { jerseyNumber: input.jerseyNumber } : {}),
      ...(input.squadRole !== undefined ? { squadRole: input.squadRole } : {}),
      ...(input.positionName !== undefined ? { positionName: input.positionName || null } : {}),
      ...(input.clubName !== undefined ? { clubName: input.clubName || null } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
    })
    .where(eq(fixturePlayers.id, id))
    .returning();
  if (!row) throw new Error("Squad entry not found");
  return row;
}

export async function removeFixtureSquadPlayer(id: string) {
  const db = getDb();
  const [row] = await db
    .delete(fixturePlayers)
    .where(eq(fixturePlayers.id, id))
    .returning({ id: fixturePlayers.id });
  if (!row) throw new Error("Squad entry not found");
  return row;
}

export async function syncSquadFromMatchSnapshot(fixtureId: string) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture needs home and away teams");
  }

  const snap = (fixture.providerSnapshot ?? {}) as { lineups?: Sport365Lineups };
  if (!snap.lineups) throw new Error("No lineups in match snapshot — sync Sport365 first");

  const synced = await syncFixtureSquad(
    fixtureId,
    snap.lineups,
    fixture.homeTeamId,
    fixture.awayTeamId,
  );
  await linkFixtureEventPlayerIds(fixtureId);
  return { synced };
}

// ——— Map from matches (bulk import entity data) ———

export async function mapEntitiesFromMatches(): Promise<{
  playersUpserted: number;
  refereesUpserted: number;
  squadsSynced: number;
  eventsLinked: number;
  profilesRepaired: number;
}> {
  const db = getDb();
  const allFixtures = await db.select().from(fixtures);
  let playersUpserted = 0;
  let refereesUpserted = 0;
  let squadsSynced = 0;
  let eventsLinked = 0;

  for (const fixture of allFixtures) {
    const snap = (fixture.providerSnapshot ?? {}) as { lineups?: Sport365Lineups };

    if (fixture.refereeName) {
      const ref = await resolveReferee({ name: fixture.refereeName, createIfMissing: true });
      if (ref && fixture.refereeId !== ref.id) {
        await db
          .update(fixtures)
          .set({ refereeId: ref.id })
          .where(eq(fixtures.id, fixture.id));
        refereesUpserted += 1;
      }
    }

    if (snap.lineups && fixture.homeTeamId && fixture.awayTeamId) {
      squadsSynced += await syncFixtureSquad(
        fixture.id,
        snap.lineups,
        fixture.homeTeamId,
        fixture.awayTeamId,
      );
    }

    const events = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.fixtureId, fixture.id));

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      for (const field of ["player", "player_out"] as const) {
        const name = typeof payload[field] === "string" ? payload[field].trim() : "";
        if (!name) continue;
        const idKey = field === "player" ? "player_provider_id" : "player_out_provider_id";
        const posKey = field === "player" ? "player_position" : "player_out_position";
        const clubKey = field === "player" ? "player_club" : "player_out_club";
        const externalProviderId =
          typeof payload[idKey] === "string" ? payload[idKey] : undefined;
        const positionName = typeof payload[posKey] === "string" ? payload[posKey] : undefined;
        const clubName = typeof payload[clubKey] === "string" ? payload[clubKey] : undefined;

        const player = await resolvePlayer({
          name,
          externalProviderId,
          positionName,
          clubName,
          createIfMissing: true,
        });
        if (player) playersUpserted += 1;
      }
    }

    eventsLinked += await linkFixtureEventPlayerIds(fixture.id);
    await syncFixturePlayerStats(fixture.id);
  }

  const { repaired: profilesRepaired } = await repairAllPlayerProfilesFromSquads();
  await backfillAllPlayerProfilesFromEventPayloads();

  return { playersUpserted, refereesUpserted, squadsSynced, eventsLinked, profilesRepaired };
}
