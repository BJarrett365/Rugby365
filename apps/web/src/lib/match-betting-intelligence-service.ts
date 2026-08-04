/**
 * Compose Betting Intelligence for a Match Centre fixture from owned Rugby365 signals.
 */

import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  players,
  teamMatchStats,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import type { MatchDetailPageData } from "./match-detail-service";
import { parseSdmsHeadToHeadRecords } from "./head-to-head-shared";
import { getTeamAvailabilitySummary } from "./player-availability-service";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  buildBetBuilderSuggestions,
  buildBettingSignals,
  buildMatchMarketInsights,
  buildTeamNarrativeInsights,
  buildTeamTrendWindows,
  computeBettingConfidence,
  computeBettingPrediction,
  computePlayerPropRow,
  selectBestValueBets,
  type BettingIntelMathInput,
  type FinishedTeamMatch,
  type InsightEventRow,
  type TeamInsightSeasonContext,
} from "./match-betting-intelligence-math";
import {
  fatigueShare,
  haversineKm,
  internationalQualityShare,
  weightedSquadRating,
} from "./match-betting-intelligence-phase-a";
import type {
  MatchBettingIntelligence,
  PlayerPropRow,
  RefereeBettingIntel,
  VenueBettingIntel,
} from "./match-betting-intelligence-types";
import { getLatestOddsForFixture } from "./match-odds-service";

const FATIGUE_WINDOW_DAYS = 14;

type PhaseAMathFields = Pick<
  BettingIntelMathInput,
  | "isNeutralVenue"
  | "homeIntlShare"
  | "awayIntlShare"
  | "homeFatigueShare"
  | "awayFatigueShare"
  | "homeTravelKm"
  | "awayTravelKm"
  | "kickoffTempC"
  | "homeClimateLat"
  | "awayClimateLat"
>;

