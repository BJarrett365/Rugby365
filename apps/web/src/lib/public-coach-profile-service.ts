import { desc, eq, or } from "drizzle-orm";
import { coaches, fixtures, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { getCoachDetail, type CoachingStaffRow } from "./coach-admin-service";
import { normalizeSlug } from "./fixture-admin-service";
import type { CoachSocialAccounts } from "./coach-types";

export type PublicCoachMatch = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  side: "home" | "away";
};

export type PublicCoachProfile = {
  id: string;
  slug: string;
  name: string;
  nationality: string | null;
  birthDate: string | null;
  age: number | null;
  imageUrl: string | null;
  bioSummary: string | null;
  wikipediaUrl: string | null;
  socialAccounts: CoachSocialAccounts;
  assignments: CoachingStaffRow[];
  recentMatches: PublicCoachMatch[];
  preview: boolean;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    noIndex: boolean;
  };
};

export async function getPublicCoachProfile(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PublicCoachProfile | null> {
  const preview = Boolean(options.preview);
  const db = getDb();
  const normalized = normalizeSlug(slug);
  const [row] = await db.select().from(coaches).where(eq(coaches.slug, normalized)).limit(1);
  if (!row) return null;

  const detail = await getCoachDetail(row.id);
  if (!detail) return null;

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
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(or(eq(fixtures.homeCoachId, row.id), eq(fixtures.awayCoachId, row.id)))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(12);

  const recentMatches: PublicCoachMatch[] = matchRows.map((m) => ({
    id: m.id,
    slug: m.slug,
    kickoffAt: m.kickoffAt?.toISOString() ?? null,
    status: m.status,
    competitionName: m.competitionName,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    side: m.homeCoachId === row.id ? "home" : "away",
  }));

  const description =
    detail.coach.bioSummary?.trim().slice(0, 160) ||
    `${detail.coach.name} coach profile on Rugby365.`;

  return {
    id: detail.coach.id,
    slug: detail.coach.slug,
    name: detail.coach.name,
    nationality: detail.coach.nationality,
    birthDate: detail.coach.birthDate,
    age: detail.age,
    imageUrl: detail.coach.imageUrl,
    bioSummary: detail.coach.bioSummary,
    wikipediaUrl: detail.coach.wikipediaUrl,
    socialAccounts: detail.socialAccounts,
    assignments: detail.assignments,
    recentMatches,
    preview,
    seo: {
      title: `${detail.coach.name} | Coach | Rugby365`,
      description,
      canonicalPath: `/coaches/${detail.coach.slug}`,
      noIndex: preview,
    },
  };
}
