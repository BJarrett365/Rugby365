/**
 * CMS CRUD for structured player titles (World Cup, Top 14, …).
 */
import { and, asc, eq } from "drizzle-orm";
import { playerTitles } from "@rugby365/db";
import { getDb } from "./db";
import {
  isPlayerTitleType,
  type PlayerTitleRow,
} from "./player-titles-types";

export type { PlayerTitleRow, PlayerTitleType } from "./player-titles-types";
export {
  PLAYER_TITLE_TYPES,
  isPlayerTitleType,
  sumTitleCounts,
} from "./player-titles-types";

export async function listPlayerTitles(playerId: string): Promise<PlayerTitleRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerTitles)
    .where(eq(playerTitles.playerId, playerId))
    .orderBy(asc(playerTitles.sortOrder), asc(playerTitles.year));
  return rows.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    titleType: r.titleType,
    competitionId: r.competitionId,
    seasonLabel: r.seasonLabel,
    year: r.year,
    title: r.title,
    count: r.count,
    sourceUrl: r.sourceUrl,
    visibility: r.visibility,
    sortOrder: r.sortOrder,
  }));
}

export async function listPublicPlayerTitles(playerId: string): Promise<PlayerTitleRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerTitles)
    .where(and(eq(playerTitles.playerId, playerId), eq(playerTitles.visibility, "public")))
    .orderBy(asc(playerTitles.sortOrder), asc(playerTitles.year));
  return rows.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    titleType: r.titleType,
    competitionId: r.competitionId,
    seasonLabel: r.seasonLabel,
    year: r.year,
    title: r.title,
    count: r.count,
    sourceUrl: r.sourceUrl,
    visibility: r.visibility,
    sortOrder: r.sortOrder,
  }));
}

export async function createPlayerTitle(input: {
  playerId: string;
  titleType?: string;
  title: string;
  seasonLabel?: string | null;
  year?: number | null;
  count?: number;
  sourceUrl?: string | null;
  visibility?: string;
  sortOrder?: number;
}): Promise<PlayerTitleRow> {
  const db = getDb();
  const titleType = input.titleType && isPlayerTitleType(input.titleType) ? input.titleType : "other";
  const [row] = await db
    .insert(playerTitles)
    .values({
      playerId: input.playerId,
      titleType,
      title: input.title.trim(),
      seasonLabel: input.seasonLabel?.trim() || null,
      year: input.year ?? null,
      count: Math.max(1, input.count ?? 1),
      sourceUrl: input.sourceUrl?.trim() || null,
      visibility: input.visibility === "hidden" ? "hidden" : "public",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row!.id,
    playerId: row!.playerId,
    titleType: row!.titleType,
    competitionId: row!.competitionId,
    seasonLabel: row!.seasonLabel,
    year: row!.year,
    title: row!.title,
    count: row!.count,
    sourceUrl: row!.sourceUrl,
    visibility: row!.visibility,
    sortOrder: row!.sortOrder,
  };
}

export async function deletePlayerTitle(id: string, playerId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(playerTitles)
    .where(and(eq(playerTitles.id, id), eq(playerTitles.playerId, playerId)))
    .returning({ id: playerTitles.id });
  return deleted.length > 0;
}
