import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  competitions,
  playerLegends,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  type LegendLevel,
  type LegendStatus,
  legendLevelLabel,
  normalizeLegendLevel,
} from "./legend-types";

export type LegendRow = {
  id: string;
  playerId: string;
  playerName: string;
  playerSlug: string;
  playerPosition: string | null;
  legendStatus: LegendStatus;
  legendLevel: LegendLevel;
  legendLevelLabel: string;
  teamId: string | null;
  teamName: string | null;
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  internationalTeamId: string | null;
  internationalTeamName: string | null;
  era: string | null;
  reason: string | null;
  careerSummary: string | null;
  keyAchievements: string[];
  notableStats: Record<string, unknown>;
  editorNotes: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseAchievements(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseNotableStats(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapLegendRow(row: {
  legend: typeof playerLegends.$inferSelect;
  playerName: string;
  playerSlug: string;
  playerPosition: string | null;
  teamName: string | null;
  competitionName: string | null;
  internationalTeamName: string | null;
}): LegendRow {
  const level = normalizeLegendLevel(row.legend.legendLevel);
  return {
    id: row.legend.id,
    playerId: row.legend.playerId,
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    playerPosition: row.playerPosition,
    legendStatus: row.legend.legendStatus as LegendStatus,
    legendLevel: level,
    legendLevelLabel: legendLevelLabel(level),
    teamId: row.legend.teamId,
    teamName: row.teamName,
    competitionId: row.legend.competitionId,
    competitionName: row.competitionName,
    countryName: row.legend.countryName,
    internationalTeamId: row.legend.internationalTeamId,
    internationalTeamName: row.internationalTeamName,
    era: row.legend.era,
    reason: row.legend.reason,
    careerSummary: row.legend.careerSummary,
    keyAchievements: parseAchievements(row.legend.keyAchievements),
    notableStats: parseNotableStats(row.legend.notableStats),
    editorNotes: row.legend.editorNotes,
    sourceUrl: row.legend.sourceUrl,
    createdAt: row.legend.createdAt.toISOString(),
    updatedAt: row.legend.updatedAt.toISOString(),
  };
}

async function selectLegendRows(whereClause?: ReturnType<typeof eq> | ReturnType<typeof and>) {
  const db = getDb();
  const base = db
    .select({
      legend: playerLegends,
      playerName: players.name,
      playerSlug: players.slug,
      playerPosition: players.positionName,
      teamName: teams.name,
      competitionName: competitions.name,
    })
    .from(playerLegends)
    .innerJoin(players, eq(playerLegends.playerId, players.id))
    .leftJoin(teams, eq(playerLegends.teamId, teams.id))
    .leftJoin(competitions, eq(playerLegends.competitionId, competitions.id));

  const rows = whereClause ? await base.where(whereClause) : await base;
  const intTeamIds = [...new Set(rows.map((r) => r.legend.internationalTeamId).filter(Boolean))] as string[];
  const intTeams =
    intTeamIds.length > 0
      ? await db.select({ id: teams.id, name: teams.name }).from(teams)
      : [];
  const intTeamById = new Map(intTeams.map((t) => [t.id, t.name]));

  return rows.map((row) =>
    mapLegendRow({
      ...row,
      internationalTeamName: row.legend.internationalTeamId
        ? (intTeamById.get(row.legend.internationalTeamId) ?? null)
        : null,
    }),
  );
}

export async function listLegends(filters?: {
  search?: string;
  teamId?: string;
  legendLevel?: string;
  legendStatus?: string;
}) {
  const db = getDb();
  const conditions = [];
  if (filters?.teamId) conditions.push(eq(playerLegends.teamId, filters.teamId));
  if (filters?.legendLevel) conditions.push(eq(playerLegends.legendLevel, normalizeLegendLevel(filters.legendLevel)));
  if (filters?.legendStatus) conditions.push(eq(playerLegends.legendStatus, filters.legendStatus));
  if (filters?.search) {
    conditions.push(
      or(
        ilike(players.name, `%${filters.search}%`),
        ilike(playerLegends.reason, `%${filters.search}%`),
        ilike(playerLegends.era, `%${filters.search}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      legend: playerLegends,
      playerName: players.name,
      playerSlug: players.slug,
      playerPosition: players.positionName,
      teamName: teams.name,
      competitionName: competitions.name,
    })
    .from(playerLegends)
    .innerJoin(players, eq(playerLegends.playerId, players.id))
    .leftJoin(teams, eq(playerLegends.teamId, teams.id))
    .leftJoin(competitions, eq(playerLegends.competitionId, competitions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(playerLegends.updatedAt));

  const intTeamIds = [...new Set(rows.map((r) => r.legend.internationalTeamId).filter(Boolean))] as string[];
  const intTeams =
    intTeamIds.length > 0
      ? await db.select({ id: teams.id, name: teams.name }).from(teams)
      : [];
  const intTeamById = new Map(intTeams.map((t) => [t.id, t.name]));

  return rows.map((row) =>
    mapLegendRow({
      ...row,
      internationalTeamName: row.legend.internationalTeamId
        ? (intTeamById.get(row.legend.internationalTeamId) ?? null)
        : null,
    }),
  );
}

export async function getLegendById(id: string) {
  const rows = await selectLegendRows(eq(playerLegends.id, id));
  return rows[0] ?? null;
}

export async function getPlayerLegends(playerId: string) {
  const rows = await selectLegendRows(eq(playerLegends.playerId, playerId));
  return rows.filter((row) => row.legendStatus === "active");
}

export async function getTeamLegends(teamId: string, era?: string) {
  const rows = await selectLegendRows(
    era
      ? and(eq(playerLegends.teamId, teamId), ilike(playerLegends.era, `%${era}%`))
      : eq(playerLegends.teamId, teamId),
  );
  return rows.filter((row) => row.legendStatus === "active");
}

export async function createLegend(input: {
  playerId: string;
  legendLevel: string;
  legendStatus?: LegendStatus;
  teamId?: string | null;
  competitionId?: string | null;
  countryName?: string | null;
  internationalTeamId?: string | null;
  era?: string | null;
  reason?: string | null;
  careerSummary?: string | null;
  keyAchievements?: string[];
  notableStats?: Record<string, unknown>;
  editorNotes?: string | null;
  sourceUrl?: string | null;
}) {
  const db = getDb();
  const legendLevel = normalizeLegendLevel(input.legendLevel);
  const [row] = await db
    .insert(playerLegends)
    .values({
      playerId: input.playerId,
      legendStatus: input.legendStatus ?? "active",
      legendLevel,
      teamId: input.teamId ?? null,
      competitionId: input.competitionId ?? null,
      countryName: input.countryName?.trim() || null,
      internationalTeamId: input.internationalTeamId ?? null,
      era: input.era?.trim() || null,
      reason: input.reason?.trim() || null,
      careerSummary: input.careerSummary?.trim() || null,
      keyAchievements: (input.keyAchievements ?? []).filter(Boolean),
      notableStats: input.notableStats ?? {},
      editorNotes: input.editorNotes?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      updatedAt: new Date(),
    })
    .returning();
  if ((input.legendStatus ?? "active") === "active") {
    const { applyPlayerCareerStatus } = await import("./player-career-status-service");
    await applyPlayerCareerStatus(input.playerId, "legend");
  }
  return getLegendById(row!.id);
}

export async function updateLegend(
  id: string,
  input: Partial<{
    legendStatus: LegendStatus;
    legendLevel: string;
    teamId: string | null;
    competitionId: string | null;
    countryName: string | null;
    internationalTeamId: string | null;
    era: string | null;
    reason: string | null;
    careerSummary: string | null;
    keyAchievements: string[];
    notableStats: Record<string, unknown>;
    editorNotes: string | null;
    sourceUrl: string | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(playerLegends).where(eq(playerLegends.id, id)).limit(1);
  if (!existing) throw new Error("Legend record not found");

  const [row] = await db
    .update(playerLegends)
    .set({
      ...(input.legendStatus !== undefined ? { legendStatus: input.legendStatus } : {}),
      ...(input.legendLevel !== undefined ? { legendLevel: normalizeLegendLevel(input.legendLevel) } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.competitionId !== undefined ? { competitionId: input.competitionId } : {}),
      ...(input.countryName !== undefined ? { countryName: input.countryName?.trim() || null } : {}),
      ...(input.internationalTeamId !== undefined ? { internationalTeamId: input.internationalTeamId } : {}),
      ...(input.era !== undefined ? { era: input.era?.trim() || null } : {}),
      ...(input.reason !== undefined ? { reason: input.reason?.trim() || null } : {}),
      ...(input.careerSummary !== undefined ? { careerSummary: input.careerSummary?.trim() || null } : {}),
      ...(input.keyAchievements !== undefined
        ? { keyAchievements: input.keyAchievements.filter(Boolean) }
        : {}),
      ...(input.notableStats !== undefined ? { notableStats: input.notableStats } : {}),
      ...(input.editorNotes !== undefined ? { editorNotes: input.editorNotes?.trim() || null } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(playerLegends.id, id))
    .returning();
  const { reconcilePlayerCareerStatus } = await import("./player-career-status-service");
  await reconcilePlayerCareerStatus(existing.playerId);
  return getLegendById(row!.id);
}

export async function deleteLegend(id: string) {
  const db = getDb();
  await db.delete(playerLegends).where(eq(playerLegends.id, id));
}

export function isActiveLegend(rows: LegendRow[]): boolean {
  return rows.some((row) => row.legendStatus === "active");
}

export function highestLegendLevel(rows: LegendRow[]): LegendLevel | null {
  const order: LegendLevel[] = [
    "hall_of_fame",
    "rugby_icon",
    "international_legend",
    "competition_legend",
    "club_legend",
  ];
  for (const level of order) {
    if (rows.some((row) => row.legendLevel === level && row.legendStatus === "active")) {
      return level;
    }
  }
  return null;
}
