import dns from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// macOS often tries IPv6 first for Supabase pooler hosts; that stall exhausts the tiny
// postgres.js pool and leaves CMS list pages spinning until the TCP timeout.
dns.setDefaultResultOrder("ipv4first");

function poolMax(): number {
  const fromEnv = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  // Keep dev pools small — Next.js HMR can otherwise exhaust max_connections.
  return process.env.NODE_ENV === "production" ? 10 : 8;
}

function isTransactionPooler(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("pooler.supabase.com") || parsed.port === "6543";
  } catch {
    return false;
  }
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
    connect_timeout: 15,
    // PgBouncer transaction mode (Supabase :6543) cannot use named prepared statements.
    prepare: !isTransactionPooler(url),
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
