/**
 * Apply 0071 coach calc status + recalculate Rassie.
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rassie-coach-data.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { recalculateCoach, getCoachDataCoverage } from "../apps/web/src/lib/coach-recalc-service";
import { loadCoachEligibleMatches, getCoachCareerRecord } from "../apps/web/src/lib/coach-career-record-service";

const COACH_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  const db = getDb();
  console.log("Applying calc_status columns…");
  await db.execute(sql`
    ALTER TABLE coaches
      ADD COLUMN IF NOT EXISTS calc_status text NOT NULL DEFAULT 'current',
      ADD COLUMN IF NOT EXISTS calc_updated_at timestamptz,
      ADD COLUMN IF NOT EXISTS calc_stale_reason text,
      ADD COLUMN IF NOT EXISTS calc_error text
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS coaches_calc_status_idx ON coaches (calc_status)`);

  console.log("Recalculating Rassie (refresh links + ratings)…");
  const result = await recalculateCoach(COACH_ID, {
    refreshLinks: true,
    persistRatings: true,
    overwriteLinks: true,
  });
  console.log(JSON.stringify(result, null, 2));

  const matches = await loadCoachEligibleMatches(COACH_ID);
  const career = await getCoachCareerRecord(COACH_ID);
  const coverage = await getCoachDataCoverage(COACH_ID);
  console.log("\nEligible matches:", matches.length);
  console.log("Career:", {
    played: career.played,
    wins: career.wins,
    draws: career.draws,
    losses: career.losses,
    winRate: career.winRate,
    partial: career.partial,
  });
  console.log("Coverage:", coverage);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
