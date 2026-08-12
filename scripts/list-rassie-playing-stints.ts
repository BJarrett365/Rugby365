import { eq, asc } from "drizzle-orm";
import { coachPlayingStints } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(coachPlayingStints)
    .where(eq(coachPlayingStints.coachId, RASSIE))
    .orderBy(asc(coachPlayingStints.sortOrder), asc(coachPlayingStints.startYear));

  for (const r of rows) {
    console.log(
      [
        r.sortOrder,
        r.yearsLabel,
        r.teamName,
        r.teamDisplayName ?? "",
        r.teamType,
        r.careerType,
        r.apps,
        r.points,
        r.teamId?.slice(0, 8) ?? "no-team",
        r.showOnOverview,
        r.recordStatus,
      ].join(" | "),
    );
  }
  console.log("count", rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
