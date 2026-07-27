import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

function poolMax(): number {
  const fromEnv = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  // Keep dev pools small — Next.js HMR can otherwise exhaust max_connections.
  return process.env.NODE_ENV === "production" ? 10 : 4;
}

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgresql://rugby365:rugby365@localhost:5433/rugby365";
  const client = postgres(url, {
    max: poolMax(),
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
