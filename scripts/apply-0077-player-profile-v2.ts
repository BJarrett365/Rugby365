import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1 });
  const file = resolve(__dirname, "../packages/db/drizzle/0077_player_profile_v2_foundation.sql");
  const body = readFileSync(file, "utf8");
  await sql.unsafe(body);
  console.log("Applied 0077_player_profile_v2_foundation.sql");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
