/**
 * Push Stats Perform ingest rows that the full table sync missed
 * (competition_seasons unique collisions, then memberships + match stats).
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/push-stats-perform-to-supabase.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

loadDotEnv();
const localUrl = process.env.LOCAL_DATABASE_URL?.trim();
if (localUrl) process.env.DATABASE_URL = localUrl;

function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const nested = (result as { rows?: T[] })?.rows;
  return nested ?? [];
}

function jsonSafe(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) out[key] = value.toISOString();
      else out[key] = value;
    }
    return out;
  });
}

async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id",
) {
  if (!rows.length) return { table, upserted: 0 };
  const { getSupabaseServerClient } = await import("../apps/web/src/lib/supabase-server");
  const supabase = await getSupabaseServerClient("service");
  const { error, count } = await supabase.from(table).upsert(jsonSafe(rows), { onConflict, count: "exact" });
  if (error) throw new Error(`${table}: ${error.message}`);
  return { table, upserted: count ?? rows.length };
}

async function main() {
  const { getDb } = await import("../apps/web/src/lib/db");
  const db = getDb();

  const seasons = asRows<Record<string, unknown>>(
    await db.execute(sql`
      select distinct cs.id, cs.competition_id, cs.slug, cs.label, cs.year,
        cs.is_active, cs.is_deprecated, cs.synced_at, cs.source_provider,
        null::uuid as champion_team_id, cs.wikipedia_source_url
      from competition_seasons cs
      where cs.id in (
        select season_id from player_team_memberships
        where source_provider = 'stats_perform' and season_id is not null
        union
        select season_id from fixtures
        where external_match_id = '6qdft9iho5xwdm1uf8l2uvcb8' and season_id is not null
      )
    `),
  );

  const results = [];
  results.push(await upsert("competition_seasons", seasons));

  const fixtures = asRows<Record<string, unknown>>(
    await db.execute(sql`
      select * from fixtures where external_match_id = '6qdft9iho5xwdm1uf8l2uvcb8'
    `),
  );
  results.push(await upsert("fixtures", fixtures));

  const memberships = asRows<Record<string, unknown>>(
    await db.execute(sql`
      select * from player_team_memberships where source_provider = 'stats_perform'
    `),
  );
  for (let i = 0; i < memberships.length; i += 250) {
    results.push(await upsert("player_team_memberships", memberships.slice(i, i + 250)));
  }

  const teamStats = asRows<Record<string, unknown>>(
    await db.execute(sql`
      select * from team_match_stats where source_provider = 'stats_perform'
    `),
  );
  results.push(await upsert("team_match_stats", teamStats));

  const playerStats = asRows<Record<string, unknown>>(
    await db.execute(sql`
      select * from player_match_performance_stats where source_provider = 'stats_perform'
    `),
  );
  results.push(await upsert("player_match_performance_stats", playerStats));

  console.log(JSON.stringify({ seasons: seasons.length, memberships: memberships.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
