/**
 * Public /players directory — all published players.
 */
import "server-only";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { fixturePlayers, players, teams } from "@rugby365/db";
import { getDb } from "./db";

export type PublicPlayerDirectoryRow = {
  slug: string;
  name: string;
  positionName: string | null;
  clubName: string | null;
  nationName: string | null;
  imageUrl: string | null;
  appearanceCount: number;
};

export type PublicPlayerDirectoryResult = {
  rows: PublicPlayerDirectoryRow[];
  page: number;
  pageSize: number;
  total: number;
  query: string;
};

export async function listPublicPlayersDirectory(input: {
  page?: number;
  pageSize?: number;
  q?: string;
}): Promise<PublicPlayerDirectoryResult> {
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(12, input.pageSize ?? 48));
  const q = input.q?.trim() ?? "";

  const conditions = [eq(players.isPublic, true), eq(players.publishStatus, "published")];
  if (q) {
    conditions.push(
      or(
        ilike(players.name, `%${q}%`),
        ilike(players.fullName, `%${q}%`),
        ilike(players.clubName, `%${q}%`),
        ilike(players.countryName, `%${q}%`),
        ilike(players.slug, `%${q}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const [totalRow] = await db.select({ value: count() }).from(players).where(where);
  const total = Number(totalRow?.value ?? 0);

  const rows = await db
    .select({
      slug: players.slug,
      name: players.name,
      positionName: players.positionName,
      clubName: players.clubName,
      clubTeamName: teams.name,
      countryName: players.countryName,
      imageUrl: players.imageUrl,
      appearanceCount: sql<number>`(
        select count(*)::int from ${fixturePlayers} fp where fp.player_id = ${players.id}
      )`,
    })
    .from(players)
    .leftJoin(teams, eq(players.clubTeamId, teams.id))
    .where(where)
    .orderBy(asc(players.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      positionName: r.positionName,
      clubName: r.clubTeamName ?? r.clubName,
      nationName: r.countryName,
      imageUrl: r.imageUrl,
      appearanceCount: Number(r.appearanceCount ?? 0),
    })),
    page,
    pageSize,
    total,
    query: q,
  };
}

export async function listPublicPlayerSitemapEntries(limit = 50000): Promise<
  Array<{ slug: string; updatedAt: string | null }>
> {
  const db = getDb();
  const rows = await db
    .select({
      slug: players.slug,
      updatedAt: players.profileUpdatedAt,
    })
    .from(players)
    .where(and(eq(players.isPublic, true), eq(players.publishStatus, "published")))
    .orderBy(asc(players.slug))
    .limit(limit);

  return rows.map((r) => ({
    slug: r.slug,
    updatedAt: r.updatedAt?.toISOString() ?? null,
  }));
}
