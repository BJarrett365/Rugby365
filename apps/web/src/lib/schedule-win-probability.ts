/**
 * Betting Intelligence win % for the public fixtures board.
 * Same model as Match Centre (v1.1): form + home + squad quality + travel when available.
 */
import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, playerRatings, teams, venues } from "@rugby365/db";
import { getDb } from "./db";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  buildBettingSignals,
  computeBettingPrediction,
  type BettingIntelMathInput,
  type FinishedTeamMatch,
} from "./match-betting-intelligence-math";
import { haversineKm } from "./match-betting-intelligence-phase-a";
import type { ScheduleFixture, ScheduleWinProbability } from "./match-schedule-utils";

type FormMatch = FinishedTeamMatch & { fixtureId: string };

type TeamHomeGeo = {
  latitude: number;
  longitude: number;
};

async function loadFinishedFormByTeamIds(
  teamIds: string[],
): Promise<Map<string, FormMatch[]>> {
  const out = new Map<string, FormMatch[]>();
  if (!teamIds.length) return out;

  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixtures)
    .where(
      and(
        or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds)),
        sql`${fixtures.homeScore} is not null`,
        sql`${fixtures.awayScore} is not null`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(Math.min(500, teamIds.length * 25));

  const push = (teamId: string, match: FormMatch) => {
    const list = out.get(teamId) ?? [];
    if (list.length >= 12) return;
    list.push(match);
    out.set(teamId, list);
  };

  for (const f of rows) {
    if (!isFixtureRatingsPublished(f.status)) continue;
    if (f.homeScore == null || f.awayScore == null) continue;
    if (!f.homeTeamId || !f.awayTeamId) continue;

    if (teamIds.includes(f.homeTeamId)) {
      push(f.homeTeamId, {
        fixtureId: f.id,
        kickoffAt: f.kickoffAt,
        isHome: true,
        pointsFor: f.homeScore,
        pointsAgainst: f.awayScore,
        triesFor: null,
        dayOfWeek: f.kickoffAt ? f.kickoffAt.getUTCDay() : null,
        wetWeather: false,
      });
    }
    if (teamIds.includes(f.awayTeamId)) {
      push(f.awayTeamId, {
        fixtureId: f.id,
        kickoffAt: f.kickoffAt,
        isHome: false,
        pointsFor: f.awayScore,
        pointsAgainst: f.homeScore,
        triesFor: null,
        dayOfWeek: f.kickoffAt ? f.kickoffAt.getUTCDay() : null,
        wetWeather: false,
      });
    }
  }

  return out;
}

/** Avg career rating from recent form fixtures' squads (cheap board path). */
async function loadTeamAvgRatingsFromForm(
  formByTeam: Map<string, FormMatch[]>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const fixtureIds: string[] = [];
  const teamFixturePairs: Array<{ teamId: string; fixtureId: string }> = [];

  for (const [teamId, matches] of formByTeam) {
    for (const m of matches.slice(0, 3)) {
      fixtureIds.push(m.fixtureId);
      teamFixturePairs.push({ teamId, fixtureId: m.fixtureId });
    }
  }
  if (!fixtureIds.length) return out;

  const db = getDb();
  const uniqueFixtureIds = [...new Set(fixtureIds)];
  const rows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      teamId: fixturePlayers.teamId,
      playerRating: playerRatings.playerRating,
    })
    .from(fixturePlayers)
    .innerJoin(playerRatings, eq(fixturePlayers.playerId, playerRatings.playerId))
    .where(inArray(fixturePlayers.fixtureId, uniqueFixtureIds));

  const buckets = new Map<string, number[]>();
  const wanted = new Set(teamFixturePairs.map((p) => `${p.teamId}:${p.fixtureId}`));
  for (const row of rows) {
    if (row.playerRating == null) continue;
    const key = `${row.teamId}:${row.fixtureId}`;
    if (!wanted.has(key)) continue;
    const list = buckets.get(row.teamId) ?? [];
    list.push(row.playerRating);
    buckets.set(row.teamId, list);
  }

  for (const [teamId, ratings] of buckets) {
    if (!ratings.length) continue;
    out.set(teamId, ratings.reduce((a, b) => a + b, 0) / ratings.length);
  }
  return out;
}

async function loadTeamHomeGeo(teamIds: string[]): Promise<Map<string, TeamHomeGeo>> {
  const out = new Map<string, TeamHomeGeo>();
  if (!teamIds.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      teamId: teams.id,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(teams)
    .innerJoin(venues, eq(teams.homeVenueId, venues.id))
    .where(inArray(teams.id, teamIds));

  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue;
    out.set(r.teamId, { latitude: r.latitude, longitude: r.longitude });
  }
  return out;
}

async function loadVenueGeo(
  venueIds: string[],
): Promise<Map<string, TeamHomeGeo>> {
  const out = new Map<string, TeamHomeGeo>();
  if (!venueIds.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      id: venues.id,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(venues)
    .where(inArray(venues.id, venueIds));
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue;
    out.set(r.id, { latitude: r.latitude, longitude: r.longitude });
  }
  return out;
}

/** Form samples before this fixture (never include the match itself). */
function formBeforeFixture(
  matches: FormMatch[],
  fixtureId: string,
  kickoffAt: string | null,
): FinishedTeamMatch[] {
  const kickMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  return matches
    .filter((m) => {
      if (m.fixtureId === fixtureId) return false;
      if (!Number.isFinite(kickMs) || !m.kickoffAt) return true;
      return m.kickoffAt.getTime() < kickMs;
    })
    .slice(0, 5);
}

