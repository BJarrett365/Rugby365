/**
 * Recalculate Rassie Power Index from Coach Intelligence and persist snapshot.
 */
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { calculateCoachIntelligence } from "../apps/web/src/lib/coach-intelligence-engine";
import { computeCoachPowerIndex } from "../apps/web/src/lib/coach-power-index-engine";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  console.log("=== RECALCULATE RASSIE (coach-power-v1 ← coach-intelligence-v1) ===\n");
  const intel = await calculateCoachIntelligence(RASSIE);
  const preview = computeCoachPowerIndex(intel.metrics, { matchesUsed: intel.matchesUsed });
  console.log("Preview Power Index:", preview.score);
  console.log("Base:", preview.baseScore, "Modifiers:", preview.modifierTotal);
  console.log("Coverage:", preview.weightedCoverage, "Confidence:", preview.confidence);
  console.log("Mismatches:", preview.mismatches);

  const bundle = await persistCoachRatingSnapshot(RASSIE);
  console.log("\n=== PERSISTED ===");
  console.log({
    powerIndex: bundle.powerIndex,
    previous: bundle.previousPowerIndex,
    change: bundle.powerIndexChange,
    overall: bundle.overallRating,
    momentum: bundle.momentum,
    confidence: bundle.powerIndexDetail?.confidence,
    coverage: bundle.powerIndexDetail?.weightedCoverage,
    version: bundle.powerIndexVersion,
    mismatches: bundle.powerIndexMismatches,
  });

  console.log("\nConsistency check (Intelligence ≡ PI display):");
  for (const c of bundle.powerIndexDetail?.contributions ?? []) {
    const m = bundle.intelligence.find((x) => x.key === c.key);
    const ok = m?.score != null && Math.abs(m.score - c.score) < 0.05;
    console.log(`  ${c.key}: intel=${m?.score} pi=${c.score} ${ok ? "OK" : "FAIL"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
