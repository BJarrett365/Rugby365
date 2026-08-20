/**
 * Backfill World Rugby ranking snapshots for a coach's eligible match dates
 * (on/before kickoff only). Rejects API clamp-forward (e.g. 2019 → 2020-09).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-coach-historical-rankings.ts --coach=rassie-erasmus
 */
import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";
import { syncWorldRugbyRankingsForDate } from "../apps/web/src/lib/world-rugby-rankings-at-date";
import { setCoverageGapAction } from "../apps/web/src/lib/coach-coverage-gaps-service";
import { recalculateCoach, getCoachDataCoverage } from "../apps/web/src/lib/coach-recalc-service";

const args = process.argv.slice(2);
const coachArg = args.find((a) => a.startsWith("--coach="))?.split("=")[1] ?? "rassie-erasmus";

async function main() {
  const db = getDb();
  const [coach] =
    coachArg.includes("-") && !coachArg.includes(":")
      ? await db.select().from(coaches).where(eq(coaches.slug, coachArg)).limit(1)
      : await db.select().from(coaches).where(eq(coaches.id, coachArg)).limit(1);
  if (!coach) throw new Error(`Coach not found: ${coachArg}`);

  const before = await getCoachDataCoverage(coach.id);
  console.log("BEFORE", {
    matches: before.careerMatches,
    lineups: before.lineups,
    teamStats: before.teamStats,
    playerRatings: before.playerRatings,
    historicalRankings: before.historicalRankings,
    confidence: before.ratingConfidencePct,
  });

  const matches = await loadCoachEligibleMatches(coach.id);
  const dates = [
    ...new Set(
      matches
        .map((m) => m.kickoffAt?.toISOString().slice(0, 10))
        .filter((d): d is string => Boolean(d)),
    ),
  ].sort();

  let synced = 0;
  let unavailable = 0;
  let skipped = 0;
  const seenEffective = new Set<string>();

  for (const date of dates) {
    const result = await syncWorldRugbyRankingsForDate("mru", date);
    if (!result.ok) {
      unavailable += 1;
      console.log(`  ${date}: UNAVAILABLE ${result.reason}`);
      // Mark 2018–19 RWC fixtures unavailable when API clamps
      for (const m of matches) {
        const md = m.kickoffAt?.toISOString().slice(0, 10);
        if (md !== date) continue;
        await setCoverageGapAction({
          coachId: coach.id,
          dataType: "historical_rankings",
          fixtureId: m.id,
          action: "unavailable",
          note: result.reason ?? "No World Rugby snapshot on/before match date",
        }).catch(() => undefined);
      }
      continue;
    }
    if (result.effectiveDate && seenEffective.has(result.effectiveDate)) {
      skipped += 1;
      continue;
    }
    if (result.effectiveDate) seenEffective.add(result.effectiveDate);
    synced += 1;
    console.log(`  ${date}: stored effective=${result.effectiveDate} rows=${result.rowsUpserted}`);
    // polite throttle
    await new Promise((r) => setTimeout(r, 250));
  }

  const recalc = await recalculateCoach(coach.id, {
    refreshLinks: true,
    persistRatings: true,
    overwriteLinks: true,
  });
  const after = recalc.coverage;

  console.log("\nRANKING SYNC", { synced, unavailable, skipped, uniqueDates: dates.length });
  console.log("AFTER", {
    matches: after.careerMatches,
    lineups: after.lineups,
    teamStats: after.teamStats,
    playerRatings: after.playerRatings,
    historicalRankings: after.historicalRankings,
    confidence: after.ratingConfidencePct,
    status: after.calcStatus,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
