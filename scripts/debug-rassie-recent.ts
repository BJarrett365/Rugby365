import { inArray } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";

async function main() {
  const matches = await loadCoachEligibleMatches("dbe4562a-7255-42c4-bb70-653153c4da3c", {
    limit: 24,
  });
  console.log("eligible", matches.length);
  const ids = matches.map((m) => m.id);
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      kickoffAt: fixtures.kickoffAt,
      hs: fixtures.homeScore,
      as: fixtures.awayScore,
    })
    .from(fixtures)
    .where(inArray(fixtures.id, ids));
  const statuses: Record<string, number> = {};
  for (const r of rows) {
    const k = r.status || "null";
    statuses[k] = (statuses[k] || 0) + 1;
  }
  console.log("db rows", rows.length, "statuses", statuses);
  const completed = rows.filter((m) => {
    const s = (m.status || "").toLowerCase();
    return s.includes("complete") || s.includes("finish") || s === "result" || s === "ft";
  });
  console.log("public filter completed", completed.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
