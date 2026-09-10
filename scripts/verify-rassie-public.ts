import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { getPublicCoachProfile } from "../apps/web/src/lib/public-coach-profile-service";
import { getCoachDataCoverage } from "../apps/web/src/lib/coach-recalc-service";

async function main() {
  const db = getDb();
  const [row] = await db
    .select({ id: coaches.id })
    .from(coaches)
    .where(eq(coaches.slug, "rassie-erasmus"))
    .limit(1);
  if (!row) throw new Error("rassie-erasmus not found");
  const ID = row.id;
  const b = await persistCoachRatingSnapshot(ID);
  console.log("rating", b.overallRating, "PI", b.powerIndex, "rank", b.worldRank, "matches", b.matchCount);
  const p = await getPublicCoachProfile("rassie-erasmus", { preview: true });
  console.log(
    "recent",
    p?.recentMatches.length,
    "upcoming",
    p?.upcomingMatch?.kickoffAt,
    p?.upcomingMatch?.homeTeamName,
    "vs",
    p?.upcomingMatch?.awayTeamName,
  );
  console.log("ratingHistory", p?.ratingHistory.length, "worldRankings", p?.worldRankings.length);
  console.log(
    "career",
    p?.careerRecord.played,
    p?.careerRecord.wins,
    p?.careerRecord.winRate,
    "partial",
    p?.careerRecord.partial,
  );
  console.log("impact enough", p?.impact.enoughData, "under", p?.impact.underCount);
  console.log("coverage", await getCoachDataCoverage(ID));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
