/**
 * Audit + Top 5 for Rassie Erasmus Player Development v1.
 */
import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { getCoachPlayerDevelopmentBundle } from "../apps/web/src/lib/coach-player-development-service";

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, "rassie-erasmus")).limit(1);
  if (!coach) {
    console.log("Coach not found");
    return;
  }

  const bundle = await getCoachPlayerDevelopmentBundle(coach.id, { scope: "current_team" });

  console.log("=== COVERAGE ===");
  console.log({
    modelVersion: bundle.modelVersion,
    enoughData: bundle.enoughData,
    playersUsed: bundle.playersUsed,
    eligibleForDevelopment: bundle.eligibleForDevelopment,
    highConfidence: bundle.highConfidence,
    mediumConfidence: bundle.mediumConfidence,
    insufficientData: bundle.insufficientData,
    ratedAppearanceCoveragePct: bundle.ratedAppearanceCoveragePct,
    coachDevelopmentScore: bundle.coachDevelopmentScore,
  });

  const withPre = bundle.allPlayers.filter((p) => p.baselineSource === "pre_coach_last_5");
  const withTenureStart = bundle.allPlayers.filter((p) => p.baselineSource === "tenure_start_first_3");
  const withImage = bundle.allPlayers.filter((p) => p.playerImageUrl);
  const ge3 = bundle.allPlayers.filter((p) => p.ratedAppsUnderCoach >= 3);
  const ge5 = bundle.allPlayers.filter((p) => p.ratedAppsUnderCoach >= 5);

  console.log("=== BASELINE / SAMPLE ===");
  console.log({
    withTruePreCoachBaseline: withPre.length,
    withTenureStartBaseline: withTenureStart.length,
    playersWith3plusRated: ge3.length,
    playersWith5plusRated: ge5.length,
    playersWithImages: withImage.length,
  });

  console.log("=== TOP 5 MOST IMPROVED (ranked by adjusted score; public shows displayedChange) ===");
  for (const r of bundle.mostImproved) {
    console.log({
      name: r.playerName,
      position: r.position,
      apps: r.appearancesUnderCoach,
      baseline: r.baselineRating,
      baselineSource: r.baselineSource,
      current: r.currentRating,
      displayedChange: r.displayedChange,
      adjustedDevelopmentScore: r.adjustedDevelopmentScore,
      trend: r.trend,
      confidence: r.confidence,
      image: Boolean(r.playerImageUrl),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
