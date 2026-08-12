import { persistCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import { getPublicCoachProfile } from "../apps/web/src/lib/public-coach-profile-service";
import { getCoachDataCoverage } from "../apps/web/src/lib/coach-recalc-service";

const ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
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
