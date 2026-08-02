/**
 * Migrate legacy `standing_rows.form` JSON blobs (`{"tbp":0,"lbp":0,"lf":"WWWWL"}`)
 * into the dedicated bonus-point columns, leaving `form` as a plain W/D/L sequence.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-standing-form.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-standing-form.ts --dry-run
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { parseStandingForm } from "../apps/web/src/lib/standing-form";

const dryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 200;

async function main() {
  const db = getDb();
  const rows = (await db.execute(sql`
    select id, form, try_bonus_points, losing_bonus_points
    from standing_rows
    where form is not null and form <> '' and form !~ '^[WDL-]+$'
  `)) as unknown as Array<{
    id: string;
    form: string;
    try_bonus_points: number;
    losing_bonus_points: number;
  }>;

  console.log(`${rows.length} rows with non-sequence form values`);

  const updates = rows.map((row) => {
    const meta = parseStandingForm(row.form);
    return {
      id: row.id,
      form: meta.lastFive,
      tryBonusPoints: meta.tryBonusPoints ?? row.try_bonus_points,
      losingBonusPoints: meta.losingBonusPoints ?? row.losing_bonus_points,
    };
  });

  if (dryRun) {
    for (const update of updates.slice(0, 20)) {
      console.log(
        `  ${update.id}: form=${update.form ?? "null"} tbp=${update.tryBonusPoints} lbp=${update.losingBonusPoints}`,
      );
    }
    console.log(`Dry run — ${updates.length} rows would be rewritten.`);
    return;
  }

  for (let start = 0; start < updates.length; start += BATCH_SIZE) {
    const batch = updates.slice(start, start + BATCH_SIZE);
    const values = sql.join(
      batch.map(
        (u) =>
          sql`(${u.id}::uuid, ${u.form}::text, ${u.tryBonusPoints}::int, ${u.losingBonusPoints}::int)`,
      ),
      sql`, `,
    );
    await db.execute(sql`
      update standing_rows sr
      set form = v.form,
          try_bonus_points = v.tbp,
          losing_bonus_points = v.lbp
      from (values ${values}) as v(id, form, tbp, lbp)
      where sr.id = v.id
    `);
    console.log(`  updated ${Math.min(start + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  const [remaining] = (await db.execute(sql`
    select count(*)::int as count from standing_rows
    where form is not null and form <> '' and form !~ '^[WDL-]+$'
  `)) as unknown as Array<{ count: number }>;
  console.log(`Remaining non-sequence form values: ${remaining?.count ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
