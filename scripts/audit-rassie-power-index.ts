/**
 * Pre-change audit: Rassie Intelligence vs current Power Index calculation.
 * Does not persist.
 */
import {
  calculateCoachRatingBundle,
  POWER_INDEX_WEIGHTS,
  computePowerIndex,
} from "../apps/web/src/lib/coach-rating-service";
import { calculateCoachIntelligence } from "../apps/web/src/lib/coach-intelligence-engine";
import {
  POWER_INDEX_WEIGHTS_V1,
  computeCoachPowerIndex,
} from "../apps/web/src/lib/coach-power-index-engine";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  console.log("=== RASSIE POWER INDEX AUDIT (before / after engine) ===\n");

  const intel = await calculateCoachIntelligence(RASSIE);
  const bundle = await calculateCoachRatingBundle(RASSIE);

  console.log("--- Current Coach Intelligence ---");
  for (const m of intel.metrics) {
    console.log(
      `${m.label.padEnd(22)} score=${m.score != null ? Math.round(m.score) : "—"} conf=${m.confidence}% cov=${m.dataCoverage}% n=${m.sampleSize} status=${m.status}`,
    );
  }

  console.log("\n--- Current Power Index (legacy computePowerIndex on metrics) ---");
  console.log({
    powerIndex: bundle.powerIndex,
    overall: bundle.overallRating,
    version: bundle.powerIndexVersion,
    matchCount: bundle.matchCount,
    contributions: bundle.powerContributions,
  });
  console.log("Legacy weights:", POWER_INDEX_WEIGHTS);
  const legacySum = Object.values(POWER_INDEX_WEIGHTS).reduce((a, b) => a + b, 0);
  console.log("Legacy weight sum:", legacySum);

  const missingLegacy = Object.keys(POWER_INDEX_WEIGHTS).filter((k) => {
    if (k === "opponent_strength") return false;
    return bundle.metrics.find((m) => m.key === k)?.score == null;
  });
  console.log("Missing weighted metrics (legacy):", missingLegacy);

  console.log("\n--- Proposed coach-power-v1 (from Intelligence only) ---");
  console.log("New weights:", POWER_INDEX_WEIGHTS_V1);
  const proposed = computeCoachPowerIndex(intel.metrics, { matchesUsed: intel.matchesUsed });
  console.log({
    score: proposed.score,
    baseScore: proposed.baseScore,
    modifierTotal: proposed.modifierTotal,
    confidence: proposed.confidence,
    confidenceBand: proposed.confidenceBand,
    weightedCoverage: proposed.weightedCoverage,
    dataCoverage: proposed.dataCoverage,
    matchesUsed: proposed.matchesUsed,
    excludedKeys: proposed.excludedKeys,
    mismatches: proposed.mismatches,
    publishable: proposed.publishable,
  });
  console.log("\nContributions:");
  for (const c of proposed.contributions) {
    console.log(
      `  ${c.label.padEnd(20)} score=${c.score} weight=${c.weight}% contrib=${c.contribution}`,
    );
  }
  console.log("\nModifiers:");
  for (const m of proposed.modifiers) {
    console.log(`  ${m.label}: ${m.effect >= 0 ? "+" : ""}${m.effect} (source=${m.sourceScore})`);
  }

  // Consistency check vs intelligence
  console.log("\n--- Consistency (Intelligence score === PI input) ---");
  for (const c of proposed.contributions) {
    const intelM = intel.metrics.find((x) => x.key === c.key);
    const ok = intelM?.score != null && Math.abs(intelM.score - c.score) < 0.05;
    console.log(`  ${c.key}: intel=${intelM?.score} pi=${c.score} ${ok ? "OK" : "MISMATCH"}`);
  }

  // Also show legacy PI from same metrics for delta
  const legacy = computePowerIndex(bundle.metrics);
  console.log("\nLegacy PI from current metrics:", legacy.score);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
