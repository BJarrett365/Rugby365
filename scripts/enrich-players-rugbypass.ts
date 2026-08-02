/**
 * Backfill missing player profile fields from RugbyPass player pages.
 *
 * There is no RugbyPass API key in this project — enrichment scrapes public
 * /players/{slug}/ HTML and merges DOB, height, weight, position, nationality,
 * club, bio, and recent match appearances (fill-missing only).
 * Player images are intentionally skipped — use the dedicated image API.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --all --profiles-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --limit=50
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --competition=premiership --limit=200
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --days=365 --limit=500 --delay=800
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-players-rugbypass.ts --profiles-only --limit=400
 */
import { eq, sql } from "drizzle-orm";
import { createDb, players } from "@rugby365/db";
import { enrichPlayerFromRugbyPass } from "../apps/web/src/lib/rugbypass-player-import-service";

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const profilesOnly = args.includes("--profiles-only");
const allPlayers = args.includes("--all");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : allPlayers ? 100_000 : 100;
const daysArg = args.find((a) => a.startsWith("--days="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 180;
const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 450;
const competitionArg = args.find((a) => a.startsWith("--competition="));
const competitionSlug = competitionArg ? competitionArg.split("=")[1] : null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function coverage() {
  const db = createDb();
  const [cov] = await db.execute(sql`
    select
      count(*)::int as players,
      count(*) filter (where rugbypass_synced_at is not null)::int as synced,
      count(*) filter (where birth_date is not null)::int as with_dob,
      count(*) filter (where height_cm is not null)::int as with_height,
      count(*) filter (where weight_kg is not null)::int as with_weight,
      count(*) filter (where coalesce(country_name, '') <> '')::int as with_country,
      count(*) filter (where coalesce(bio_summary, '') <> '')::int as with_bio
    from players
  `);
  return cov as Record<string, number>;
}

async function markAttempted(playerId: string) {
  const db = createDb();
  await db
    .update(players)
    .set({ rugbypassSyncedAt: new Date() })
    .where(eq(players.id, playerId));
}

async function candidates() {
  const db = createDb();

  // Missing image alone is not a RugbyPass candidate — images use a separate API.
  const incompleteFilter = sql`and p.rugbypass_synced_at is null
      and (
        p.birth_date is null
        or p.height_cm is null
        or p.weight_kg is null
        or coalesce(p.country_name, '') = ''
        or coalesce(p.position_name, '') = ''
      )`;

  if (allPlayers && !competitionSlug) {
    const rows = await db.execute(sql`
      select
        p.id,
        p.name,
        p.slug,
        0::int as appearance_count
      from players p
      where true
        ${incompleteFilter}
      order by p.name asc
      limit ${limit}
    `);
    return rows as Array<{
      id: string;
      name: string;
      slug: string;
      appearance_count: number;
    }>;
  }

  const competitionFilter = competitionSlug
    ? sql`and c.slug = ${competitionSlug}`
    : sql``;

  const rows = await db.execute(sql`
    select
      p.id,
      p.name,
      p.slug,
      count(*)::int as appearance_count
    from players p
    join fixture_players fp on fp.player_id = p.id
    join fixtures f on f.id = fp.fixture_id
    join competitions c on c.id = f.competition_id
    where f.kickoff_at > now() - (${days}::int * interval '1 day')
      ${competitionFilter}
      ${incompleteFilter}
    group by p.id
    order by count(*) desc, p.name asc
    limit ${limit}
  `);

  return rows as Array<{
    id: string;
    name: string;
    slug: string;
    appearance_count: number;
  }>;
}

async function main() {
  console.log("=== RugbyPass player enrichment ===");
  console.log(
    JSON.stringify(
      {
        auditOnly,
        profilesOnly,
        allPlayers,
        limit,
        days,
        delayMs,
        competitionSlug,
        skipImages: true,
      },
      null,
      2,
    ),
  );

  const before = await coverage();
  console.log("Coverage before:", before);

  const list = await candidates();
  console.log(`Candidates: ${list.length}`);
  const etaMin = Math.round((list.length * (delayMs + 1200)) / 60000);
  console.log(`Estimated runtime ~${etaMin} minutes (delay ${delayMs}ms + fetch)`);

  if (auditOnly) {
    for (const row of list.slice(0, 25)) {
      console.log(`  · ${row.name} (${row.slug}) appearances=${row.appearance_count}`);
    }
    return;
  }

  const summary = {
    processed: 0,
    enriched: 0,
    notFound: 0,
    nameMismatch: 0,
    otherSkip: 0,
    fields: {} as Record<string, number>,
    matchesImported: 0,
    matchesLinked: 0,
  };

  for (let i = 0; i < list.length; i++) {
    const row = list[i]!;
    summary.processed += 1;
    const result = await enrichPlayerFromRugbyPass(row.id, undefined, {
      skipMatches: profilesOnly,
    });
    if (result.enriched) {
      summary.enriched += 1;
      summary.matchesImported += result.matchesImported ?? 0;
      summary.matchesLinked += result.matchesLinked ?? 0;
      for (const field of result.fieldsUpdated ?? []) {
        summary.fields[field] = (summary.fields[field] ?? 0) + 1;
      }
      console.log(
        `[${i + 1}/${list.length}] ${row.name} — enriched (${(result.fieldsUpdated ?? []).join(",") || "link only"}; matches ${result.matchesImported ?? 0})`,
      );
    } else {
      const reason = result.reason ?? "unknown";
      if (reason === "not_found_on_rugbypass") {
        summary.notFound += 1;
        // Mark attempted so we don't retry forever on missing RugbyPass pages.
        try {
          await markAttempted(row.id);
        } catch {
          /* ignore */
        }
      } else if (reason === "name_mismatch") {
        summary.nameMismatch += 1;
        try {
          await markAttempted(row.id);
        } catch {
          /* ignore */
        }
      } else {
        summary.otherSkip += 1;
      }
      console.log(`[${i + 1}/${list.length}] ${row.name} — skip (${reason})`);
      if (reason === "transient_db_error") {
        console.log("Transient DB error — waiting 5s before continue…");
        await sleep(5000);
      }
    }

    // Progress snapshot every 100 players
    if ((i + 1) % 100 === 0) {
      const mid = await coverage();
      console.log(`--- progress ${i + 1}/${list.length} — synced=${mid.synced} dob=${mid.with_dob} height=${mid.with_height} ---`);
    }

    if (i < list.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const after = await coverage();
  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("Coverage after:", after);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
