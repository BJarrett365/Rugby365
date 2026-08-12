/**
 * Depth coverage for the 7 RWC 2019 Springbok fixtures under Rassie's 2018–19 tenure.
 */
import { eq, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  playerMatchRatings,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const IDS = [
  "a63efb3b-af0c-4041-9ece-7b78aa60b156",
  "9239f8b0-84e4-4129-bf56-1ba2d0c466be",
  "f7063446-8656-4089-9679-7f3c1c109f5e",
  "d6d2be3b-636c-4e0f-a1b2-f8915b4c4ce3",
  "4385ac76-80fb-4353-a7eb-c87423d50dbb",
  "ad8b71c1-d874-4d3d-9a60-09a85b855064",
  "0ebaf27a-d8a1-4ee7-a941-7bf3954b6ed8",
];

async function main() {
  const db = getDb();
  for (const id of IDS) {
    const [fx] = await db
      .select({
        slug: fixtures.slug,
        externalMatchId: fixtures.externalMatchId,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(fixtures)
      .where(eq(fixtures.id, id));
    const [ev] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(matchEvents)
      .where(eq(matchEvents.fixtureId, id));
    const [fp] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fixturePlayers)
      .where(eq(fixturePlayers.fixtureId, id));
    const [ts] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(teamMatchStats)
      .where(eq(teamMatchStats.fixtureId, id));
    const [ps] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playerMatchPerformanceStats)
      .where(eq(playerMatchPerformanceStats.fixtureId, id));
    const [pr] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playerMatchRatings)
      .where(eq(playerMatchRatings.fixtureId, id));
    console.log(
      JSON.stringify({
        slug: fx?.slug,
        ext: fx?.externalMatchId,
        score: [fx?.homeScore, fx?.awayScore],
        events: Number(ev?.n ?? 0),
        lineups: Number(fp?.n ?? 0),
        teamStats: Number(ts?.n ?? 0),
        playerPerf: Number(ps?.n ?? 0),
        ratings: Number(pr?.n ?? 0),
      }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
