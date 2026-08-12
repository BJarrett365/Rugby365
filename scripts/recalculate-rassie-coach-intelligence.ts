/**
 * Recalculate Rassie via CoachIntelligenceEngine and print audit + scores.
 */
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { calculateCoachIntelligence } from "../apps/web/src/lib/coach-intelligence-engine";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  console.log("=== AUDIT + RECALCULATE (coach-intelligence-v1) ===\n");
  const intel = await calculateCoachIntelligence(RASSIE);
  console.log(`Matches used: ${intel.matchesUsed} / window ${intel.matchWindow}`);
  console.log(`Period: ${intel.period}`);
  console.log(`Model: ${intel.modelVersion}\n`);

  console.log(
    "METRIC".padEnd(22),
    "SCORE".padStart(6),
    "CONF".padStart(5),
    "N".padStart(4),
    "COV".padStart(5),
    "STATUS".padStart(12),
    "AVAILABLE / MISSING",
  );
  for (const m of intel.metrics) {
    console.log(
      m.label.padEnd(22),
      (m.score != null ? String(Math.round(m.score)) : "—").padStart(6),
      `${m.confidence}%`.padStart(5),
      String(m.sampleSize).padStart(4),
      `${m.dataCoverage}%`.padStart(5),
      m.status.padStart(12),
      `avail=[${m.availableInputs.join(",")}] miss=[${m.missingInputs.join(",")}]`,
    );
    if (Object.keys(m.components).length) {
      console.log(
        "".padEnd(22),
        "  components:",
        Object.entries(m.components)
          .map(([k, v]) => `${k}=${v ?? "—"}`)
          .join(" "),
      );
    }
  }

  console.log("\nPersisting snapshot…");
  const bundle = await persistCoachRatingSnapshot(RASSIE);
  console.log("\n=== BUNDLE ===");
  console.log({
    overall: bundle.overallRating,
    powerIndex: bundle.powerIndex,
    worldRank: bundle.worldRank,
    confidence: bundle.dataConfidence,
    ratingConfidencePct: bundle.ratingConfidencePct,
    matchCount: bundle.matchCount,
  });
  console.log("\nPublic card metrics:");
  for (const m of bundle.metrics) {
    console.log(
      `  ${m.label}: ${m.score != null ? Math.round(m.score) : "—"}  rank=${m.worldRank != null ? `#${m.worldRank}` : "—"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
