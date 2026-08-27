/**
 * Public competition tables hub — competitions with standings for an active/latest season.
 */
import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import { getDb } from "./db";
import { cachedPublic, PUBLIC_CACHE_TTL } from "./public-data-cache";

export type PublicTableCompetitionCard = {
  competitionId: string;
  name: string;
  slug: string;
  competitionType: string | null;
  countryName: string | null;
  region: string | null;
  seasonId: string;
  seasonLabel: string;
  seasonSlug: string;
  teamCount: number;
  href: string;
};

function tableCardScore(row: {
  slug: string;
  teamCount: number;
  isActive: boolean | null;
  year: number | null;
}): number {
  let score = Number(row.teamCount) || 0;
  if (!row.slug.includes("__legacy__")) score += 1_000_000;
  if (row.isActive) score += 1000;
  score += Number(row.year) || 0;
  return score;
}

export async function listPublicCompetitionTables(): Promise<PublicTableCompetitionCard[]> {
  return cachedPublic("tables:hub", PUBLIC_CACHE_TTL.tablesHub, async () => {
  const db = getDb();

  // Active seasons first; fall back to latest season that has overall standings.
  const rows = await db
    .select({
      competitionId: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      competitionType: competitions.competitionType,
      countryName: competitions.countryName,
      region: competitions.region,
      seasonId: competitionSeasons.id,
      seasonLabel: competitionSeasons.label,
      seasonSlug: competitionSeasons.slug,
      isActive: competitionSeasons.isActive,
      year: competitionSeasons.year,
      teamCount: sql<number>`count(distinct ${standingRows.teamId})::int`,
    })
    .from(standingRows)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, standingRows.seasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(eq(standingRows.view, "overall"))
    .groupBy(
      competitions.id,
      competitions.name,
      competitions.slug,
      competitions.competitionType,
      competitions.countryName,
      competitions.region,
      competitionSeasons.id,
      competitionSeasons.label,
      competitionSeasons.slug,
      competitionSeasons.isActive,
      competitionSeasons.year,
    )
    .having(sql`count(distinct ${standingRows.teamId}) > 0`)
    .orderBy(asc(competitions.name), desc(competitionSeasons.year));

  // One season per competition id (prefer active).
  const byComp = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = byComp.get(row.competitionId);
    if (!existing) {
      byComp.set(row.competitionId, row);
      continue;
    }
    if (!existing.isActive && row.isActive) {
      byComp.set(row.competitionId, row);
    }
  }

  // One card per display name — collapse __legacy__ sync clones (URC ×4, Top 14 ×4, …).
  const byName = new Map<string, (typeof rows)[number]>();
  for (const row of byComp.values()) {
    const key = row.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || tableCardScore(row) > tableCardScore(prev)) {
      byName.set(key, row);
    }
  }

  return [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({
      competitionId: row.competitionId,
      name: row.name,
      slug: row.slug,
      competitionType: row.competitionType,
      countryName: row.countryName,
      region: row.region,
      seasonId: row.seasonId,
      seasonLabel: row.seasonLabel,
      seasonSlug: row.seasonSlug,
      teamCount: Number(row.teamCount) || 0,
      href: `/competitions/${row.slug}/table?season=${encodeURIComponent(row.seasonLabel)}`,
    }));
  });
}
