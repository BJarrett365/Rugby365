/**
 * Shared match odds snapshot reads for Betting Intelligence (any provider).
 */
import "server-only";
import { desc, eq } from "drizzle-orm";
import { matchOddsSnapshots } from "@rugby365/db";
import { getDb } from "./db";

export async function getLatestOddsForFixture(fixtureId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(matchOddsSnapshots)
    .where(eq(matchOddsSnapshots.fixtureId, fixtureId))
    .orderBy(desc(matchOddsSnapshots.scrapedAt))
    .limit(1);
  return row ?? null;
}

export async function listRecentOddsSnapshots(limit = 30) {
  const db = getDb();
  return db
    .select({
      id: matchOddsSnapshots.id,
      fixtureId: matchOddsSnapshots.fixtureId,
      provider: matchOddsSnapshots.provider,
      sourceUrl: matchOddsSnapshots.sourceUrl,
      marketLabel: matchOddsSnapshots.marketLabel,
      homeName: matchOddsSnapshots.homeName,
      awayName: matchOddsSnapshots.awayName,
      competitionName: matchOddsSnapshots.competitionName,
      bookmakerCount: matchOddsSnapshots.bookmakerCount,
      bestHomeDecimal: matchOddsSnapshots.bestHomeDecimal,
      bestDrawDecimal: matchOddsSnapshots.bestDrawDecimal,
      bestAwayDecimal: matchOddsSnapshots.bestAwayDecimal,
      impliedHome: matchOddsSnapshots.impliedHome,
      impliedDraw: matchOddsSnapshots.impliedDraw,
      impliedAway: matchOddsSnapshots.impliedAway,
      scrapedAt: matchOddsSnapshots.scrapedAt,
    })
    .from(matchOddsSnapshots)
    .orderBy(desc(matchOddsSnapshots.scrapedAt))
    .limit(limit);
}
