import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const path = join(
    process.cwd(),
    "packages/db/drizzle/0075_world_ranking_movements.sql",
  );
  const ddl = readFileSync(path, "utf8");
  await db.execute(sql.raw(ddl));
  console.log("0075 world_ranking_movements applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
