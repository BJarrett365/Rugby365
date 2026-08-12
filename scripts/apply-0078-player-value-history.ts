import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1 });
  const file = resolve(__dirname, "../packages/db/drizzle/0078_player_value_history.sql");
  const body = readFileSync(file, "utf8");
  await sql.unsafe(body);
  console.log("Applied 0078_player_value_history.sql");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