function predictionForPair(input: {
  homeName: string;
  awayName: string;
  homeMatches: FinishedTeamMatch[];
  awayMatches: FinishedTeamMatch[];
  hasHomeVenue: boolean;
  isNeutralVenue: boolean;
  homeAvgRating: number | null;
  awayAvgRating: number | null;
  homeTravelKm: number | null;
  awayTravelKm: number | null;
  homeClimateLat: number | null;
  awayClimateLat: number | null;
}): ScheduleWinProbability {
  const homeL5 = input.homeMatches.slice(0, 5);
  const awayL5 = input.awayMatches.slice(0, 5);
  const mathInput: BettingIntelMathInput = {
    homeName: input.homeName,
    awayName: input.awayName,
    homeAvgRating: input.homeAvgRating,
    awayAvgRating: input.awayAvgRating,
    homeFormWins: homeL5.filter((m) => m.pointsFor > m.pointsAgainst).length,
    homeFormPlayed: homeL5.length,
    awayFormWins: awayL5.filter((m) => m.pointsFor > m.pointsAgainst).length,
    awayFormPlayed: awayL5.length,
    h2hHomeWins: 0,
    h2hAwayWins: 0,
    h2hDraws: 0,
    homeUnavailable: 0,
    awayUnavailable: 0,
    homeCoachRating: null,
    awayCoachRating: null,
    hasHomeVenue: input.hasHomeVenue,
    weatherHarsh: false,
    isNeutralVenue: input.isNeutralVenue,
    homeTravelKm: input.homeTravelKm,
    awayTravelKm: input.awayTravelKm,
    homeClimateLat: input.homeClimateLat,
    awayClimateLat: input.awayClimateLat,
  };
  const signals = buildBettingSignals(mathInput);
  const prediction = computeBettingPrediction(mathInput, signals);
  return {
    homeWinPct: prediction.homeWinPct,
    drawPct: prediction.drawPct,
    awayWinPct: prediction.awayWinPct,
    lean: prediction.lean,
    confidencePct: prediction.confidencePct,
  };
}

/**
 * Attach Betting Intelligence win probabilities to CMS fixtures
 * (upcoming + finished, so results can show model vs outcome).
 */
export async function enrichScheduleFixturesWithWinProbability(
  fixturesList: ScheduleFixture[],
): Promise<ScheduleFixture[]> {
  const candidates = fixturesList.filter(
    (f) => f.source === "db" && f.homeTeam?.id && f.awayTeam?.id,
  );
  if (!candidates.length) return fixturesList;

  const teamIds = [
    ...new Set(
      candidates.flatMap((f) => [f.homeTeam!.id!, f.awayTeam!.id!]).filter(Boolean),
    ),
  ];
  const venueIds = [
    ...new Set(candidates.map((f) => f.venueId).filter(Boolean) as string[]),
  ];

  let formByTeam: Map<string, FormMatch[]>;
  let ratingByTeam: Map<string, number>;
  let homeGeoByTeam: Map<string, TeamHomeGeo>;
  let venueGeo: Map<string, TeamHomeGeo>;
  try {
    formByTeam = await loadFinishedFormByTeamIds(teamIds);
    [ratingByTeam, homeGeoByTeam, venueGeo] = await Promise.all([
      loadTeamAvgRatingsFromForm(formByTeam),
      loadTeamHomeGeo(teamIds),
      loadVenueGeo(venueIds),
    ]);
  } catch {
    return fixturesList;
  }

  const byId = new Map<string, ScheduleWinProbability>();
  for (const f of candidates) {
    const homeId = f.homeTeam!.id!;
    const awayId = f.awayTeam!.id!;
    const matchGeo = f.venueId ? venueGeo.get(f.venueId) : undefined;
    const homeGeo = homeGeoByTeam.get(homeId);
    const awayGeo = homeGeoByTeam.get(awayId);

    let homeTravelKm: number | null = null;
    let awayTravelKm: number | null = null;
    if (matchGeo && homeGeo) {
      homeTravelKm = haversineKm(
        homeGeo.latitude,
        homeGeo.longitude,
        matchGeo.latitude,
        matchGeo.longitude,
      );
    }
    if (matchGeo && awayGeo) {
      awayTravelKm = haversineKm(
        awayGeo.latitude,
        awayGeo.longitude,
        matchGeo.latitude,
        matchGeo.longitude,
      );
    }

    byId.set(
      f.id,
      predictionForPair({
        homeName: f.homeTeam?.name ?? "Home",
        awayName: f.awayTeam?.name ?? "Away",
        homeMatches: formBeforeFixture(formByTeam.get(homeId) ?? [], f.id, f.kickoffAt),
        awayMatches: formBeforeFixture(formByTeam.get(awayId) ?? [], f.id, f.kickoffAt),
        hasHomeVenue: Boolean(f.venue?.trim()) && !f.isNeutralVenue,
        isNeutralVenue: Boolean(f.isNeutralVenue),
        homeAvgRating: ratingByTeam.get(homeId) ?? null,
        awayAvgRating: ratingByTeam.get(awayId) ?? null,
        homeTravelKm,
        awayTravelKm,
        homeClimateLat: homeGeo?.latitude ?? null,
        awayClimateLat: awayGeo?.latitude ?? null,
      }),
    );
  }

  return fixturesList.map((f) => {
    const winProbability = byId.get(f.id);
    return winProbability ? { ...f, winProbability } : f;
  });
}
