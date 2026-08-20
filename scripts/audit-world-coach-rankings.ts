/**
 * Audit World Coach Rankings eligibility + display inputs.
 */
import { desc, eq, inArray } from "drizzle-orm";
import {
  coaches,
  coachRatingSnapshots,
  teamCoachingStaff,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { listCoachWorldRankings } from "../apps/web/src/lib/coach-rating-service";
import type { CoachRatingResult } from "../apps/web/src/lib/coach-rating-engine";

async function main() {
  const db = getDb();
  const rankings = await listCoachWorldRankings(20);
  console.log("=== ELIGIBLE WORLD RANK POOL ===");
  console.log("count", rankings.length);

  for (const row of rankings) {
    const [snap] = await db
      .select()
      .from(coachRatingSnapshots)
      .where(eq(coachRatingSnapshots.coachId, row.coachId))
      .orderBy(desc(coachRatingSnapshots.calculatedAt))
      .limit(1);
    const metrics = (snap?.metrics ?? {}) as {
      coachRating?: CoachRatingResult;
      ratingConfidencePct?: number;
      ratingConfidenceInputs?: Record<string, number>;
    };
    const cr = metrics.coachRating;
    const [coach] = await db.select().from(coaches).where(eq(coaches.id, row.coachId)).limit(1);
    const assigns = await db
      .select({
        team: teams.name,
        role: teamCoachingStaff.role,
        display: teamCoachingStaff.teamDisplayName,
        primary: teamCoachingStaff.isPrimaryCoach,
        current: teamCoachingStaff.isCurrent,
      })
      .from(teamCoachingStaff)
      .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
      .where(eq(teamCoachingStaff.coachId, row.coachId));
    const current = assigns.find((a) => a.current) ?? assigns[0];

    // previous snapshot for movement
    const snaps = await db
      .select({
        worldRank: coachRatingSnapshots.worldRank,
        overallRating: coachRatingSnapshots.overallRating,
        calculatedAt: coachRatingSnapshots.calculatedAt,
      })
      .from(coachRatingSnapshots)
      .where(eq(coachRatingSnapshots.coachId, row.coachId))
      .orderBy(desc(coachRatingSnapshots.calculatedAt))
      .limit(5);

    console.log("\n---", row.rank, row.name, "---");
    console.log({
      rating: row.rating,
      rankChange: row.rankChange,
      previousRank: row.previousRank,
      currentTeamName: row.currentTeamName,
      nationality: row.nationality,
      imageUrl: row.imageUrl ? "YES" : "NO",
      confidence: row.confidence,
      coverage: row.coverage,
      matchesUsed: row.matchesUsed,
      eligible: cr?.eligibleForWorldRank ?? null,
      snapshotWorldRanks: snaps.map((s) => s.worldRank),
      whyMovement:
        row.rankChange == null
          ? "no previous worldRank on prior snapshot (or first appearance in pool)"
          : row.rankChange === 0
            ? "unchanged vs previous snapshot worldRank"
            : `moved ${row.rankChange > 0 ? "up" : "down"} ${Math.abs(row.rankChange)}`,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