async function loadPhaseAMathFields(input: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerIds: string[];
  awayPlayerIds: string[];
  kickoffAt: Date | null;
  matchVenueLat: number | null;
  matchVenueLng: number | null;
  kickoffTempC: number | null;
  fixtureId: string | null;
}): Promise<PhaseAMathFields> {
  const empty: PhaseAMathFields = {
    isNeutralVenue: false,
    homeIntlShare: null,
    awayIntlShare: null,
    homeFatigueShare: null,
    awayFatigueShare: null,
    homeTravelKm: null,
    awayTravelKm: null,
    kickoffTempC: input.kickoffTempC,
    homeClimateLat: null,
    awayClimateLat: null,
  };

  const allPlayerIds = [...new Set([...input.homePlayerIds, ...input.awayPlayerIds])];
  const teamIds = [input.homeTeamId, input.awayTeamId].filter(Boolean) as string[];
  if (!allPlayerIds.length && !teamIds.length && !input.fixtureId) {
    return empty;
  }

  const db = getDb();

  const [playerRows, teamRows, fixtureMeta, fatiguedRows] = await Promise.all([
    allPlayerIds.length
      ? db
          .select({
            id: players.id,
            internationalTeamId: players.internationalTeamId,
          })
          .from(players)
          .where(inArray(players.id, allPlayerIds))
      : Promise.resolve([] as Array<{ id: string; internationalTeamId: string | null }>),
    teamIds.length
      ? db
          .select({
            id: teams.id,
            homeVenueId: teams.homeVenueId,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : Promise.resolve([] as Array<{ id: string; homeVenueId: string | null }>),
    input.fixtureId
      ? db
          .select({ isNeutralVenue: fixtures.isNeutralVenue })
          .from(fixtures)
          .where(eq(fixtures.id, input.fixtureId))
          .limit(1)
      : Promise.resolve([] as Array<{ isNeutralVenue: boolean }>),
    allPlayerIds.length && input.kickoffAt
      ? db
          .select({
            playerId: fixturePlayers.playerId,
          })
          .from(fixturePlayers)
          .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
          .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
          .where(
            and(
              inArray(fixturePlayers.playerId, allPlayerIds),
              inArray(competitions.competitionType, ["international", "world_cup"]),
              sql`${fixtures.kickoffAt} is not null`,
              gte(
                fixtures.kickoffAt,
                new Date(
                  input.kickoffAt.getTime() - FATIGUE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
                ),
              ),
              lt(fixtures.kickoffAt, input.kickoffAt),
            ),
          )
      : Promise.resolve([] as Array<{ playerId: string }>),
  ]);

  const intlByPlayer = new Map(playerRows.map((p) => [p.id, Boolean(p.internationalTeamId)]));
  const homeIntlShare = internationalQualityShare(
    input.homePlayerIds.map((id) => ({
      hasInternationalLink: intlByPlayer.get(id) ?? false,
    })),
  );
  const awayIntlShare = internationalQualityShare(
    input.awayPlayerIds.map((id) => ({
      hasInternationalLink: intlByPlayer.get(id) ?? false,
    })),
  );

  const fatigued = new Set(fatiguedRows.map((r) => r.playerId));
  const homeFatigueShare = fatigueShare(input.homePlayerIds, fatigued);
  const awayFatigueShare = fatigueShare(input.awayPlayerIds, fatigued);

  const homeVenueIds = teamRows.map((t) => t.homeVenueId).filter(Boolean) as string[];
  const venueRows = homeVenueIds.length
    ? await db
        .select({
          id: venues.id,
          latitude: venues.latitude,
          longitude: venues.longitude,
        })
        .from(venues)
        .where(inArray(venues.id, homeVenueIds))
    : [];
  const venueById = new Map(venueRows.map((v) => [v.id, v]));

  let homeTravelKm: number | null = null;
  let awayTravelKm: number | null = null;
  let homeClimateLat: number | null = null;
  let awayClimateLat: number | null = null;
  const matchLat = input.matchVenueLat;
  const matchLng = input.matchVenueLng;

  for (const t of teamRows) {
    if (!t.homeVenueId) continue;
    const hv = venueById.get(t.homeVenueId);
    if (!hv || hv.latitude == null || hv.longitude == null) continue;
    if (t.id === input.homeTeamId) homeClimateLat = hv.latitude;
    if (t.id === input.awayTeamId) awayClimateLat = hv.latitude;
    if (matchLat == null || matchLng == null) continue;
    const km = haversineKm(hv.latitude, hv.longitude, matchLat, matchLng);
    if (t.id === input.homeTeamId) homeTravelKm = km;
    if (t.id === input.awayTeamId) awayTravelKm = km;
  }

  return {
    isNeutralVenue: Boolean(fixtureMeta[0]?.isNeutralVenue),
    homeIntlShare,
    awayIntlShare,
    homeFatigueShare,
    awayFatigueShare,
    homeTravelKm,
    awayTravelKm,
    kickoffTempC: input.kickoffTempC,
    homeClimateLat,
    awayClimateLat,
  };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weatherHarsh(
  weather: MatchDetailPageData["venue"] extends { weather?: infer W } | null ? W : never,
): boolean {
  if (!weather) return false;
  const label = weather.conditionLabel ?? "";
  if (/rain|wind|storm|snow|gale|wet|thunder/i.test(label)) return true;
  if ((weather.precipitationMm ?? 0) >= 2) return true;
  if ((weather.windSpeedKmh ?? 0) >= 35) return true;
  return false;
}

function coachRatingNumber(rating: MatchDetailPageData["homeCoach"]): number | null {
  const r = rating?.rating;
  if (!r) return null;
  const n = Number(r.rating);
  return Number.isFinite(n) ? n : null;
}

async function loadTeamFinishedMatches(teamId: string): Promise<FinishedTeamMatch[]> {
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
      halfTimeHome: fixtures.halfTimeHome,
      halfTimeAway: fixtures.halfTimeAway,
      tries: teamMatchStats.tries,
      metres: teamMatchStats.metres,
      statsTeamId: teamMatchStats.teamId,
    })
    .from(fixtures)
    .leftJoin(
      teamMatchStats,
      and(eq(teamMatchStats.fixtureId, fixtures.id), eq(teamMatchStats.teamId, teamId)),
    )
    .where(or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(40);

  const out: FinishedTeamMatch[] = [];
  for (const f of rows) {
    if (!isFixtureRatingsPublished(f.status)) continue;
    if (f.homeScore == null || f.awayScore == null) continue;
    if (!f.homeTeamId || !f.awayTeamId) continue;
    const isHome = f.homeTeamId === teamId;
    const htFor =
      f.halfTimeHome != null && f.halfTimeAway != null
        ? isHome
          ? f.halfTimeHome
          : f.halfTimeAway
        : null;
    const htAgainst =
      f.halfTimeHome != null && f.halfTimeAway != null
        ? isHome
          ? f.halfTimeAway
          : f.halfTimeHome
        : null;
    out.push({
      kickoffAt: f.kickoffAt,
      isHome,
      pointsFor: isHome ? f.homeScore : f.awayScore,
      pointsAgainst: isHome ? f.awayScore : f.homeScore,
      triesFor: f.tries ?? null,
      dayOfWeek: f.kickoffAt ? f.kickoffAt.getUTCDay() : null,
      wetWeather: false,
      fixtureId: f.id,
      metresFor: f.metres ?? null,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      halfTimeFor: htFor,
      halfTimeAgainst: htAgainst,
    });
  }
  return out;
}

async function loadInsightEventsForFixtures(fixtureIds: string[]): Promise<InsightEventRow[]> {
  const unique = [...new Set(fixtureIds.filter(Boolean))];
  if (!unique.length) return [];
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      eventType: matchEvents.eventType,
      minute: matchEvents.minute,
      second: matchEvents.second,
      sequenceNo: matchEvents.sequenceNo,
      teamId: matchEvents.teamId,
      playerId: matchEvents.playerId,
      payload: matchEvents.payload,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, unique));

  return rows.map((r) => ({
    fixtureId: r.fixtureId,
    eventType: (r.eventType ?? "").toLowerCase(),
    minute: r.minute ?? 0,
    second: r.second ?? null,
    sequenceNo: r.sequenceNo ?? null,
    teamId: r.teamId ?? null,
    playerId: r.playerId ?? null,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
  }));
}

