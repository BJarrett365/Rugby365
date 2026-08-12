/**
 * Entity data-health / coverage — operate with partial data, improve continuously.
 * First implementation target: South Africa + linked coaches/players/referees.
 */

import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { getCoachDataCoverage } from "./coach-recalc-service";
import { isFixtureRatingsPublished } from "./match-rating-math";

export const SOUTH_AFRICA_TEAM_ID = "b0000000-0000-4000-8000-000000000001";

export type CoverageRatio = { have: number; of: number; status: "COMPLETE" | "PARTIAL" | "MISSING" };

export type EntityDataHealth = {
  entityType: "team" | "coach" | "player" | "referee";
  entityId: string;
  label: string;
  profileHealthPct: number;
  layers: Array<{ key: string; label: string; have: number; of: number; status: CoverageRatio["status"] }>;
};

function ratioStatus(have: number, of: number): CoverageRatio["status"] {
  if (of <= 0) return "MISSING";
  if (have <= 0) return "MISSING";
  if (have >= of) return "COMPLETE";
  return "PARTIAL";
}

function healthFromLayers(layers: CoverageRatio[]): number {
  if (!layers.length) return 0;
  const sum = layers.reduce((acc, l) => acc + (l.of > 0 ? (100 * l.have) / l.of : 0), 0);
  return Math.round(sum / layers.length);
}

async function teamFixtureIds(teamId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: fixtures.id, status: fixtures.status })
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)));
  return rows.filter((r) => isFixtureRatingsPublished(r.status)).map((r) => r.id);
}

