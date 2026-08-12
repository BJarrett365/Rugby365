/**
 * Full hierarchy validation for Rassie Erasmus.
 * Intelligence → Power Index → Coach Rating → World Rank
 */
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { calculateCoachIntelligence } from "../apps/web/src/lib/coach-intelligence-engine";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  console.log("=== RASSIE FULL CHAIN VALIDATION ===\n");

  const intel = await calculateCoachIntelligence(RASSIE);
  console.log("--- 15 COACH INTELLIGENCE SCORES ---");
  console.log(`Model: ${intel.modelVersion} · matchesUsed: ${intel.matchesUsed}\n`);
  for (const m of intel.metrics) {
    console.log(
      `${m.label.padEnd(22)} ${m.score != null ? String(Math.round(m.score)).padStart(3) : "  —"}  conf=${String(m.confidence).padStart(3)}%  cov=${String(m.dataCoverage).padStart(3)}%  n=${String(m.sampleSize).padStart(2)}  ${m.status}  missing=[${m.missingInputs.join(",") || "none"}]`,
    );
  }

  const bundle = await persistCoachRatingSnapshot(RASSIE);

  console.log("\n--- POWER INDEX ---");
  console.log({
    score: bundle.powerIndex,
    previous: bundle.previousPowerIndex,
    change: bundle.powerIndexChange,
    base: bundle.powerIndexDetail?.baseScore,
    modifiers: bundle.powerIndexDetail?.modifierTotal,
    confidence: bundle.powerIndexDetail?.confidence,
    coverage: bundle.powerIndexDetail?.weightedCoverage,
    version: bundle.powerIndexVersion,
    mismatches: bundle.powerIndexMismatches,
  });

  console.log("\n--- RUGBY365 COACH RATING ---");
  console.log({
    score: bundle.overallRating,
    previous: bundle.previousOverallRating,
    change: bundle.overallRatingChange,
    confidence: bundle.coachRatingDetail?.confidence,
    coverage: bundle.coachRatingDetail?.weightedCoverage,
    eligible: bundle.coachRatingDetail?.eligibleForWorldRank,
    version: bundle.modelVersion,
    excluded: bundle.coachRatingDetail?.excludedKeys,
  });
  console.log("\nWhy Coach Rating:");
  for (const c of bundle.coachRatingDetail?.contributions ?? []) {
    console.log(
      `  ${c.label.padEnd(24)} score=${String(Math.round(c.score)).padStart(3)}  weight=${String(c.weight).padStart(4)}%  contrib=${c.contribution.toFixed(1)}  (${c.source})`,
    );
  }

  console.log("\n--- WORLD RANK ---");
  console.log({
    worldRank: bundle.worldRank,
    previous: bundle.previousWorldRank,
    change: bundle.worldRankChange,
    rankedOutOf: bundle.rankedOutOf,
    provisional: bundle.provisional,
  });

  console.log("\n--- SUMMARY ---");
  console.log({
    intelligenceVersion: bundle.intelligenceModelVersion,
    powerIndexVersion: bundle.powerIndexVersion,
    coachRatingVersion: bundle.modelVersion,
    powerIndex: bundle.powerIndex,
    coachRating: bundle.overallRating,
    worldRank: bundle.worldRank,
    momentum: bundle.momentum,
    ratingConfidencePct: bundle.ratingConfidencePct,
    dataConfidence: bundle.dataConfidence,
    matchCount: bundle.matchCount,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
