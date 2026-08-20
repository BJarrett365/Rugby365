/**
 * Coach calculation coverage + recalculation orchestration.
 * Derived areas recompute from Rugby365 data — editors never hand-fill them.
 */

import { eq, inArray, sql } from "drizzle-orm";
import {
  coaches,
  fixturePlayers,
  playerMatchRatings,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "./db";
import { getCoachDetail } from "./coach-admin-service";
import {
  getCoachCareerRecord,
  getCoachImpact,
  loadCoachEligibleMatches,
} from "./coach-career-record-service";
import { refreshCoachMatchLinks } from "./coach-match-link-service";
import { persistCoachRatingSnapshot, calculateCoachRatingBundle } from "./coach-rating-service";
import { countPresentHistoricalRankings } from "./coach-coverage-gaps-service";

export type CoachCalcStatus = "current" | "stale" | "calculating" | "partial" | "failed";

export type CoachDataCoverage = {
  careerMatches: number;
  lineups: { have: number; of: number };
  teamStats: { have: number; of: number };
  playerRatings: { have: number; of: number };
  historicalRankings: { have: number; of: number };
  calcStatus: CoachCalcStatus;
  calcUpdatedAt: string | null;
  calcStaleReason: string | null;
  partialCareerRecord: boolean;
  /** 0–100 composite confidence from coverage layers. */
  ratingConfidencePct: number;
  ratingConfidenceInputs: {
    matchCoverage: number;
    teamStatCoverage: number;
    playerRatingCoverage: number;
    historicalRankingCoverage: number;
  };
};

export type CoachRecalcResult = {
  coachId: string;
  links: Awaited<ReturnType<typeof refreshCoachMatchLinks>> | null;
  careerPlayed: number;
  ratingsPersisted: boolean;
  impactUnderCount: number;
  coverage: CoachDataCoverage;
  status: CoachCalcStatus;
  error?: string;
};

function ratioPct(have: number, of: number): number {
  if (of <= 0) return 0;
  return Math.round((100 * have) / of);
}

export function computeRatingConfidencePct(input: {
  matchCoverage: number;
  teamStatCoverage: number;
  playerRatingCoverage: number;
  historicalRankingCoverage: number;
}): number {
  // Weighted: matches matter most, then ratings/stats, then rankings.
  const weighted =
    input.matchCoverage * 0.35 +
    input.teamStatCoverage * 0.25 +
    input.playerRatingCoverage * 0.25 +
    input.historicalRankingCoverage * 0.15;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

async function setCalcStatus(
  coachId: string,
  status: CoachCalcStatus,
  extra: { reason?: string | null; error?: string | null } = {},
) {
  const db = getDb();
  try {
    await db.execute(sql`
      update coaches
      set calc_status = ${status},
          calc_stale_reason = ${extra.reason ?? null},
          calc_error = ${extra.error ?? null},
          calc_updated_at = now(),
          updated_at = now()
      where id = ${coachId}::uuid
    `);
  } catch {
    // Column may not exist until migration 0071 is applied.
  }
}

export async function getCoachDataCoverage(coachId: string): Promise<CoachDataCoverage> {
  const db = getDb();
  const detail = await getCoachDetail(coachId);
  const matches = await loadCoachEligibleMatches(coachId);
  const ids = matches.map((m) => m.id);
  const of = ids.length;

  let lineups = 0;
  let teamStats = 0;
  let playerRatings = 0;
  let historicalRankings = 0;

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

    const [pr] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
      .from(playerMatchRatings)
      .where(inArray(playerMatchRatings.fixtureId, ids));
    playerRatings = pr?.n ?? 0;

    historicalRankings = (await countPresentHistoricalRankings(coachId)).have;
  }

  let calcStatus: CoachCalcStatus = "current";
  let calcUpdatedAt: string | null = null;
  let calcStaleReason: string | null = null;
  const [c] = await db.select().from(coaches).where(eq(coaches.id, coachId)).limit(1);
  if (c) {
    calcStatus = (c.calcStatus as CoachCalcStatus) || "current";
    calcUpdatedAt = c.calcUpdatedAt?.toISOString() ?? null;
    calcStaleReason = c.calcStaleReason ?? null;
  }

  const partial =
    Boolean(detail?.coach.careerRecordPartial) ||
    (of > 0 &&
      (lineups < of || teamStats < of || playerRatings < of || historicalRankings < of));

  if (partial && calcStatus === "current") calcStatus = "partial";

  const ratingConfidenceInputs = {
    matchCoverage: of > 0 ? 100 : 0,
    teamStatCoverage: ratioPct(teamStats, of),
    playerRatingCoverage: ratioPct(playerRatings, of),
    historicalRankingCoverage: ratioPct(historicalRankings, of),
  };

  return {
    careerMatches: of,
    lineups: { have: lineups, of },
    teamStats: { have: teamStats, of },
    playerRatings: { have: playerRatings, of },
    historicalRankings: { have: historicalRankings, of },
    calcStatus,
    calcUpdatedAt,
    calcStaleReason,
    partialCareerRecord: partial,
    ratingConfidencePct: computeRatingConfidencePct(ratingConfidenceInputs),
    ratingConfidenceInputs,
  };
}

export async function recalculateCoach(
  coachId: string,
  options: {
    refreshLinks?: boolean;
    persistRatings?: boolean;
    overwriteLinks?: boolean;
  } = {},
): Promise<CoachRecalcResult> {
  const refreshLinks = options.refreshLinks !== false;
  const persistRatings = options.persistRatings !== false;

  await setCalcStatus(coachId, "calculating");

  try {
    let links: CoachRecalcResult["links"] = null;
    if (refreshLinks) {
      links = await refreshCoachMatchLinks(coachId, {
        overwrite: options.overwriteLinks ?? true,
      });
    }

    const career = await getCoachCareerRecord(coachId);
    const impact = await getCoachImpact(coachId);

    let ratingsPersisted = false;
    if (persistRatings && career.played > 0) {
      await persistCoachRatingSnapshot(coachId);
      ratingsPersisted = true;
    } else if (persistRatings) {
      await calculateCoachRatingBundle(coachId);
    }

    // Mark career partial on coach row when coverage incomplete
    const coverage = await getCoachDataCoverage(coachId);
    const db = getDb();
    await db
      .update(coaches)
      .set({
        careerRecordPartial: coverage.partialCareerRecord,
        careerRecordNotes: coverage.partialCareerRecord
          ? `Verified matches: ${coverage.careerMatches}. Expected historical coverage: Incomplete.`
          : null,
        updatedAt: new Date(),
      })
      .where(eq(coaches.id, coachId));

    const status: CoachCalcStatus = coverage.partialCareerRecord ? "partial" : "current";
    await setCalcStatus(coachId, status, { reason: null, error: null });

    return {
      coachId,
      links,
      careerPlayed: career.played,
      ratingsPersisted,
      impactUnderCount: impact.underCount,
      coverage: { ...coverage, calcStatus: status },
      status,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setCalcStatus(coachId, "failed", { error: message });
    return {
      coachId,
      links: null,
      careerPlayed: 0,
      ratingsPersisted: false,
      impactUnderCount: 0,
      coverage: await getCoachDataCoverage(coachId).catch(() => ({
        careerMatches: 0,
        lineups: { have: 0, of: 0 },
        teamStats: { have: 0, of: 0 },
        playerRatings: { have: 0, of: 0 },
        historicalRankings: { have: 0, of: 0 },
        calcStatus: "failed" as const,
        calcUpdatedAt: null,
        calcStaleReason: null,
        partialCareerRecord: true,
        ratingConfidencePct: 0,
        ratingConfidenceInputs: {
          matchCoverage: 0,
          teamStatCoverage: 0,
          playerRatingCoverage: 0,
          historicalRankingCoverage: 0,
        },
      })),
      status: "failed",
      error: message,
    };
  }
}

export async function backfillCoachData(input: {
  mode: "coach" | "team" | "all_active" | "all";
  coachId?: string;
  teamId?: string;
}): Promise<{ processed: number; results: CoachRecalcResult[] }> {
  const db = getDb();
  let coachIds: string[] = [];

  if (input.mode === "coach" && input.coachId) {
    coachIds = [input.coachId];
  } else if (input.mode === "team" && input.teamId) {
    const { teamCoachingStaff } = await import("@rugby365/db");
    const rows = await db
      .selectDistinct({ coachId: teamCoachingStaff.coachId })
      .from(teamCoachingStaff)
      .where(eq(teamCoachingStaff.teamId, input.teamId));
    coachIds = rows.map((r) => r.coachId);
  } else if (input.mode === "all_active") {
    const { teamCoachingStaff } = await import("@rugby365/db");
    const rows = await db
      .selectDistinct({ coachId: teamCoachingStaff.coachId })
      .from(teamCoachingStaff)
      .where(eq(teamCoachingStaff.isCurrent, true));
    coachIds = rows.map((r) => r.coachId);
  } else if (input.mode === "all") {
    const rows = await db.select({ id: coaches.id }).from(coaches);
    coachIds = rows.map((r) => r.id);
  }

  const results: CoachRecalcResult[] = [];
  for (const id of coachIds) {
    results.push(await recalculateCoach(id));
  }
  return { processed: results.length, results };
}

/** After fixture/lineup/stats change — mark + optionally recalc. */
export async function onFixtureDataChanged(
  fixtureId: string,
  options: { recalculate?: boolean } = {},
) {
  const { cascadeFixtureDataChange } = await import("./data-change-event-service");
  const result = await cascadeFixtureDataChange({
    fixtureId,
    eventType: "MATCH_UPDATED",
    source: "system",
    importMethod: "SYSTEM",
    processNow: Boolean(options.recalculate),
    processLimit: 40,
  });
  return {
    coachIds: result.affected.filter((a) => a.entityType === "coach").map((a) => a.entityId),
    affected: result.affected,
    eventId: result.eventId,
  };
}
