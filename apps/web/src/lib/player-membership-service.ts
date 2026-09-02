import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  competitionSeasons,
  fixturePlayers,
  fixtures,
  playerSeasonStats,
  playerTeamMemberships,
  playerTransfers,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import { kickoffInSeason, parseSeasonStartYear } from "./season-label-utils";

export type PlayerMembershipStatus =
  | "active"
  | "incoming"
  | "departed"
  | "released"
  | "retired"
  | "loan_in"
  | "loan_out";

export type PlayerMembershipRow = {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  seasonId: string;
  competitionId: string;
  startDate: string | null;
  endDate: string | null;
  status: PlayerMembershipStatus;
  sourceProvider: string;
};

const ACTIVE_SQUAD_STATUSES: PlayerMembershipStatus[] = ["active", "incoming", "loan_in"];

export function isActiveSquadMembership(status: string): boolean {
  return ACTIVE_SQUAD_STATUSES.includes(status as PlayerMembershipStatus);
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export async function upsertPlayerTeamMembership(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
  competitionId: string;
  status?: PlayerMembershipStatus;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  sourceProvider?: string;
  sourceUrl?: string | null;
  notes?: string | null;
  membershipType?: "club" | "provincial" | "international";
  isCurrent?: boolean;
}) {
  const db = getDb();
  const status = input.status ?? "active";
  const [existing] = await db
    .select({ id: playerTeamMemberships.id })
    .from(playerTeamMemberships)
    .where(
      and(
        eq(playerTeamMemberships.playerId, input.playerId),
        eq(playerTeamMemberships.teamId, input.teamId),
        eq(playerTeamMemberships.seasonId, input.seasonId),
      ),
    )
    .limit(1);

  const values = {
    playerId: input.playerId,
    teamId: input.teamId,
    seasonId: input.seasonId,
    competitionId: input.competitionId,
    status,
    startDate: toDateString(input.startDate),
    endDate: toDateString(input.endDate),
    sourceProvider: input.sourceProvider ?? "manual",
    sourceUrl: input.sourceUrl ?? null,
    notes: input.notes ?? null,
    syncedAt: new Date(),
    ...(input.membershipType ? { membershipType: input.membershipType } : {}),
    ...(typeof input.isCurrent === "boolean" ? { isCurrent: input.isCurrent } : {}),
  };

  if (existing) {
    const [row] = await db
      .update(playerTeamMemberships)
      .set(values)
      .where(eq(playerTeamMemberships.id, existing.id))
      .returning();
    return row!;
  }

  const [row] = await db.insert(playerTeamMemberships).values(values).returning();
  return row!;
}

export async function closePlayerTeamMembership(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
  status: PlayerMembershipStatus;
  endDate?: string | Date | null;
  notes?: string | null;
}) {
  const db = getDb();
  await db
    .update(playerTeamMemberships)
    .set({
      status: input.status,
      endDate: toDateString(input.endDate ?? new Date()),
      syncedAt: new Date(),
      ...(input.notes ? { notes: input.notes } : {}),
    })
    .where(
      and(
        eq(playerTeamMemberships.playerId, input.playerId),
        eq(playerTeamMemberships.teamId, input.teamId),
        eq(playerTeamMemberships.seasonId, input.seasonId),
      ),
    );
}

export async function listMembershipsForTeamSeason(
  teamId: string,
  seasonId: string,
  statuses?: PlayerMembershipStatus[],
): Promise<PlayerMembershipRow[]> {
  const db = getDb();
  const conditions = [
    eq(playerTeamMemberships.teamId, teamId),
    eq(playerTeamMemberships.seasonId, seasonId),
  ];
  if (statuses?.length) {
    conditions.push(inArray(playerTeamMemberships.status, statuses));
  }

  const rows = await db
    .select({
      id: playerTeamMemberships.id,
      playerId: playerTeamMemberships.playerId,
      playerName: players.name,
      teamId: playerTeamMemberships.teamId,
      seasonId: playerTeamMemberships.seasonId,
      competitionId: playerTeamMemberships.competitionId,
      startDate: playerTeamMemberships.startDate,
      endDate: playerTeamMemberships.endDate,
      status: playerTeamMemberships.status,
      sourceProvider: playerTeamMemberships.sourceProvider,
    })
    .from(playerTeamMemberships)
    .innerJoin(players, eq(playerTeamMemberships.playerId, players.id))
    .where(and(...conditions))
    .orderBy(asc(players.name));

  return rows.map((row) => ({
    ...row,
    status: row.status as PlayerMembershipStatus,
    startDate: row.startDate,
    endDate: row.endDate,
  }));
}

