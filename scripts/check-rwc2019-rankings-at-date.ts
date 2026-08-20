/**
 * Inspect world ranking snapshot availability around RWC 2019 dates.
 */
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { worldRankingRows, worldRankingSnapshots } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const SA = "b0000000-0000-4000-8000-000000000001";
const DATES = [
  "2019-09-21",
  "2019-09-28",
  "2019-10-04",
  "2019-10-08",
  "2019-10-20",
  "2019-10-27",
  "2019-11-02",
];

async function main() {
  const db = getDb();
  const [snapCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(worldRankingSnapshots);
  console.log("totalSnapshots", snapCount?.n ?? 0);

  const latest = await db
    .select({
      d: worldRankingSnapshots.effectiveDate,
      cat: worldRankingSnapshots.category,
    })
    .from(worldRankingSnapshots)
    .orderBy(desc(worldRankingSnapshots.effectiveDate))
    .limit(5);
  console.log("latest", latest);

  const earliest = await db
    .select({
      d: worldRankingSnapshots.effectiveDate,
      cat: worldRankingSnapshots.category,
    })
    .from(worldRankingSnapshots)
    .orderBy(worldRankingSnapshots.effectiveDate)
    .limit(5);
  console.log("earliest", earliest);

  for (const d of DATES) {
    const [snap] = await db
      .select({
        id: worldRankingSnapshots.id,
        effectiveDate: worldRankingSnapshots.effectiveDate,
        category: worldRankingSnapshots.category,
      })
      .from(worldRankingSnapshots)
      .where(
        and(
          eq(worldRankingSnapshots.category, "mens"),
          lte(worldRankingSnapshots.effectiveDate, d),
        ),
      )
      .orderBy(desc(worldRankingSnapshots.effectiveDate))
      .limit(1);

    if (!snap) {
      console.log(d, "NO_SNAPSHOT");
      continue;
    }
    const [sa] = await db
      .select({
        position: worldRankingRows.position,
        points: worldRankingRows.points,
        teamName: worldRankingRows.teamName,
      })
      .from(worldRankingRows)
      .where(and(eq(worldRankingRows.snapshotId, snap.id), eq(worldRankingRows.teamId, SA)))
      .limit(1);
    console.log(
      JSON.stringify({
        matchDate: d,
        snapDate: snap.effectiveDate,
        sa: sa ?? null,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
