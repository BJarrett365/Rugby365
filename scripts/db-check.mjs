import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://rugby365:rugby365@localhost:5433/rugby365";

try {
  const sql = postgres(url, { max: 1, connect_timeout: 5 });
  await sql`select 1 as ok`;
  await sql.end();
  console.log(`Database OK (${url.replace(/:[^:@/]+@/, ":****@")})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database not reachable on port 5433.");
  console.error(message);
  console.error("");
  console.error("Start Postgres, then migrate and seed:");
  console.error("  npm run db:up");
  process.exit(1);
}
