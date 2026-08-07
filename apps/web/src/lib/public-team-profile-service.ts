import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  fixtures,
  fixturePlayers,
  players,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import { getTeamCoachingStaff, type CoachingStaffRow } from "./coach-admin-service";
import { normalizeSlug } from "./fixture-admin-service";

export type PublicTeamFixture = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  side: "home" | "away";
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  result: "won" | "lost" | "draw" | null;
  venueName: string | null;
};

export type PublicTeamSquadPlayer = {
  playerId: string;
  name: string;
  slug: string;
  positionName: string | null;
  jerseyNumber: number | null;
  squadRole: string;
};

export type PublicTeamProfile = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  countryName: string | null;
  hemisphere: string | null;
  region: string | null;
  teamType: string | null;
  foundedYear: number | null;
  imageUrl: string | null;
  bioSummary: string | null;
  wikipediaUrl: string | null;
  homeVenueName: string | null;
  preview: boolean;
  results: {
    played: number;
    won: number;
    lost: number;
    drawn: number;
    scheduled: number;
  };
  recentResults: PublicTeamFixture[];
  upcoming: PublicTeamFixture[];
  squad: PublicTeamSquadPlayer[];
  squadFixture: { id: string; slug: string; opponentName: string; kickoffAt: string | null } | null;
  coachingStaff: {
    current: CoachingStaffRow[];
    past: CoachingStaffRow[];
  };
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    noIndex: boolean;
  };
};

function fixtureResult(
  status: string,
  teamScore: number,
  opponentScore: number,
): "won" | "lost" | "draw" | null {
  if (status !== "full_time" && status !== "live") return null;
  if (teamScore > opponentScore) return "won";
  if (teamScore < opponentScore) return "lost";
  if (status === "full_time") return "draw";
  return null;
}

export async function getPublicTeamProfile(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PublicTeamProfile | null> {
  const preview = Boolean(options.preview);
  const db = getDb();
  const normalized = normalizeSlug(slug);
  const [team] = await db.select().from(teams).where(eq(teams.slug, normalized)).limit(1);
  if (!team) return null;

  const homeVenueName = team.homeVenueId
    ? (
        await db
          .select({ name: venues.name })
          .from(venues)
          .where(eq(venues.id, team.homeVenueId))
          .limit(1)
      )[0]?.name ?? null
    : null;

  const fixtureRows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      venueName: fixtures.venueName,
      venueId: fixtures.venueId,
    })
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, team.id), eq(fixtures.awayTeamId, team.id)))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(80);

  const opponentIds = [
    ...new Set(
      fixtureRows
        .map((f) => (f.homeTeamId === team.id ? f.awayTeamId : f.homeTeamId))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const opponentRows =
    opponentIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, opponentIds))
      : [];
  const opponentById = Object.fromEntries(opponentRows.map((t) => [t.id, t.name]));

  const mapped: PublicTeamFixture[] = fixtureRows.map((f) => {
    const isHome = f.homeTeamId === team.id;
    const opponentId = isHome ? f.awayTeamId : f.homeTeamId;
    const teamScore = isHome ? f.homeScore : f.awayScore;
    const opponentScore = isHome ? f.awayScore : f.homeScore;
    return {
      id: f.id,
      slug: f.slug,
      kickoffAt: f.kickoffAt?.toISOString() ?? null,
      status: f.status,
      competitionName: f.competitionName,
      side: isHome ? "home" : "away",
      opponentName: (opponentId ? opponentById[opponentId] : null) ?? "TBC",
      teamScore,
      opponentScore,
      result: fixtureResult(f.status, teamScore, opponentScore),
      venueName: f.venueName,
    };
  });

  const completed = mapped.filter((f) => f.status === "full_time" || f.status === "live");
  const results = {
    played: completed.filter((f) => f.status === "full_time").length,
    won: completed.filter((f) => f.result === "won" && f.status === "full_time").length,
    lost: completed.filter((f) => f.result === "lost" && f.status === "full_time").length,
    drawn: completed.filter((f) => f.result === "draw" && f.status === "full_time").length,
    scheduled: mapped.filter((f) => f.status === "scheduled").length,
  };

  const recentResults = mapped.filter((f) => f.status === "full_time").slice(0, 10);
  const nowIso = new Date().toISOString();
  const upcoming = mapped
    .filter((f) => f.status === "scheduled" && (f.kickoffAt == null || f.kickoffAt >= nowIso))
    .sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""))
    .slice(0, 8);

  const squadFixtureRow = mapped.find((f) => f.status === "full_time" || f.status === "live") ?? null;
  let squad: PublicTeamSquadPlayer[] = [];
  let squadFixture: PublicTeamProfile["squadFixture"] = null;

  if (squadFixtureRow) {
    squadFixture = {
      id: squadFixtureRow.id,
      slug: squadFixtureRow.slug,
      opponentName: squadFixtureRow.opponentName,
      kickoffAt: squadFixtureRow.kickoffAt,
    };
    const squadRows = await db
      .select({
        playerId: players.id,
        name: players.name,
        slug: players.slug,
        positionName: players.positionName,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
      })
      .from(fixturePlayers)
      .innerJoin(players, eq(fixturePlayers.playerId, players.id))
      .where(
        and(eq(fixturePlayers.fixtureId, squadFixtureRow.id), eq(fixturePlayers.teamId, team.id)),
      )
      .orderBy(
        sql`case when ${fixturePlayers.squadRole} = 'starting' then 0 else 1 end`,
        fixturePlayers.jerseyNumber,
      );
    squad = squadRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      slug: row.slug,
      positionName: row.positionName,
      jerseyNumber: row.jerseyNumber,
      squadRole: row.squadRole ?? "starting",
    }));
  }

  const staff = await getTeamCoachingStaff(team.id);
  const description =
    team.bioSummary?.trim().slice(0, 160) ||
    `${team.name} team profile on Rugby365 — fixtures, squad and coaching staff.`;

  return {
    id: team.id,
    slug: team.slug,
    name: team.name,
    shortName: team.shortName,
    countryName: team.countryName,
    hemisphere: team.hemisphere,
    region: team.region,
    teamType: team.teamType,
    foundedYear: team.foundedYear,
    imageUrl: team.imageUrl,
    bioSummary: team.bioSummary,
    wikipediaUrl: team.wikipediaUrl,
    homeVenueName,
    preview,
    results,
    recentResults,
    upcoming,
    squad,
    squadFixture,
    coachingStaff: { current: staff.current, past: staff.past.slice(0, 12) },
    seo: {
      title: `${team.name} | Team | Rugby365`,
      description,
      canonicalPath: `/teams/${team.slug}`,
      noIndex: preview,
    },
  };
}
