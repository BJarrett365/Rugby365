import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { fixtures, matchEvents, teamMatchStats } from "@rugby365/db";
import { getDb } from "./db";
import { computeMatchBonusPoints, type MatchBonusPoints } from "./match-bonus-points";
import { getScoringRulesForCompetition } from "./table-lab/competition-scoring-rules";

const COMPLETED = ["full_time", "completed", "ft", "final", "result"] as const;

async function resolveSideTries(
  fixtureId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
): Promise<{ homeTries: number | null; awayTries: number | null }> {
  const db = getDb();
  const stats = await db
    .select({ side: teamMatchStats.side, tries: teamMatchStats.tries })
    .from(teamMatchStats)
    .where(eq(teamMatchStats.fixtureId, fixtureId));

  let homeTries = stats.find((r) => r.side === "home")?.tries ?? null;
  let awayTries = stats.find((r) => r.side === "away")?.tries ?? null;

  if (homeTries != null && awayTries != null) {
    return { homeTries, awayTries };
  }

  const tryEvents = await db
    .select({ teamId: matchEvents.teamId, eventType: matchEvents.eventType })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));

  let homeFromEvents = 0;
  let awayFromEvents = 0;
  let counted = 0;
  for (const ev of tryEvents) {
    // Tries + penalty tries count toward the 4-try bonus threshold.
    if (!/\btry\b|penalty_try|penalty[\s_-]?try/i.test(ev.eventType)) continue;
    counted += 1;
    if (homeTeamId && ev.teamId === homeTeamId) homeFromEvents += 1;
    else if (awayTeamId && ev.teamId === awayTeamId) awayFromEvents += 1;
  }

  if (counted > 0) {
    return {
      homeTries: homeTries ?? homeFromEvents,
      awayTries: awayTries ?? awayFromEvents,
    };
  }

  return { homeTries, awayTries };
}

/** Compute bonus points for a fixture and optionally persist them. */
export async function computeAndStoreFixtureBonusPoints(
  fixtureId: string,
  opts?: { persist?: boolean },
): Promise<MatchBonusPoints | null> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return null;

  const { homeTries, awayTries } = await resolveSideTries(
    fixtureId,
    fixture.homeTeamId,
    fixture.awayTeamId,
  );
  const rules = await getScoringRulesForCompetition(fixture.competitionId ?? undefined);
  const bonus = computeMatchBonusPoints({
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    homeTries,
    awayTries,
    rules,
  });

  if (opts?.persist !== false) {
    await db
      .update(fixtures)
      .set({
        homeTryBonusPoints: bonus.homeTryBonusPoints,
        awayTryBonusPoints: bonus.awayTryBonusPoints,
        homeLosingBonusPoints: bonus.homeLosingBonusPoints,
        awayLosingBonusPoints: bonus.awayLosingBonusPoints,
        bonusPointsComputedAt: new Date(),
      })
      .where(eq(fixtures.id, fixtureId));
  }

  return bonus;
}

/** Load stored bonus points, recomputing when missing for completed fixtures. */
export async function getFixtureBonusPoints(fixtureId: string): Promise<MatchBonusPoints | null> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return null;

  const status = (fixture.status ?? "").toLowerCase();
  const completed = COMPLETED.some((s) => status.includes(s)) || status === "full_time";

  if (fixture.bonusPointsComputedAt) {
    const { homeTries, awayTries } = await resolveSideTries(
      fixtureId,
      fixture.homeTeamId,
      fixture.awayTeamId,
    );
    const rules = await getScoringRulesForCompetition(fixture.competitionId ?? undefined);
    return {
      homeTryBonusPoints: fixture.homeTryBonusPoints,
      awayTryBonusPoints: fixture.awayTryBonusPoints,
      homeLosingBonusPoints: fixture.homeLosingBonusPoints,
      awayLosingBonusPoints: fixture.awayLosingBonusPoints,
      tryBonusTotal: fixture.homeTryBonusPoints + fixture.awayTryBonusPoints,
      losingBonusTotal: fixture.homeLosingBonusPoints + fixture.awayLosingBonusPoints,
      homeTries,
      awayTries,
      rules: {
        tryBonusThreshold: rules.tryBonusThreshold,
        losingBonusMargin: rules.losingBonusMargin,
      },
    };
  }

  if (!completed && fixture.homeScore === 0 && fixture.awayScore === 0) {
    return computeMatchBonusPoints({
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeTries: null,
      awayTries: null,
      rules: await getScoringRulesForCompetition(fixture.competitionId ?? undefined),
    });
  }

  return computeAndStoreFixtureBonusPoints(fixtureId, { persist: completed });
}

/**
 * Backfill bonus points for completed fixtures that have never been computed.
 * Prefer fixtures that already have try stats or match events.
 */
export async function backfillFixtureBonusPoints(opts?: {
  limit?: number;
  force?: boolean;
}): Promise<{ processed: number; updated: number }> {
  const db = getDb();
  const limit = opts?.limit ?? 5000;
  const force = opts?.force === true;

  const rows = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(
      and(
        or(
          inArray(fixtures.status, [...COMPLETED]),
          sql`lower(${fixtures.status}) like '%full%time%'`,
          sql`lower(${fixtures.status}) like '%complete%'`,
        ),
        force ? sql`true` : isNull(fixtures.bonusPointsComputedAt),
      ),
    )
    .limit(limit);

  let updated = 0;
  for (const row of rows) {
    const result = await computeAndStoreFixtureBonusPoints(row.id, { persist: true });
    if (result) updated += 1;
  }

  return { processed: rows.length, updated };
}
