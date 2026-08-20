/**
 * Preview + run Pollard value history backfill (6 months default).
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-pollard-value-history.ts [6|12|24]
 */
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  previewPlayerValueHistoryBackfill,
  runPlayerValueHistoryBackfill,
  type ValueBackfillRangeOption,
} from "../apps/web/src/lib/player-value-backfill-service";
import { auditPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";

process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const arg = process.argv[2] ?? "6";
  const range: ValueBackfillRangeOption =
    arg === "career" ? "career" : ([6, 12, 24].includes(Number(arg)) ? (Number(arg) as 6 | 12 | 24) : 6);

  const db = getDb();
  const [p] = await db
    .select({ id: players.id, slug: players.slug, name: players.name })
    .from(players)
    .where(eq(players.slug, "handre-pollard-og9nmd6l"))
    .limit(1);
  if (!p) {
    console.error("Pollard not found");
    process.exit(1);
  }

  const before = await auditPlayerValueHistory(p.id);
  const preview = await previewPlayerValueHistoryBackfill(p.id, range);
  console.log(
    JSON.stringify(
      {
        player: p,
        range,
        before,
        previewSummary: {
          periodsChecked: preview.periodsChecked,
          calculablePeriods: preview.calculablePeriods,
          expectedSnapshots: preview.expectedSnapshots,
          avgConfidence: preview.avgConfidence,
          missingDataPeriods: preview.missingDataPeriods,
          periods: preview.periods.map((row) => ({
            month: row.monthKey,
            coverage: row.coveragePct,
            canCalculate: row.canCalculate,
            skip: row.skipReason,
            value: row.estimatedValueGbp,
            age: row.ageAtSnapshot,
            club: row.clubName,
            ovr: row.overallRating,
          })),
        },
      },
      null,
      2,
    ),
  );

  const result = await runPlayerValueHistoryBackfill(p.id, range);
  const after = await auditPlayerValueHistory(p.id);
  console.log(JSON.stringify({ run: result, after }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
