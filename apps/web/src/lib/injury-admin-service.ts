import { and, desc, eq, or, sql } from "drizzle-orm";
import { competitionSeasons, playerInjuries, players, teams } from "@rugby365/db";
import {
  sanitizePublicAvailabilityNotes,
  type InjuryStatus,
} from "./availability-types";
import { getDb } from "./db";

export type InjuryRow = {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  injuryType: string | null;
  bodyArea: string | null;
  injuryDate: string | null;
  dateReported: string | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  status: InjuryStatus;
  matchesMissed: number;
  source: string | null;
  sourceUrl: string | null;
  notes: string | null;
  lastVerifiedDate: string | null;
};

function mapInjuryRow(row: {
  injury: typeof playerInjuries.$inferSelect;
  playerName: string;
  teamName: string | null;
  seasonLabel: string | null;
}): InjuryRow {
  return {
    id: row.injury.id,
    playerId: row.injury.playerId,
    playerName: row.playerName,
    teamId: row.injury.teamId,
    teamName: row.teamName,
    seasonId: row.injury.seasonId,
    seasonLabel: row.seasonLabel,
    injuryType: row.injury.injuryType,
    bodyArea: row.injury.bodyArea,
    injuryDate: row.injury.injuryDate,
    dateReported: row.injury.dateReported,
    expectedReturnDate: row.injury.expectedReturnDate,
    actualReturnDate: row.injury.actualReturnDate,
    status: row.injury.status as InjuryStatus,
    matchesMissed: row.injury.matchesMissed,
    source: row.injury.source,
    sourceUrl: row.injury.sourceUrl,
    notes: row.injury.notes,
    lastVerifiedDate: row.injury.lastVerifiedDate,
  };
}

export async function listInjuries(filters: {
  playerId?: string;
  teamId?: string;
  seasonId?: string;
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<InjuryRow[]> {
  const db = getDb();
  const conditions = [];
  if (filters.playerId) conditions.push(eq(playerInjuries.playerId, filters.playerId));
  if (filters.teamId) conditions.push(eq(playerInjuries.teamId, filters.teamId));
  if (filters.seasonId) conditions.push(eq(playerInjuries.seasonId, filters.seasonId));
  if (filters.status) conditions.push(eq(playerInjuries.status, filters.status));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(or(sql`${players.name} ilike ${q}`, sql`${playerInjuries.injuryType} ilike ${q}`));
  }

  const rows = await db
    .select({
      injury: playerInjuries,
      playerName: players.name,
      teamName: teams.name,
      seasonLabel: competitionSeasons.label,
    })
    .from(playerInjuries)
    .innerJoin(players, eq(playerInjuries.playerId, players.id))
    .leftJoin(teams, eq(playerInjuries.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(playerInjuries.seasonId, competitionSeasons.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(playerInjuries.injuryDate), desc(playerInjuries.updatedAt))
    .limit(filters.limit ?? 200);

  return rows.map(mapInjuryRow);
}

export async function createInjury(input: {
  playerId: string;
  teamId?: string | null;
  seasonId?: string | null;
  injuryType?: string | null;
  bodyArea?: string | null;
  injuryDate?: string | null;
  dateReported?: string | null;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  status?: string;
  matchesMissed?: number;
  source?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  lastVerifiedDate?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(playerInjuries)
    .values({
      playerId: input.playerId,
      teamId: input.teamId ?? null,
      seasonId: input.seasonId ?? null,
      injuryType: input.injuryType?.trim() || null,
      bodyArea: input.bodyArea?.trim() || null,
      injuryDate: input.injuryDate ?? null,
      dateReported: input.dateReported ?? null,
      expectedReturnDate: input.expectedReturnDate ?? null,
      actualReturnDate: input.actualReturnDate ?? null,
      status: input.status ?? "injured",
      matchesMissed: input.matchesMissed ?? 0,
      source: input.source?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      notes: sanitizePublicAvailabilityNotes(input.notes),
      lastVerifiedDate: input.lastVerifiedDate ?? null,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateInjury(id: string, input: Partial<Parameters<typeof createInjury>[0]>) {
  const db = getDb();
  const [row] = await db
    .update(playerInjuries)
    .set({
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
      ...(input.injuryType !== undefined ? { injuryType: input.injuryType?.trim() || null } : {}),
      ...(input.bodyArea !== undefined ? { bodyArea: input.bodyArea?.trim() || null } : {}),
      ...(input.injuryDate !== undefined ? { injuryDate: input.injuryDate } : {}),
      ...(input.dateReported !== undefined ? { dateReported: input.dateReported } : {}),
      ...(input.expectedReturnDate !== undefined ? { expectedReturnDate: input.expectedReturnDate } : {}),
      ...(input.actualReturnDate !== undefined ? { actualReturnDate: input.actualReturnDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.matchesMissed !== undefined ? { matchesMissed: input.matchesMissed } : {}),
      ...(input.source !== undefined ? { source: input.source?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: sanitizePublicAvailabilityNotes(input.notes) } : {}),
      ...(input.lastVerifiedDate !== undefined ? { lastVerifiedDate: input.lastVerifiedDate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(playerInjuries.id, id))
    .returning();
  if (!row) throw new Error("Injury not found");
  return row;
}

export async function deleteInjury(id: string) {
  const db = getDb();
  await db.delete(playerInjuries).where(eq(playerInjuries.id, id));
}

export async function getInjuryById(id: string): Promise<InjuryRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      injury: playerInjuries,
      playerName: players.name,
      teamName: teams.name,
      seasonLabel: competitionSeasons.label,
    })
    .from(playerInjuries)
    .innerJoin(players, eq(playerInjuries.playerId, players.id))
    .leftJoin(teams, eq(playerInjuries.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(playerInjuries.seasonId, competitionSeasons.id))
    .where(eq(playerInjuries.id, id))
    .limit(1);
  if (!row) return null;
  return mapInjuryRow(row);
}