async function loadTeamSeasonInsightContext(input: {
  teamId: string;
  teamName: string;
  venueHome: boolean;
  seasonId: string | null;
}): Promise<TeamInsightSeasonContext> {
  const db = getDb();
  const seasonFilter = input.seasonId
    ? and(eq(fixturePlayers.teamId, input.teamId), eq(fixtures.seasonId, input.seasonId))
    : eq(fixturePlayers.teamId, input.teamId);

  const tryRowsRaw = await db
    .select({
      playerId: fixturePlayers.playerId,
      playerName: players.name,
      tries: sql<number>`coalesce(sum(${fixturePlayers.tries}), 0)::int`,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(seasonFilter)
    .groupBy(fixturePlayers.playerId, players.name);
  const tryRows = [...tryRowsRaw].sort((a, b) => b.tries - a.tries).slice(0, 5);

  const metreRows = await db
    .select({
      metres: sql<number>`coalesce(sum(${teamMatchStats.metres}), 0)::int`,
      matches: sql<number>`count(*)::int`,
    })
    .from(teamMatchStats)
    .where(
      input.seasonId
        ? and(eq(teamMatchStats.teamId, input.teamId), eq(teamMatchStats.seasonId, input.seasonId))
        : eq(teamMatchStats.teamId, input.teamId),
    );

  const metresTotal = metreRows[0]?.metres ?? 0;
  const metresMatches = metreRows[0]?.matches ?? 0;

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    venueHome: input.venueHome,
    topTryScorers: tryRows
      .filter((r) => r.tries > 0)
      .map((r) => ({ playerName: r.playerName, tries: r.tries })),
    seasonMetresTotal: metresMatches > 0 ? metresTotal : null,
    seasonMetresMatches: metresMatches,
  };
}

async function loadRefereeIntel(
  referee: MatchDetailPageData["referee"],
): Promise<RefereeBettingIntel | null> {
  if (!referee?.id && !referee?.name) {
    return referee
      ? {
          name: referee.name,
          slug: referee.slug,
          ratingLabel: referee.rating?.ratingLabel ?? null,
          matchesSampled: 0,
          avgPenalties: null,
          avgYellowCards: null,
          avgRedCards: null,
          homeWinPct: null,
          awayWinPct: null,
          avgTotalPoints: null,
          avgTotalTries: null,
        }
      : null;
  }

  const db = getDb();
  const fixtureRows = referee.id
    ? await db
        .select({
          id: fixtures.id,
          status: fixtures.status,
          homeScore: fixtures.homeScore,
          awayScore: fixtures.awayScore,
        })
        .from(fixtures)
        .where(eq(fixtures.refereeId, referee.id))
        .orderBy(desc(fixtures.kickoffAt))
        .limit(60)
    : [];

  const finished = fixtureRows.filter(
    (f) =>
      isFixtureRatingsPublished(f.status) &&
      f.homeScore != null &&
      f.awayScore != null,
  );
  const fixtureIds = finished.map((f) => f.id);

  let yellow = 0;
  let red = 0;
  let penalties = 0;
  if (fixtureIds.length) {
    const events = await db
      .select({
        fixtureId: matchEvents.fixtureId,
        eventType: matchEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(matchEvents)
      .where(inArray(matchEvents.fixtureId, fixtureIds))
      .groupBy(matchEvents.fixtureId, matchEvents.eventType);

    for (const e of events) {
      const t = (e.eventType ?? "").toLowerCase();
      if (t.includes("yellow")) yellow += e.count;
      else if (t.includes("red")) red += e.count;
      else if (t.includes("penalt")) penalties += e.count;
    }
  }

  let triesSum = 0;
  let triesN = 0;
  if (fixtureIds.length) {
    const tryRows = await db
      .select({
        fixtureId: teamMatchStats.fixtureId,
        tries: teamMatchStats.tries,
      })
      .from(teamMatchStats)
      .where(inArray(teamMatchStats.fixtureId, fixtureIds));
    const byFix = new Map<string, number>();
    for (const row of tryRows) {
      byFix.set(row.fixtureId, (byFix.get(row.fixtureId) ?? 0) + (row.tries ?? 0));
    }
    for (const total of byFix.values()) {
      triesSum += total;
      triesN += 1;
    }
  }

  const n = finished.length;
  const homeWins = finished.filter((f) => f.homeScore! > f.awayScore!).length;
  const awayWins = finished.filter((f) => f.awayScore! > f.homeScore!).length;
  const totalPoints = finished.map((f) => f.homeScore! + f.awayScore!);

  return {
    name: referee.name,
    slug: referee.slug,
    ratingLabel: referee.rating?.ratingLabel ?? null,
    matchesSampled: n,
    avgPenalties: n > 0 ? round1(penalties / n) : null,
    avgYellowCards: n > 0 ? round1(yellow / n) : null,
    avgRedCards: n > 0 ? round1(red / n) : null,
    homeWinPct: n > 0 ? Math.round((homeWins / n) * 100) : null,
    awayWinPct: n > 0 ? Math.round((awayWins / n) * 100) : null,
    avgTotalPoints: avg(totalPoints) != null ? round1(avg(totalPoints)!) : null,
    avgTotalTries: triesN > 0 ? round1(triesSum / triesN) : null,
  };
}

async function loadVenueIntel(
  venue: MatchDetailPageData["venue"],
): Promise<VenueBettingIntel | null> {
  if (!venue) return null;
  const db = getDb();

  const fixtureRows = venue.id
    ? await db
        .select({
          id: fixtures.id,
          status: fixtures.status,
          homeScore: fixtures.homeScore,
          awayScore: fixtures.awayScore,
        })
        .from(fixtures)
        .where(eq(fixtures.venueId, venue.id))
        .orderBy(desc(fixtures.kickoffAt))
        .limit(60)
    : [];

  const finished = fixtureRows.filter(
    (f) =>
      isFixtureRatingsPublished(f.status) &&
      f.homeScore != null &&
      f.awayScore != null,
  );
  const n = finished.length;
  const homeWins = finished.filter((f) => f.homeScore! > f.awayScore!).length;
  const homeScores = finished.map((f) => f.homeScore!);
  const awayScores = finished.map((f) => f.awayScore!);
  const totals = finished.map((f) => f.homeScore! + f.awayScore!);

  let avgTotalTries: number | null = null;
  if (finished.length) {
    const tryRows = await db
      .select({
        fixtureId: teamMatchStats.fixtureId,
        tries: teamMatchStats.tries,
      })
      .from(teamMatchStats)
      .where(
        inArray(
          teamMatchStats.fixtureId,
          finished.map((f) => f.id),
        ),
      );
    const byFix = new Map<string, number>();
    for (const row of tryRows) {
      byFix.set(row.fixtureId, (byFix.get(row.fixtureId) ?? 0) + (row.tries ?? 0));
    }
    if (byFix.size) {
      avgTotalTries = round1(
        [...byFix.values()].reduce((a, b) => a + b, 0) / byFix.size,
      );
    }
  }

  return {
    name: venue.name,
    city: venue.city ?? null,
    weatherLabel: venue.weather?.conditionLabel ?? null,
    isHomeAdvantage: true,
    matchesSampled: n,
    homeWinPct: n > 0 ? Math.round((homeWins / n) * 100) : null,
    avgHomeScore: avg(homeScores) != null ? round1(avg(homeScores)!) : null,
    avgAwayScore: avg(awayScores) != null ? round1(avg(awayScores)!) : null,
    avgTotalPoints: avg(totals) != null ? round1(avg(totals)!) : null,
    avgTotalTries,
    altitudeM: null,
  };
}

async function loadPlayerPropSamples(
  playerIds: string[],
): Promise<
  Map<
    string,
    {
      sampleMatches: number;
      tryRate: number;
      avgTackles: number;
      avgCarries: number;
      avgMetres: number;
      avgLineBreaks: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      sampleMatches: number;
      tryRate: number;
      avgTackles: number;
      avgCarries: number;
      avgMetres: number;
      avgLineBreaks: number;
    }
  >();
  if (!playerIds.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchPerformanceStats.playerId,
      tries: playerMatchPerformanceStats.tries,
      tacklesMade: playerMatchPerformanceStats.tacklesMade,
      carries: playerMatchPerformanceStats.carries,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(fixtures, eq(playerMatchPerformanceStats.fixtureId, fixtures.id))
    .where(inArray(playerMatchPerformanceStats.playerId, playerIds))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(Math.min(playerIds.length * 12, 400));

  const buckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = buckets.get(row.playerId) ?? [];
    if (list.length >= 10) continue;
    list.push(row);
    buckets.set(row.playerId, list);
  }

  for (const [playerId, list] of buckets) {
    const n = list.length;
    if (!n) continue;
    map.set(playerId, {
      sampleMatches: n,
      tryRate: list.reduce((s, r) => s + (r.tries ?? 0), 0) / n,
      avgTackles: list.reduce((s, r) => s + (r.tacklesMade ?? 0), 0) / n,
      avgCarries: list.reduce((s, r) => s + (r.carries ?? 0), 0) / n,
      avgMetres: list.reduce((s, r) => s + (r.metresCarried ?? 0), 0) / n,
      avgLineBreaks: list.reduce((s, r) => s + (r.lineBreaks ?? 0), 0) / n,
    });
  }
  return map;
}

export async function buildMatchBettingIntelligence(
  data: MatchDetailPageData,
): Promise<MatchBettingIntelligence> {
  const { detail, entities, matchRatings, venue, referee, homeCoach, awayCoach, cmsFixture } =
    data;
  const homeName = detail.home_team_name;
  const awayName = detail.away_team_name;

  const homeTeamId = entities.homeTeam?.id ?? null;
  const awayTeamId = entities.awayTeam?.id ?? null;

  const seasonId = cmsFixture?.seasonId ?? null;

  const [homeAvail, awayAvail, homeMatches, awayMatches, refereeIntel, venueIntel] =
    await Promise.all([
      homeTeamId ? getTeamAvailabilitySummary(homeTeamId) : Promise.resolve(null),
      awayTeamId ? getTeamAvailabilitySummary(awayTeamId) : Promise.resolve(null),
      homeTeamId ? loadTeamFinishedMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? loadTeamFinishedMatches(awayTeamId) : Promise.resolve([]),
      loadRefereeIntel(referee),
      loadVenueIntel(venue),
    ]);

  const insightFixtureIds = [
    ...homeMatches.map((m) => m.fixtureId).filter(Boolean),
    ...awayMatches.map((m) => m.fixtureId).filter(Boolean),
  ] as string[];
  const [insightEvents, homeSeasonCtx, awaySeasonCtx] = await Promise.all([
    loadInsightEventsForFixtures(insightFixtureIds),
    homeTeamId
      ? loadTeamSeasonInsightContext({
          teamId: homeTeamId,
          teamName: homeName,
          venueHome: true,
          seasonId,
        })
      : Promise.resolve(null),
    awayTeamId
      ? loadTeamSeasonInsightContext({
          teamId: awayTeamId,
          teamName: awayName,
          venueHome: false,
          seasonId,
        })
      : Promise.resolve(null),
  ]);

  const fixtureSeed =
    cmsFixture?.id ??
    (detail as { match_id?: string }).match_id ??
    `${homeName}-${awayName}-${detail.date ?? ""}`;
  const narrativeInsights = {
    home: homeSeasonCtx
      ? buildTeamNarrativeInsights({
          matches: homeMatches,
          events: insightEvents,
          season: homeSeasonCtx,
          varietySeed: `${fixtureSeed}:home:${homeTeamId ?? homeName}`,
          limit: 10,
        })
      : [],
    away: awaySeasonCtx
      ? buildTeamNarrativeInsights({
          matches: awayMatches,
          events: insightEvents,
          season: awaySeasonCtx,
          varietySeed: `${fixtureSeed}:away:${awayTeamId ?? awayName}`,
          limit: 10,
        })
      : [],
  };

  const homeUnavailable =
    (homeAvail?.currentInjuries.length ?? 0) + (homeAvail?.currentSuspensions.length ?? 0);
  const awayUnavailable =
    (awayAvail?.currentInjuries.length ?? 0) + (awayAvail?.currentSuspensions.length ?? 0);

  const notableAbsences: MatchBettingIntelligence["availability"]["notableAbsences"] = [];
  for (const row of homeAvail?.currentInjuries.slice(0, 4) ?? []) {
    notableAbsences.push({
      side: "home",
      playerName: row.playerName,
      reason: row.status?.replace(/_/g, " ") || "injured",
    });
  }
  for (const row of homeAvail?.currentSuspensions.slice(0, 2) ?? []) {
    notableAbsences.push({
      side: "home",
      playerName: row.playerName,
      reason: "suspended",
    });
  }
  for (const row of awayAvail?.currentInjuries.slice(0, 4) ?? []) {
    notableAbsences.push({
      side: "away",
      playerName: row.playerName,
      reason: row.status?.replace(/_/g, " ") || "injured",
    });
  }
  for (const row of awayAvail?.currentSuspensions.slice(0, 2) ?? []) {
    notableAbsences.push({
      side: "away",
      playerName: row.playerName,
      reason: "suspended",
    });
  }

  const homeSquadRows = matchRatings.filter((r) => r.teamId === homeTeamId);
  const awaySquadRows = matchRatings.filter((r) => r.teamId === awayTeamId);
  const homeAvgRating = weightedSquadRating(homeSquadRows);
  const awayAvgRating = weightedSquadRating(awaySquadRows);
  const homePlayerIds = homeSquadRows.map((r) => r.playerId).filter(Boolean);
  const awayPlayerIds = awaySquadRows.map((r) => r.playerId).filter(Boolean);

  const kickoffDate = data.kickoffAt ? new Date(data.kickoffAt) : null;
  const phaseA = await loadPhaseAMathFields({
    homeTeamId,
    awayTeamId,
    homePlayerIds,
    awayPlayerIds,
    kickoffAt:
      kickoffDate && Number.isFinite(kickoffDate.getTime()) ? kickoffDate : null,
    matchVenueLat: venue?.latitude ?? null,
    matchVenueLng: venue?.longitude ?? null,
    kickoffTempC: venue?.weather?.temperatureC ?? null,
    fixtureId: cmsFixture?.id ?? null,
  });

  const h2hRecords = parseSdmsHeadToHeadRecords(
    Array.isArray(detail.head_to_head) ? detail.head_to_head : [],
  );
  const overall = h2hRecords.find((r) => /overall|all/i.test(r.competitionName)) ?? h2hRecords[0];
  const h2hHomeWins = overall?.homeWins ?? 0;
  const h2hAwayWins = overall?.awayWins ?? 0;
  const h2hDraws = overall?.draws ?? 0;

  const homeL5 = homeMatches.slice(0, 5);
  const awayL5 = awayMatches.slice(0, 5);
  const homeFormWins = homeL5.filter((m) => m.pointsFor > m.pointsAgainst).length;
  const awayFormWins = awayL5.filter((m) => m.pointsFor > m.pointsAgainst).length;

  const mathInput: BettingIntelMathInput = {
    homeName,
    awayName,
    homeAvgRating,
    awayAvgRating,
    homeFormWins,
    homeFormPlayed: homeL5.length,
    awayFormWins,
    awayFormPlayed: awayL5.length,
    h2hHomeWins,
    h2hAwayWins,
    h2hDraws,
    homeUnavailable,
    awayUnavailable,
    homeCoachRating: coachRatingNumber(homeCoach),
    awayCoachRating: coachRatingNumber(awayCoach),
    hasHomeVenue: Boolean(venue?.name),
    weatherHarsh: weatherHarsh(venue?.weather ?? null),
    ...phaseA,
  };

  const signals = buildBettingSignals(mathInput);
  const prediction = computeBettingPrediction(mathInput, signals);
  const confidence = computeBettingConfidence({
    signalCount: signals.length,
    hasRatings: mathInput.homeAvgRating != null || mathInput.awayAvgRating != null,
    hasH2h: h2hHomeWins + h2hAwayWins + h2hDraws > 0,
    hasAvailability: homeUnavailable + awayUnavailable > 0,
    predictionConfidencePct: prediction.confidencePct,
  });
  const marketInsights = buildMatchMarketInsights({
    homeName,
    awayName,
    prediction,
    homeMatches,
    awayMatches,
    varietySeed: fixtureSeed,
  });

  const leanName =
    prediction.lean === "home"
      ? homeName
      : prediction.lean === "away"
        ? awayName
        : prediction.lean === "draw"
          ? "a draw"
          : "a tight contest";

  const topSignals = signals.filter((s) => s.side !== "neutral").slice(0, 6);

  const propCandidates = matchRatings.filter((r) => {
    if (!r.playerId) return false;
    if (!(r.squadRole === "starter" || r.jerseyNumber != null)) return false;
    if (!r.teamId) return false;
    if (homeTeamId && r.teamId === homeTeamId) return true;
    if (awayTeamId && r.teamId === awayTeamId) return true;
    return false;
  });
  const propPlayerIds = propCandidates.map((r) => r.playerId);
  const propSamples = await loadPlayerPropSamples(propPlayerIds);

  const buildProp = (r: (typeof propCandidates)[number], side: "home" | "away"): PlayerPropRow => {
    const sample = propSamples.get(r.playerId);
    return computePlayerPropRow({
      playerId: r.playerId,
      playerName: r.playerName,
      teamSide: side,
      positionName: r.positionName,
      jerseyNumber: r.jerseyNumber,
      careerRating: r.careerRating,
      formRating: r.formRating,
      squadRole: r.squadRole,
      tryRate: sample?.tryRate ?? null,
      sampleMatches: sample?.sampleMatches ?? 0,
      avgTackles: sample?.avgTackles ?? null,
      avgCarries: sample?.avgCarries ?? null,
      avgMetres: sample?.avgMetres ?? null,
      avgLineBreaks: sample?.avgLineBreaks ?? null,
      teamExpectedTries:
        side === "home" ? prediction.expectedHomeTries : prediction.expectedAwayTries,
      teamWinPct: side === "home" ? prediction.homeWinPct : prediction.awayWinPct,
    });
  };

  // Keep both sides visible — do not let a large home XV crowd out away props.
  const perSideLimit = 12;
  const homePropRows = propCandidates
    .filter((r) => homeTeamId && r.teamId === homeTeamId)
    .map((r) => buildProp(r, "home"))
    .sort((a, b) => b.tryPct - a.tryPct)
    .slice(0, perSideLimit);
  const awayPropRows = propCandidates
    .filter((r) => awayTeamId && r.teamId === awayTeamId)
    .map((r) => buildProp(r, "away"))
    .sort((a, b) => b.tryPct - a.tryPct)
    .slice(0, perSideLimit);
  const playerProps: PlayerPropRow[] = [...homePropRows, ...awayPropRows].sort(
    (a, b) => b.tryPct - a.tryPct,
  );

  const topTryScorer = playerProps[0] ?? null;
  const betBuilder = buildBetBuilderSuggestions({
    homeName,
    awayName,
    prediction,
    signals,
    topTryScorer,
  });

  const oddsRow = cmsFixture?.id ? await getLatestOddsForFixture(cmsFixture.id) : null;
  const odds = oddsRow
    ? {
        sourceUrl: oddsRow.sourceUrl,
        provider: oddsRow.provider,
        scrapedAt: oddsRow.scrapedAt?.toISOString() ?? null,
        bookmakerCount: oddsRow.bookmakerCount,
        bestHomeDecimal: oddsRow.bestHomeDecimal,
        bestDrawDecimal: oddsRow.bestDrawDecimal,
        bestAwayDecimal: oddsRow.bestAwayDecimal,
        impliedHomePct:
          oddsRow.impliedHome != null ? Math.round(oddsRow.impliedHome * 1000) / 10 : null,
        impliedDrawPct:
          oddsRow.impliedDraw != null ? Math.round(oddsRow.impliedDraw * 1000) / 10 : null,
        impliedAwayPct:
          oddsRow.impliedAway != null ? Math.round(oddsRow.impliedAway * 1000) / 10 : null,
      }
    : null;

  const valueBets = selectBestValueBets({
    homeName,
    awayName,
    prediction,
    signals,
    topTryScorer,
    odds,
    limit: 5,
  });

  const confidenceWithMarket =
    odds != null
      ? {
          ...confidence,
          marketConfidence: Math.round(
            55 +
              (odds.bookmakerCount > 5 ? 15 : odds.bookmakerCount * 2) +
              (valueBets.some((v) => v.label === "VALUE") ? 10 : 0),
          ),
        }
      : confidence;

  return {
    fixtureId: cmsFixture?.id ?? null,
    homeName,
    awayName,
    homeImageUrl: entities.homeTeam?.imageUrl ?? detail.home_team_icon ?? null,
    awayImageUrl: entities.awayTeam?.imageUrl ?? detail.away_team_icon ?? null,
    prediction,
    signals,
    insights: narrativeInsights,
    marketInsights,
    whyTitle:
      prediction.lean === "uncertain"
        ? "Why Planet Rugby sees this as tight"
        : `Why Planet Rugby likes ${leanName}`,
    whyLead:
      topSignals.length > 0
        ? topSignals.map((s) => s.label).join(" · ")
        : "Built from Rugby365 ratings, form, H2H, availability and venue context.",
    confidence: confidenceWithMarket,
    availability: {
      homeUnavailable,
      awayUnavailable,
      notableAbsences,
    },
    trends: {
      home: {
        teamName: homeName,
        side: "home",
        windows: buildTeamTrendWindows(homeMatches),
      },
      away: {
        teamName: awayName,
        side: "away",
        windows: buildTeamTrendWindows(awayMatches),
      },
    },
    referee: refereeIntel,
    venue: venueIntel,
    h2h: {
      homeWins: h2hHomeWins,
      awayWins: h2hAwayWins,
      draws: h2hDraws,
      meetingsSampled: h2hHomeWins + h2hAwayWins + h2hDraws,
    },
    playerProps,
    betBuilder,
    odds,
    valueBets,
    comingSoon:
      odds == null
        ? [
            {
              id: "odds",
              title: "Bookmaker prices",
              blurb:
                "Optional: import from /admin/odds/bmbets and link this fixture to compare Planet Rugby % vs market edge.",
            },
          ]
        : [],
  };
}
