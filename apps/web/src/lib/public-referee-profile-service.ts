import { avg, count, desc, eq } from "drizzle-orm";
import { competitions, fixtures, refereeMatchRatings, referees, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { normalizeSlug } from "./fixture-admin-service";
import { resolveTeamCrestImageUrl } from "./crest-library-service";
import {
  sanitizeRefereeAppointments,
  type PublicRefereeMatch,
  type RefereeAppointmentInput,
} from "./referee-matches-utils";
import {
  isRefereeInternationalAppointment,
  isRefereeTestAppointment,
  refereeOccupationFor,
} from "./referee-identity-utils";
import {
  fetchWikipediaThumbnails,
  thumbnailForName,
  wikipediaTitleCandidates,
} from "./wikipedia-page-image";

export type { PublicRefereeMatch };

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
  occupation: string | null;
  matchCount: number;
  internationalMatchCount: number;
  testMatchCount: number;
  tournamentCount: number;
  debutYear: string | null;
  avgRating: number | null;
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
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      competitionCode: competitions.sdmsCompCode,
      competitionSlug: competitions.slug,
      competitionNameJoined: competitions.name,
      competitionType: competitions.competitionType,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
      homeTeamImageUrl: homeTeams.imageUrl,
      awayTeamImageUrl: awayTeams.imageUrl,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixtures.refereeId, row.id))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(48);

  const teamIds = [
    ...new Set(
      matchRows.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter((id): id is string => Boolean(id)),
    ),
  ];
  const crestById = new Map<string, string | null>();
  await Promise.all(
    teamIds.map(async (id) => {
      crestById.set(id, await resolveTeamCrestImageUrl(id));
    }),
  );

  const inputs: RefereeAppointmentInput[] = matchRows.map((m) => ({
    id: m.id,
    slug: m.slug,
    kickoffAt: m.kickoffAt?.toISOString() ?? null,
    status: m.status,
    competitionName: m.competitionNameJoined ?? m.competitionName,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeTeamSlug: m.homeTeamSlug,
    awayTeamSlug: m.awayTeamSlug,
    homeCrestUrl: (m.homeTeamId ? crestById.get(m.homeTeamId) : null) ?? m.homeTeamImageUrl,
    awayCrestUrl: (m.awayTeamId ? crestById.get(m.awayTeamId) : null) ?? m.awayTeamImageUrl,
    planetRugbyUrl: m.planetRugbyUrl,
    externalMatchId: m.externalMatchId,
    competitionCode: m.competitionCode,
    competitionSlug: m.competitionSlug,
  }));

  const recentMatches = sanitizeRefereeAppointments(inputs);

  const careerRows = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      competitionId: fixtures.competitionId,
      competitionName: fixtures.competitionName,
      competitionNameJoined: competitions.name,
      competitionType: competitions.competitionType,
    })
    .from(fixtures)
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixtures.refereeId, row.id));

  let internationalMatchCount = 0;
  let testMatchCount = 0;
  const tournamentKeys = new Set<string>();
  let debutYear: string | null = null;
  for (const appointment of careerRows) {
    const label = appointment.competitionNameJoined ?? appointment.competitionName;
    if (appointment.competitionId) tournamentKeys.add(appointment.competitionId);
    else if (label) tournamentKeys.add(label.toLowerCase());
    const international = isRefereeInternationalAppointment(appointment.competitionType, label);
    if (international) internationalMatchCount += 1;
    if (isRefereeTestAppointment(appointment.competitionType, label)) testMatchCount += 1;
    if (international && appointment.kickoffAt) {
      const yearNum = new Date(appointment.kickoffAt).getUTCFullYear();
      if (Number.isFinite(yearNum)) {
        const year = String(yearNum);
        if (!debutYear || year < debutYear) debutYear = year;
      }
    }
  }

  const [countRow] = await db
    .select({ value: count() })
    .from(fixtures)
    .where(eq(fixtures.refereeId, row.id));
  const matchCount = Number(countRow?.value ?? careerRows.length);

  const [ratingRow] = await db
    .select({ value: avg(refereeMatchRatings.rating) })
    .from(refereeMatchRatings)
    .where(eq(refereeMatchRatings.refereeId, row.id));
  const avgRating = ratingRow?.value != null ? Number(ratingRow.value) : null;

  let imageUrl = row.imageUrl;
  if (!imageUrl?.trim()) {
    const thumbs = await fetchWikipediaThumbnails(wikipediaTitleCandidates(row.name, "referee"));
    imageUrl = thumbnailForName(thumbs, row.name, "referee");
  }

  const description =
    row.bioSummary?.trim().slice(0, 160) || `${row.name} referee profile on Rugby365.`;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryName: row.countryName,
    nationality: row.nationality,
    birthDate: row.birthDate ? String(row.birthDate).slice(0, 10) : null,
    imageUrl,
    bioSummary: row.bioSummary,
    wikipediaUrl: row.wikipediaUrl,
    occupation: refereeOccupationFor(row.name, row.notes),
    matchCount,
    internationalMatchCount,
    testMatchCount,
    tournamentCount: tournamentKeys.size,
    debutYear,
    avgRating,
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