export async function getTeamDataHealth(teamId: string): Promise<EntityDataHealth> {
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const ids = await teamFixtureIds(teamId);
  const of = ids.length;

  let lineups = 0;
  let teamStats = 0;
  let playerStats = 0;
  let ratings = 0;

  if (of > 0) {
    const [lu] = await db
      .select({ n: sql<number>`count(distinct ${fixturePlayers.fixtureId})::int` })
      .from(fixturePlayers)
      .where(inArray(fixturePlayers.fixtureId, ids));
    lineups = lu?.n ?? 0;

    const [ts] = await db
      .select({ n: sql<number>`count(distinct ${teamMatchStats.fixtureId})::int` })
      .from(teamMatchStats)
      .where(
        and(inArray(teamMatchStats.fixtureId, ids), eq(teamMatchStats.teamId, teamId)),
      );
    teamStats = ts?.n ?? 0;

    const [ps] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchPerformanceStats.fixtureId})::int` })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          inArray(playerMatchPerformanceStats.fixtureId, ids),
          eq(playerMatchPerformanceStats.teamId, teamId),
        ),
      );
    playerStats = ps?.n ?? 0;

    const [pr] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
      .from(playerMatchRatings)
      .where(
        and(inArray(playerMatchRatings.fixtureId, ids), eq(playerMatchRatings.teamId, teamId)),
      );
    ratings = pr?.n ?? 0;
  }

  const layersRaw: CoverageRatio[] = [
    { have: of, of: of, status: ratioStatus(of, of) },
    { have: lineups, of, status: ratioStatus(lineups, of) },
    { have: teamStats, of, status: ratioStatus(teamStats, of) },
    { have: playerStats, of, status: ratioStatus(playerStats, of) },
    { have: ratings, of, status: ratioStatus(ratings, of) },
  ];

  return {
    entityType: "team",
    entityId: teamId,
    label: team?.name ?? "Team",
    profileHealthPct: healthFromLayers(layersRaw),
    layers: [
      { key: "fixtures", label: "Fixtures / Results", ...layersRaw[0] },
      { key: "lineups", label: "Lineups / Squads", ...layersRaw[1] },
      { key: "team_stats", label: "Team Stats", ...layersRaw[2] },
      { key: "player_stats", label: "Player Stats", ...layersRaw[3] },
      { key: "ratings", label: "Player Ratings", ...layersRaw[4] },
    ],
  };
}

export async function getCoachDataHealth(coachId: string): Promise<EntityDataHealth> {
  const cov = await getCoachDataCoverage(coachId);
  const layersRaw: CoverageRatio[] = [
    {
      have: cov.careerMatches,
      of: cov.careerMatches,
      status: ratioStatus(cov.careerMatches, cov.careerMatches),
    },
    {
      have: cov.lineups.have,
      of: cov.lineups.of,
      status: ratioStatus(cov.lineups.have, cov.lineups.of),
    },
    {
      have: cov.teamStats.have,
      of: cov.teamStats.of,
      status: ratioStatus(cov.teamStats.have, cov.teamStats.of),
    },
    {
      have: cov.playerRatings.have,
      of: cov.playerRatings.of,
      status: ratioStatus(cov.playerRatings.have, cov.playerRatings.of),
    },
    {
      have: cov.historicalRankings.have,
      of: cov.historicalRankings.of,
      status: ratioStatus(cov.historicalRankings.have, cov.historicalRankings.of),
    },
  ];

  const { getCoachDetail } = await import("./coach-admin-service");
  const detail = await getCoachDetail(coachId);

  return {
    entityType: "coach",
    entityId: coachId,
    label: detail?.coach.name ?? "Coach",
    profileHealthPct: cov.ratingConfidencePct,
    layers: [
      { key: "matches", label: "Career Matches", ...layersRaw[0] },
      { key: "lineups", label: "Lineups", ...layersRaw[1] },
      { key: "team_stats", label: "Team Stats", ...layersRaw[2] },
      { key: "player_ratings", label: "Player Ratings", ...layersRaw[3] },
      { key: "historical_rankings", label: "Historical Rankings", ...layersRaw[4] },
    ],
  };
}

export type SeasonBackfillCoverage = {
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonLabel: string;
  year: number | null;
  fixtures: CoverageRatio;
  results: CoverageRatio;
  lineups: CoverageRatio;
  teamStats: CoverageRatio;
  playerStats: CoverageRatio;
  ratings: CoverageRatio;
  referees: CoverageRatio;
};

export async function getCompetitionSeasonCoverage(input: {
  competitionId: string;
  seasonId: string;
}): Promise<SeasonBackfillCoverage | null> {
  const db = getDb();
  const { competitions, competitionSeasons } = await import("@rugby365/db");

  const [comp] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, input.competitionId))
    .limit(1);
  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, input.seasonId))
    .limit(1);
  if (!comp || !season) return null;

  const rows = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      refereeId: fixtures.refereeId,
    })
    .from(fixtures)
    .where(
      and(eq(fixtures.competitionId, input.competitionId), eq(fixtures.seasonId, input.seasonId)),
    );

  const ids = rows.map((r) => r.id);
  const of = ids.length;
  const resultsHave = rows.filter(
    (r) => isFixtureRatingsPublished(r.status) || (r.homeScore != null && r.awayScore != null),
  ).length;
  const refsHave = rows.filter((r) => Boolean(r.refereeId)).length;

  let lineups = 0;
  let teamStats = 0;
  let playerStats = 0;
  let ratings = 0;
  if (of > 0) {
    const [lu] = await db
      .select({ n: sql<number>`count(distinct ${fixturePlayers.fixtureId})::int` })
      .from(fixturePlayers)
      .where(inArray(fixturePlayers.fixtureId, ids));
    lineups = lu?.n ?? 0;
    const [ts] = await db
      .select({ n: sql<number>`count(distinct ${teamMatchStats.fixtureId})::int` })
      .from(teamMatchStats)
      .where(inArray(teamMatchStats.fixtureId, ids));
    teamStats = ts?.n ?? 0;
    const [ps] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchPerformanceStats.fixtureId})::int` })
      .from(playerMatchPerformanceStats)
      .where(inArray(playerMatchPerformanceStats.fixtureId, ids));
    playerStats = ps?.n ?? 0;
    const [pr] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
      .from(playerMatchRatings)
      .where(inArray(playerMatchRatings.fixtureId, ids));
    ratings = pr?.n ?? 0;
  }

  const mk = (have: number, total: number): CoverageRatio => ({
    have,
    of: total,
    status: ratioStatus(have, total),
  });

  return {
    competitionId: comp.id,
    competitionName: comp.name,
    seasonId: season.id,
    seasonLabel: season.label ?? String(season.year ?? ""),
    year: season.year,
    fixtures: mk(of, of),
    results: mk(resultsHave, of),
    lineups: mk(lineups, of),
    teamStats: mk(teamStats, of),
    playerStats: mk(playerStats, of),
    ratings: mk(ratings, of),
    referees: mk(refsHave, of),
  };
}

/** SA-first dashboard snapshot. */
export async function getSouthAfricaBackfillSnapshot(): Promise<{
  team: EntityDataHealth;
  coaches: EntityDataHealth[];
  queue: Awaited<ReturnType<typeof import("./data-change-event-service").getRecalcQueueSummary>>;
}> {
  const team = await getTeamDataHealth(SOUTH_AFRICA_TEAM_ID);
  const { teamCoachingStaff, coaches } = await import("@rugby365/db");
  const db = getDb();
  const staff = await db
    .select({ coachId: teamCoachingStaff.coachId, name: coaches.name })
    .from(teamCoachingStaff)
    .innerJoin(coaches, eq(teamCoachingStaff.coachId, coaches.id))
    .where(eq(teamCoachingStaff.teamId, SOUTH_AFRICA_TEAM_ID));

  const uniqueCoachIds = [...new Set(staff.map((s) => s.coachId))];
  const coachHealth: EntityDataHealth[] = [];
  for (const id of uniqueCoachIds.slice(0, 8)) {
    coachHealth.push(await getCoachDataHealth(id));
  }

  const { getRecalcQueueSummary } = await import("./data-change-event-service");
  const queue = await getRecalcQueueSummary();

  return { team, coaches: coachHealth, queue };
}
