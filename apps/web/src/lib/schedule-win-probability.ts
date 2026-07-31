/**
 * Lightweight Betting Intelligence win % for the public fixtures board.
 * Same model as Match Centre — form + home edge only (no full match payload).
 */
import "server-only";
import { and, desc, inArray, or, sql } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "./db";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  buildBettingSignals,
  computeBettingPrediction,
  type BettingIntelMathInput,
  type FinishedTeamMatch,
} from "./match-betting-intelligence-math";
import type { ScheduleFixture, ScheduleWinProbability } from "./match-schedule-utils";

type FormMatch = FinishedTeamMatch & { fixtureId: string };

async function loadFinishedFormByTeamIds(
  teamIds: string[],
): Promise<Map<string, FormMatch[]>> {
  const out = new Map<string, FormMatch[]>();
  if (!teamIds.length) return out;

  const db = getDb();
  // Keep this cheap for the public schedule path — no stats join.
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

function predictionForPair(
  homeName: string,
  awayName: string,
  homeMatches: FinishedTeamMatch[],
  awayMatches: FinishedTeamMatch[],
  hasHomeVenue: boolean,
): ScheduleWinProbability {
  const homeL5 = homeMatches.slice(0, 5);
  const awayL5 = awayMatches.slice(0, 5);
  const input: BettingIntelMathInput = {
    homeName,
    awayName,
    homeAvgRating: null,
    awayAvgRating: null,
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
    hasHomeVenue,
    weatherHarsh: false,
  };
  const signals = buildBettingSignals(input);
  const prediction = computeBettingPrediction(input, signals);
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

  let formByTeam: Map<string, FormMatch[]>;
  try {
    formByTeam = await loadFinishedFormByTeamIds(teamIds);
  } catch {
    return fixturesList;
  }

  const byId = new Map<string, ScheduleWinProbability>();
  for (const f of candidates) {
    const homeId = f.homeTeam!.id!;
    const awayId = f.awayTeam!.id!;
    byId.set(
      f.id,
      predictionForPair(
        f.homeTeam?.name ?? "Home",
        f.awayTeam?.name ?? "Away",
        formBeforeFixture(formByTeam.get(homeId) ?? [], f.id, f.kickoffAt),
        formBeforeFixture(formByTeam.get(awayId) ?? [], f.id, f.kickoffAt),
        Boolean(f.venue?.trim()) && !f.isNeutralVenue,
      ),
    );
  }

  return fixturesList.map((f) => {
    const winProbability = byId.get(f.id);
    return winProbability ? { ...f, winProbability } : f;
  });
}
