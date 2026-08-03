/**
 * Upcoming fixtures pre-game readiness board (stadium, weather, ref, coaches).
 */
import "server-only";
import { and, asc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  coaches,
  competitions,
  fixtures,
  referees,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  evaluatePregameReadiness,
  isPregameStatus,
  type PregameReadinessResult,
} from "./match-pregame-readiness";

export type PregameFixtureRow = {
  fixtureId: string;
  kickoffAt: string;
  status: string;
  competitionName: string | null;
  homeTeamName: string;
  awayTeamName: string;
  venueName: string | null;
  refereeName: string | null;
  homeCoachName: string | null;
  awayCoachName: string | null;
  editHref: string;
  readiness: PregameReadinessResult;
};

export async function listPregameReadiness(opts?: {
  /** Hours ahead to scan (default 72). */
  hoursAhead?: number;
  /** Include fixtures that already kicked off within this many hours (default 6). */
  hoursBehind?: number;
  competitionId?: string | null;
  /** When true, only return fixtures missing at least one check. */
  gapsOnly?: boolean;
  limit?: number;
}): Promise<{
  generatedAt: string;
  hoursAhead: number;
  total: number;
  ready: number;
  notReady: number;
  fixtures: PregameFixtureRow[];
}> {
  const hoursAhead = opts?.hoursAhead ?? 72;
  const hoursBehind = opts?.hoursBehind ?? 6;
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const now = Date.now();
  const from = new Date(now - hoursBehind * 60 * 60 * 1000);
  const to = new Date(now + hoursAhead * 60 * 60 * 1000);

  const db = getDb();
  const homeTeam = alias(teams, "pregame_home_team");
  const awayTeam = alias(teams, "pregame_away_team");
  const homeCoach = alias(coaches, "pregame_home_coach");
  const awayCoach = alias(coaches, "pregame_away_coach");

  const conditions = [
    gte(fixtures.kickoffAt, from),
    lt(fixtures.kickoffAt, to),
    or(eq(fixtures.status, "scheduled"), eq(fixtures.status, "postponed")),
  ];
  if (opts?.competitionId?.trim()) {
    conditions.push(eq(fixtures.competitionId, opts.competitionId.trim()));
  }

  const rows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: competitions.name,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      venueId: fixtures.venueId,
      venueName: venues.name,
      venueLatitude: venues.latitude,
      venueLongitude: venues.longitude,
      refereeId: fixtures.refereeId,
      refereeName: referees.name,
      homeCoachId: fixtures.homeCoachId,
      homeCoachName: homeCoach.name,
      awayCoachId: fixtures.awayCoachId,
      awayCoachName: awayCoach.name,
    })
    .from(fixtures)
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .leftJoin(venues, eq(fixtures.venueId, venues.id))
    .leftJoin(referees, eq(fixtures.refereeId, referees.id))
    .leftJoin(homeCoach, eq(fixtures.homeCoachId, homeCoach.id))
    .leftJoin(awayCoach, eq(fixtures.awayCoachId, awayCoach.id))
    .where(and(...conditions))
    .orderBy(asc(fixtures.kickoffAt))
    .limit(limit);

  const fixturesOut: PregameFixtureRow[] = [];
  let ready = 0;
  for (const row of rows) {
    if (!isPregameStatus(row.status)) continue;
    const readiness = evaluatePregameReadiness({
      venueId: row.venueId,
      venueHasCoords: row.venueLatitude != null && row.venueLongitude != null,
      refereeId: row.refereeId,
      homeCoachId: row.homeCoachId,
      awayCoachId: row.awayCoachId,
    });
    if (readiness.ready) ready += 1;
    if (opts?.gapsOnly && readiness.ready) continue;
    fixturesOut.push({
      fixtureId: row.id,
      kickoffAt: row.kickoffAt?.toISOString() ?? "",
      status: row.status,
      competitionName: row.competitionName,
      homeTeamName: row.homeTeamName ?? "Home",
      awayTeamName: row.awayTeamName ?? "Away",
      venueName: row.venueName,
      refereeName: row.refereeName,
      homeCoachName: row.homeCoachName,
      awayCoachName: row.awayCoachName,
      editHref: `/admin/matches/${row.id}/edit`,
      readiness,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    hoursAhead,
    total: rows.length,
    ready,
    notReady: rows.length - ready,
    fixtures: fixturesOut,
  };
}

/** Convenience: fixture ids that fail pre-game checks in the window. */
export async function listPregameGapFixtureIds(opts?: {
  hoursAhead?: number;
  limit?: number;
}): Promise<string[]> {
  const report = await listPregameReadiness({ ...opts, gapsOnly: true });
  return report.fixtures.map((f) => f.fixtureId);
}

export async function getPregameReadinessForFixtureIds(
  fixtureIds: string[],
): Promise<Map<string, PregameReadinessResult>> {
  const out = new Map<string, PregameReadinessResult>();
  if (fixtureIds.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      venueId: fixtures.venueId,
      venueLatitude: venues.latitude,
      venueLongitude: venues.longitude,
      refereeId: fixtures.refereeId,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
    })
    .from(fixtures)
    .leftJoin(venues, eq(fixtures.venueId, venues.id))
    .where(inArray(fixtures.id, fixtureIds));

  for (const row of rows) {
    out.set(
      row.id,
      evaluatePregameReadiness({
        venueId: row.venueId,
        venueHasCoords: row.venueLatitude != null && row.venueLongitude != null,
        refereeId: row.refereeId,
        homeCoachId: row.homeCoachId,
        awayCoachId: row.awayCoachId,
      }),
    );
  }
  return out;
}
