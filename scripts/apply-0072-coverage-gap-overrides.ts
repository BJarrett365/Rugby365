import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  await db.execute(sql`
    alter table coaches
    add column if not exists coverage_gap_overrides jsonb not null default '{}'::jsonb
  `);
  console.log("0072 coverage_gap_overrides applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
