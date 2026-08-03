/**
 * Compose Betting Intelligence for a Match Centre fixture from owned Rugby365 signals.
 */

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "./db";
import type { MatchDetailPageData } from "./match-detail-service";
import { parseSdmsHeadToHeadRecords } from "./head-to-head-shared";
import { getTeamAvailabilitySummary } from "./player-availability-service";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  buildBetBuilderSuggestions,
  buildBettingSignals,
  buildTeamTrendWindows,
  computeBettingConfidence,
  computeBettingPrediction,
  computePlayerPropRow,
  type BettingIntelMathInput,
  type FinishedTeamMatch,
} from "./match-betting-intelligence-math";
import type {
  MatchBettingIntelligence,
  PlayerPropRow,
  RefereeBettingIntel,
  VenueBettingIntel,
} from "./match-betting-intelligence-types";
import { getLatestOddsForFixture } from "./match-odds-service";

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
      tries: teamMatchStats.tries,
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
    const isHome = f.homeTeamId === teamId;
    out.push({
      kickoffAt: f.kickoffAt,
      isHome,
      pointsFor: isHome ? f.homeScore : f.awayScore,
      pointsAgainst: isHome ? f.awayScore : f.homeScore,
      triesFor: f.tries ?? null,
      dayOfWeek: f.kickoffAt ? f.kickoffAt.getUTCDay() : null,
      wetWeather: false,
    });
  }
  return out;
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

  const [homeAvail, awayAvail, homeMatches, awayMatches, refereeIntel, venueIntel] =
    await Promise.all([
      homeTeamId ? getTeamAvailabilitySummary(homeTeamId) : Promise.resolve(null),
      awayTeamId ? getTeamAvailabilitySummary(awayTeamId) : Promise.resolve(null),
      homeTeamId ? loadTeamFinishedMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? loadTeamFinishedMatches(awayTeamId) : Promise.resolve([]),
      loadRefereeIntel(referee),
      loadVenueIntel(venue),
    ]);

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

  const homeRatings = matchRatings
    .filter((r) => r.teamId === homeTeamId && r.careerRating != null)
    .map((r) => r.careerRating!);
  const awayRatings = matchRatings
    .filter((r) => r.teamId === awayTeamId && r.careerRating != null)
    .map((r) => r.careerRating!);

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
    homeAvgRating: avg(homeRatings),
    awayAvgRating: avg(awayRatings),
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

  const leanName =
    prediction.lean === "home"
      ? homeName
      : prediction.lean === "away"
        ? awayName
        : prediction.lean === "draw"
          ? "a draw"
          : "a tight contest";

  const topSignals = signals.filter((s) => s.side !== "neutral").slice(0, 6);

  const propPlayerIds = matchRatings.map((r) => r.playerId).filter(Boolean);
  const propSamples = await loadPlayerPropSamples(propPlayerIds);

  const playerProps: PlayerPropRow[] = matchRatings
    .filter((r) => r.squadRole === "starter" || r.jerseyNumber != null)
    .slice(0, 30)
    .map((r) => {
      const side: "home" | "away" =
        r.teamId && awayTeamId && r.teamId === awayTeamId ? "away" : "home";
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
    })
    .sort((a, b) => b.tryPct - a.tryPct);

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

  const valueBets: MatchBettingIntelligence["valueBets"] = [];
  if (odds?.impliedHomePct != null) {
    const edge = prediction.homeWinPct - odds.impliedHomePct;
    valueBets.push({
      selection: homeName,
      ourPct: prediction.homeWinPct,
      marketPct: odds.impliedHomePct,
      edgePct: Math.round(edge * 10) / 10,
      bestDecimal: odds.bestHomeDecimal,
      label: edge >= 4 ? "VALUE" : edge <= -4 ? "SHORT" : "FAIR",
    });
  }
  if (odds?.impliedAwayPct != null) {
    const edge = prediction.awayWinPct - odds.impliedAwayPct;
    valueBets.push({
      selection: awayName,
      ourPct: prediction.awayWinPct,
      marketPct: odds.impliedAwayPct,
      edgePct: Math.round(edge * 10) / 10,
      bestDecimal: odds.bestAwayDecimal,
      label: edge >= 4 ? "VALUE" : edge <= -4 ? "SHORT" : "FAIR",
    });
  }
  if (odds?.impliedDrawPct != null) {
    const edge = prediction.drawPct - odds.impliedDrawPct;
    valueBets.push({
      selection: "Draw",
      ourPct: prediction.drawPct,
      marketPct: odds.impliedDrawPct,
      edgePct: Math.round(edge * 10) / 10,
      bestDecimal: odds.bestDrawDecimal,
      label: edge >= 4 ? "VALUE" : edge <= -4 ? "SHORT" : "FAIR",
    });
  }

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
              title: "Odds",
              blurb:
                "Import from /admin/odds/bmbets (Currie Cup / competition listing or match URL) and link to this fixture.",
            },
            {
              id: "value",
              title: "Value Bets",
              blurb: "Appears once a winner-market odds snapshot is linked to this match.",
            },
          ]
        : [],
  };
}
