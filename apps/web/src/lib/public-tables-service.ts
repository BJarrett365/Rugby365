/**
 * Public competition tables hub — competitions with standings for an active/latest season.
 * Also includes fixture-backed competitions that lack overall standing rows (e.g. Rugby World Cup pools).
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

type HubSeasonRow = {
  competitionId: string;
  name: string;
  slug: string;
  competitionType: string | null;
  countryName: string | null;
  region: string | null;
  seasonId: string;
  seasonLabel: string;
  seasonSlug: string;
  isActive: boolean | null;
  year: number | null;
  teamCount: number;
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

function pickPreferredSeason(rows: HubSeasonRow[]): Map<string, HubSeasonRow> {
  const byComp = new Map<string, HubSeasonRow>();
  for (const row of rows) {
    const existing = byComp.get(row.competitionId);
    if (!existing || tableCardScore(row) > tableCardScore(existing)) {
      byComp.set(row.competitionId, row);
    }
  }
  return byComp;
}

function collapseByDisplayName(rows: Iterable<HubSeasonRow>): HubSeasonRow[] {
  const byName = new Map<string, HubSeasonRow>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || tableCardScore(row) > tableCardScore(prev)) {
      byName.set(key, row);
    }
  }
  return [...byName.values()];
}

function toCard(row: HubSeasonRow): PublicTableCompetitionCard {
  return {
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
  };
}

export async function listPublicCompetitionTables(): Promise<PublicTableCompetitionCard[]> {
  return cachedPublic("tables:hub:v5", PUBLIC_CACHE_TTL.tablesHub, async () => {
    const db = getDb();

    // Active/latest seasons that already have overall standings.
    const standingRowsData = await db
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

    const byComp = pickPreferredSeason(
      standingRowsData.map((row) => ({
        ...row,
        teamCount: Number(row.teamCount) || 0,
      })),
    );

    // World Cup often has fixtures + live pool calc but no overall standing_rows,
    // so it was invisible on /tables. One grouped scan — not a per-season subquery
    // against unindexed fixtures.season_id, which hung the public hub in Chrome.
    const fixtureBacked = await db.execute(sql`
      SELECT
        c.id AS competition_id,
        c.name,
        c.slug,
        c.competition_type,
        c.country_name,
        c.region,
        cs.id AS season_id,
        cs.label AS season_label,
        cs.slug AS season_slug,
        cs.is_active,
        cs.year,
        count(DISTINCT team_id)::int AS team_count
      FROM competitions c
      INNER JOIN competition_seasons cs ON cs.competition_id = c.id
      INNER JOIN (
        SELECT season_id, home_team_id AS team_id
        FROM fixtures
        WHERE season_id IS NOT NULL AND home_team_id IS NOT NULL
        UNION
        SELECT season_id, away_team_id
        FROM fixtures
        WHERE season_id IS NOT NULL AND away_team_id IS NOT NULL
      ) teams ON teams.season_id = cs.id
      WHERE (
        c.competition_type = 'world_cup'
        OR c.slug = 'rugby-world-cup'
        OR c.slug LIKE 'rugby-world-cup__legacy__%'
      )
      GROUP BY
        c.id, c.name, c.slug, c.competition_type, c.country_name, c.region,
        cs.id, cs.label, cs.slug, cs.is_active, cs.year
      HAVING count(DISTINCT team_id) > 0
      ORDER BY c.name ASC, cs.year DESC NULLS LAST
    `);

    const fixtureRows = (Array.isArray(fixtureBacked) ? fixtureBacked : []) as Array<{
      competition_id: string;
      name: string;
      slug: string;
      competition_type: string | null;
      country_name: string | null;
      region: string | null;
      season_id: string;
      season_label: string;
      season_slug: string;
      is_active: boolean | null;
      year: number | null;
      team_count: number;
    }>;

    // drizzle execute may wrap as Result; normalize
    const rawRows = (fixtureBacked as { rows?: typeof fixtureRows }).rows ?? fixtureRows;

    for (const row of rawRows) {
      const mapped: HubSeasonRow = {
        competitionId: row.competition_id,
        name: row.name,
        slug: row.slug,
        competitionType: row.competition_type,
        countryName: row.country_name,
        region: row.region,
        seasonId: row.season_id,
        seasonLabel: row.season_label,
        seasonSlug: row.season_slug,
        isActive: row.is_active,
        year: row.year,
        teamCount: Number(row.team_count) || 0,
      };
      if (mapped.teamCount <= 0) continue;
      const existing = byComp.get(mapped.competitionId);
      if (!existing || tableCardScore(mapped) > tableCardScore(existing)) {
        byComp.set(mapped.competitionId, mapped);
      }
    }

    return collapseByDisplayName(byComp.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toCard);
  });
}
