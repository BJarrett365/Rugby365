/**
 * Recalculate Rassie after 2018–19 depth backfill and print before/after coverage.
 */
import { getCoachDataCoverage, recalculateCoach } from "../apps/web/src/lib/coach-recalc-service";
import { calculateAndPersistFixtureMatchRatings } from "../apps/web/src/lib/match-rating-service";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";
const RWC2019 = [
  "a63efb3b-af0c-4041-9ece-7b78aa60b156",
  "9239f8b0-84e4-4129-bf56-1ba2d0c466be",
  "f7063446-8656-4089-9679-7f3c1c109f5e",
  "d6d2be3b-636c-4e0f-a1b2-f8915b4c4ce3",
  "4385ac76-80fb-4353-a7eb-c87423d50dbb",
  "ad8b71c1-d874-4d3d-9a60-09a85b855064",
  "0ebaf27a-d8a1-4ee7-a941-7bf3954b6ed8",
];

async function main() {
  const before = await getCoachDataCoverage(RASSIE);
  console.log("BEFORE", JSON.stringify(before, null, 2));

  for (const id of RWC2019) {
    const r = await calculateAndPersistFixtureMatchRatings(id);
    console.log("rated", id, r.calculated);
  }

  const result = await recalculateCoach(RASSIE, {
    refreshLinks: true,
    persistRatings: true,
    overwriteLinks: true,
  });
  console.log("AFTER", JSON.stringify(result.coverage, null, 2));
  console.log("status", result.status, "careerPlayed", result.careerPlayed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
