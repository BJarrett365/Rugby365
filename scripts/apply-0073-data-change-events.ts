import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const db = getDb();
  const path = join(
    process.cwd(),
    "packages/db/drizzle/0073_data_change_events_recalc_queue.sql",
  );
  const ddl = readFileSync(path, "utf8");
  // Run as a single script — Postgres accepts multiple statements
  await db.execute(sql.raw(ddl));
  console.log("0073 data_change_events + entity_recalc_queue applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
