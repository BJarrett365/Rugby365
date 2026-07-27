import { count, desc, eq } from "drizzle-orm";
import { fixtures, referees, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { normalizeSlug } from "./fixture-admin-service";

export type PublicRefereeMatch = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
};

export type PublicRefereeProfile = {
  id: string;
  slug: string;
  name: string;
  countryName: string | null;
  nationality: string | null;
  birthDate: string | null;
  imageUrl: string | null;
  bioSummary: string | null;
  wikipediaUrl: string | null;
  matchCount: number;
  recentMatches: PublicRefereeMatch[];
  preview: boolean;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    noIndex: boolean;
  };
};

export async function getPublicRefereeProfile(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PublicRefereeProfile | null> {
  const preview = Boolean(options.preview);
  const db = getDb();
  const normalized = normalizeSlug(slug);
  const [row] = await db.select().from(referees).where(eq(referees.slug, normalized)).limit(1);
  if (!row) return null;

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const matchRows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(eq(fixtures.refereeId, row.id))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(20);

  const recentMatches: PublicRefereeMatch[] = matchRows.map((m) => ({
    id: m.id,
    slug: m.slug,
    kickoffAt: m.kickoffAt?.toISOString() ?? null,
    status: m.status,
    competitionName: m.competitionName,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const [countRow] = await db
    .select({ value: count() })
    .from(fixtures)
    .where(eq(fixtures.refereeId, row.id));
  const matchCount = Number(countRow?.value ?? 0);

  const description =
    row.bioSummary?.trim().slice(0, 160) || `${row.name} referee profile on Rugby365.`;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryName: row.countryName,
    nationality: row.nationality,
    birthDate: row.birthDate,
    imageUrl: row.imageUrl,
    bioSummary: row.bioSummary,
    wikipediaUrl: row.wikipediaUrl,
    matchCount,
    recentMatches,
    preview,
    seo: {
      title: `${row.name} | Referee | Rugby365`,
      description,
      canonicalPath: `/referees/${row.slug}`,
      noIndex: preview,
    },
  };
}
