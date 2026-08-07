/**
 * Recompute standing form (W/D/L) from finished fixtures.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/recompute-standing-form.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/recompute-standing-form.ts --all-seasons
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/recompute-standing-form.ts --competition=world-rugby-nations-cup
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/recompute-standing-form.ts --force
 */
import { eq } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { recomputeStandingForms } from "../apps/web/src/lib/standing-form-recompute-service";

const args = process.argv.slice(2);
const force = args.includes("--force");
const allSeasons = args.includes("--all-seasons");
const competitionSlug = args.find((a) => a.startsWith("--competition="))?.split("=")[1];

async function main() {
  let competitionId: string | undefined;
  if (competitionSlug) {
    const db = getDb();
    const [row] = await db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.slug, competitionSlug))
      .limit(1);
    if (!row) {
      console.error(`Competition not found: ${competitionSlug}`);
      process.exit(1);
    }
    competitionId = row.id;
    console.log(`Competition: ${row.name}`);
  }

  console.log(
    `Recomputing standing form (force=${force}, activeOnly=${!allSeasons && !competitionId})…\n`,
  );
  const result = await recomputeStandingForms({
    force,
    competitionId,
    activeOnly: !allSeasons && !competitionId,
  });
  console.log("\nDone:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
