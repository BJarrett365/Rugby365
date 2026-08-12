/**
 * Audit Rating Trends data for Rassie Erasmus — current tenure.
 */
import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { coaches, coachRatingHistory } from "@rugby365/db";
import { getCoachDetail } from "../apps/web/src/lib/coach-admin-service";
import { calculateCoachRatingBundle } from "../apps/web/src/lib/coach-rating-service";
import {
  backfillCoachMatchRatingHistory,
  getCoachRatingTrends,
  listMatchLinkedRatingHistory,
} from "../apps/web/src/lib/coach-rating-trends-service";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, "rassie-erasmus")).limit(1);
  if (!coach) {
    console.log("Coach not found");
    return;
  }

  const detail = await getCoachDetail(coach.id);
  const current = detail?.assignments.find((a) => a.isCurrent) ?? null;

  const [totalHist] = await db
    .select({ n: count() })
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, coach.id));
  const [linkedHist] = await db
    .select({ n: count() })
    .from(coachRatingHistory)
    .where(and(eq(coachRatingHistory.coachId, coach.id), isNotNull(coachRatingHistory.fixtureId)));

  const allRows = await db
    .select()
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, coach.id))
    .orderBy(asc(coachRatingHistory.calculatedAt));

  console.log("=== AUDIT (before backfill) ===");
  console.log({
    coach: coach.fullName,
    tenure: current ? `${current.teamName} ${current.startDate}–` : null,
    totalHistoryRows: totalHist?.n ?? 0,
    matchLinkedRows: linkedHist?.n ?? 0,
    snapshotTypes: [...new Set(allRows.map((r) => r.snapshotType))],
    withFixtureId: allRows.filter((r) => r.fixtureId).length,
    withPreviousRating: allRows.filter((r) => r.previousRating != null).length,
    modelVersions: [...new Set(allRows.map((r) => r.modelVersion))],
    earliest: allRows[0]?.calculatedAt?.toISOString() ?? null,
    latest: allRows.at(-1)?.calculatedAt?.toISOString() ?? null,
  });

  if ((linkedHist?.n ?? 0) < 2) {
    console.log("\n=== BACKFILLING current tenure match-linked snapshots ===");
    const result = await backfillCoachMatchRatingHistory(coach.id, {
      filter: "current_team",
      overwrite: true,
    });
    console.log(result);
  }

  const linked = await listMatchLinkedRatingHistory(coach.id);
  const trends = await getCoachRatingTrends(coach.id, "last_24");
  const currentRating = await calculateCoachRatingBundle(coach.id);

  const ratingAt = (n: number) => {
    const idx = linked.length - n;
    return idx >= 0 ? linked[idx]?.rating : null;
  };

  console.log("\n=== AFTER BACKFILL ===");
  console.log({
    matchLinkedSnapshots: linked.length,
    earliestMatch: linked[0]?.matchDate ?? null,
    latestMatch: linked.at(-1)?.matchDate ?? null,
    snapshotTypes: [...new Set(linked.map((p) => p.snapshotType))],
    allHaveFixtureId: linked.every((p) => p.fixtureId),
    allHaveChange: linked.filter((p) => p.change != null).length,
  });

  console.log("\n=== RASSIE TREND SUMMARY (last 24) ===");
  console.log({
    currentRating: currentRating.overallRating,
    trendsLastPoint: trends.summary.current,
    ratingMatches: trends.summary.pointCount >= 2,
    current: trends.summary.current,
    rangeChange: trends.summary.rangeChange,
    high: trends.summary.high,
    low: trends.summary.low,
    trend: trends.summary.trendLabel,
    rating5MatchesAgo: ratingAt(5),
    rating10MatchesAgo: ratingAt(10),
    rating24MatchesAgo: ratingAt(24),
    currentPowerIndex: currentRating.powerIndex,
    momentum: currentRating.momentum,
    confidence: linked.at(-1)?.confidence,
    coverage: linked.at(-1)?.coverage,
    lastPointMatchesCurrent:
      trends.summary.current != null &&
      currentRating.overallRating != null &&
      Math.abs(trends.summary.current - currentRating.overallRating) < 0.2,
  });

  if (linked.length >= 2) {
    console.log("\n=== SAMPLE POINTS (last 3) ===");
    for (const p of linked.slice(-3)) {
      console.log({
        date: p.matchDate?.slice(0, 10),
        opponent: p.opponentName,
        result: p.result,
        rating: p.rating,
        change: p.change,
        powerIndex: p.powerIndex,
        type: p.snapshotType,
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