export async function listPlayerIdsForTeamSeason(
  teamId: string,
  seasonId: string,
  activeOnly = true,
): Promise<string[]> {
  const statuses = activeOnly ? ACTIVE_SQUAD_STATUSES : undefined;
  const rows = await listMembershipsForTeamSeason(teamId, seasonId, statuses);
  return rows.map((row) => row.playerId);
}

export async function applyTransferToMemberships(input: {
  playerId: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  seasonId: string | null;
  competitionId: string | null;
  movementType: string;
  effectiveDate?: Date | string | null;
  sourceProvider?: string;
  sourceUrl?: string | null;
}) {
  if (!input.seasonId || !input.competitionId) return;

  const endStatus: PlayerMembershipStatus =
    input.movementType === "retirement"
      ? "retired"
      : input.movementType === "released"
        ? "released"
        : input.movementType === "loan"
          ? "loan_out"
          : "departed";

  if (input.fromTeamId) {
    await closePlayerTeamMembership({
      playerId: input.playerId,
      teamId: input.fromTeamId,
      seasonId: input.seasonId,
      status: endStatus,
      endDate: input.effectiveDate,
    });
  }

  if (input.toTeamId) {
    const incomingStatus: PlayerMembershipStatus =
      input.movementType === "loan" ? "loan_in" : "incoming";
    await upsertPlayerTeamMembership({
      playerId: input.playerId,
      teamId: input.toTeamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      status: incomingStatus,
      startDate: input.effectiveDate,
      sourceProvider: input.sourceProvider ?? "transfer",
      sourceUrl: input.sourceUrl,
    });
  }
}

export async function rebuildTeamSeasonMemberships(input: {
  teamId: string;
  seasonId: string;
  competitionId: string;
  seasonYear: number;
}) {
  const db = getDb();
  let fixtureCount = 0;

  const fixtureRows = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      playerId: fixturePlayers.playerId,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(
      and(eq(fixturePlayers.teamId, input.teamId), eq(fixtures.competitionId, input.competitionId)),
    );

  const fixturePlayerIds = new Set<string>();
  for (const row of fixtureRows) {
    if (!kickoffInSeason(row.kickoffAt, input.seasonYear)) continue;
    fixturePlayerIds.add(row.playerId);
    fixtureCount += 1;
    await upsertPlayerTeamMembership({
      playerId: row.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      status: "active",
      sourceProvider: "fixture_squad",
    });
  }

  const statsRows = await db
    .select({ playerId: playerSeasonStats.playerId })
    .from(playerSeasonStats)
    .where(
      and(
        eq(playerSeasonStats.teamId, input.teamId),
        eq(playerSeasonStats.seasonId, input.seasonId),
      ),
    );
  for (const row of statsRows) {
    await upsertPlayerTeamMembership({
      playerId: row.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      status: "active",
      sourceProvider: "season_stats",
    });
  }

  const transferRows = await db
    .select()
    .from(playerTransfers)
    .where(
      and(
        eq(playerTransfers.seasonId, input.seasonId),
        or(eq(playerTransfers.fromTeamId, input.teamId), eq(playerTransfers.toTeamId, input.teamId)),
      ),
    );

  for (const transfer of transferRows) {
    if (transfer.toTeamId === input.teamId) {
      await upsertPlayerTeamMembership({
        playerId: transfer.playerId,
        teamId: input.teamId,
        seasonId: input.seasonId,
        competitionId: input.competitionId,
        status: transfer.movementType === "loan" ? "loan_in" : "incoming",
        startDate: transfer.effectiveDate,
        sourceProvider: transfer.sourceProvider,
        sourceUrl: transfer.sourceUrl,
      });
    }
    if (transfer.fromTeamId === input.teamId) {
      await closePlayerTeamMembership({
        playerId: transfer.playerId,
        teamId: input.teamId,
        seasonId: input.seasonId,
        status:
          transfer.movementType === "retirement"
            ? "retired"
            : transfer.movementType === "released"
              ? "released"
              : "departed",
        endDate: transfer.effectiveDate,
      });
    }
  }

  return { fixtureAppearances: fixtureCount, uniqueFixturePlayers: fixturePlayerIds.size, transfers: transferRows.length };
}

export async function getPlayersLinkedByClubTeamId(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: players.id,
      name: players.name,
      clubTeamId: players.clubTeamId,
      careerStatus: players.careerStatus,
    })
    .from(players)
    .where(eq(players.clubTeamId, teamId))
    .orderBy(asc(players.name));
}
