/**
 * Merge orphan "Unknown team …" rows onto canonical clubs, then backfill
 * verified minutes for Bongi Mbonambi's 2025 Sharks URC / Champions Cup apps.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-orphan-teams.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-orphan-teams.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-orphan-teams.ts --skip-minutes
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-orphan-teams.ts --minutes-only
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { eq, sql } from "drizzle-orm";

/** Minutes verified from All.Rugby player sheets (+ match reports / Octafield where checked). */
const BONGI_MINUTES: Array<{
  date: string;
  fixtureSlugPrefix: string;
  minutes: number;
  source: string;
}> = [
  { date: "2025-01-11", fixtureSlugPrefix: "sharks-v-stade-toulousain", minutes: 44, source: "All.Rugby / Gainline (sub 44')" },
  { date: "2025-01-19", fixtureSlugPrefix: "bordeaux-begles-v-sharks", minutes: 54, source: "All.Rugby / Gainline / Rugby365 (sub 54')" },
  { date: "2025-01-25", fixtureSlugPrefix: "cardiff-rugby-v-sharks", minutes: 58, source: "All.Rugby" },
  { date: "2025-02-15", fixtureSlugPrefix: "bulls-v-sharks", minutes: 36, source: "All.Rugby" },
  { date: "2025-03-01", fixtureSlugPrefix: "lions-v-sharks", minutes: 58, source: "All.Rugby" },
  { date: "2025-03-08", fixtureSlugPrefix: "sharks-v-lions", minutes: 48, source: "All.Rugby" },
  { date: "2025-03-22", fixtureSlugPrefix: "sharks-v-zebre", minutes: 55, source: "All.Rugby" },
  { date: "2025-03-29", fixtureSlugPrefix: "sharks-v-leinster", minutes: 66, source: "All.Rugby / Octafield" },
  { date: "2025-04-18", fixtureSlugPrefix: "edinburgh-v-sharks", minutes: 45, source: "All.Rugby" },
  { date: "2025-04-26", fixtureSlugPrefix: "ulster-v-sharks", minutes: 61, source: "All.Rugby / Octafield" },
  { date: "2025-05-09", fixtureSlugPrefix: "sharks-v-ospreys", minutes: 52, source: "All.Rugby" },
  { date: "2025-05-17", fixtureSlugPrefix: "sharks-v-scarlets", minutes: 55, source: "All.Rugby" },
  { date: "2025-05-31", fixtureSlugPrefix: "sharks-v-munster", minutes: 57, source: "All.Rugby" },
  { date: "2025-06-07", fixtureSlugPrefix: "bulls-v-sharks", minutes: 54, source: "All.Rugby / Octafield" },
  { date: "2025-10-11", fixtureSlugPrefix: "leinster-v-sharks", minutes: 28, source: "All.Rugby" },
  { date: "2025-10-18", fixtureSlugPrefix: "sharks-v-ulster", minutes: 58, source: "All.Rugby" },
  { date: "2025-10-25", fixtureSlugPrefix: "sharks-v-scarlets", minutes: 57, source: "All.Rugby" },
];

async function backfillBongiMinutes(dryRun: boolean) {
  const { getDb } = await import("../apps/web/src/lib/db");
  const { playerMatchPerformanceStats, players } = await import("@rugby365/db");

  const db = getDb();
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.slug, "bongi-mbonambi-16m3m3jn"))
    .limit(1);
  if (!player) throw new Error("Bongi Mbonambi player row not found (bongi-mbonambi-16m3m3jn)");

  const updates: Array<{
    date: string;
    fixtureSlug: string;
    minutes: number;
    source: string;
    action: "insert" | "update" | "skip";
  }> = [];

  for (const row of BONGI_MINUTES) {
    const matched = await db.execute<{
      fixture_id: string;
      slug: string;
      season_id: string | null;
      competition_id: string | null;
      team_id: string;
      tries: number;
      points: number;
      existing_id: string | null;
      existing_minutes: number | null;
    }>(sql`
      SELECT f.id AS fixture_id, f.slug, f.season_id, f.competition_id,
             fp.team_id, fp.tries, fp.points,
             pm.id AS existing_id, pm.minutes_played AS existing_minutes
      FROM fixtures f
      JOIN fixture_players fp
        ON fp.fixture_id = f.id AND fp.player_id = ${player.id}::uuid
      LEFT JOIN player_match_performance_stats pm
        ON pm.fixture_id = f.id AND pm.player_id = ${player.id}::uuid
      WHERE f.kickoff_at::date = ${row.date}::date
        AND f.slug LIKE ${`${row.fixtureSlugPrefix}%`}
      ORDER BY
        CASE WHEN f.slug LIKE '%__legacy__%' THEN 1 ELSE 0 END,
        f.slug
      LIMIT 1
    `);

    const fixture = matched[0];
    if (!fixture) {
      updates.push({
        date: row.date,
        fixtureSlug: row.fixtureSlugPrefix,
        minutes: row.minutes,
        source: row.source,
        action: "skip",
      });
      continue;
    }

    if (fixture.existing_id) {
      if (fixture.existing_minutes === row.minutes) {
        updates.push({
          date: row.date,
          fixtureSlug: fixture.slug,
          minutes: row.minutes,
          source: row.source,
          action: "skip",
        });
      } else if (!dryRun) {
        await db
          .update(playerMatchPerformanceStats)
          .set({
            minutesPlayed: row.minutes,
            teamId: fixture.team_id,
            syncedAt: new Date(),
            sourceProvider: "manual-verify",
          })
          .where(eq(playerMatchPerformanceStats.id, fixture.existing_id));
        updates.push({
          date: row.date,
          fixtureSlug: fixture.slug,
          minutes: row.minutes,
          source: row.source,
          action: "update",
        });
      } else {
        updates.push({
          date: row.date,
          fixtureSlug: fixture.slug,
          minutes: row.minutes,
          source: row.source,
          action: "update",
        });
      }
    } else if (!dryRun) {
      await db.insert(playerMatchPerformanceStats).values({
        fixtureId: fixture.fixture_id,
        playerId: player.id,
        teamId: fixture.team_id,
        seasonId: fixture.season_id,
        competitionId: fixture.competition_id,
        minutesPlayed: row.minutes,
        tries: fixture.tries ?? 0,
        points: fixture.points ?? 0,
        sourceProvider: "manual-verify",
        syncedAt: new Date(),
      });
      updates.push({
        date: row.date,
        fixtureSlug: fixture.slug,
        minutes: row.minutes,
        source: row.source,
        action: "insert",
      });
    } else {
      updates.push({
        date: row.date,
        fixtureSlug: fixture.slug,
        minutes: row.minutes,
        source: row.source,
        action: "insert",
      });
    }
  }

  return { playerId: player.id, updates };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipMinutes = process.argv.includes("--skip-minutes");
  const minutesOnly = process.argv.includes("--minutes-only");

  if (!minutesOnly) {
    const { repairOrphanTeams } = await import(
      "../apps/web/src/lib/repair-orphan-teams-service"
    );
    const orphanResult = await repairOrphanTeams({ dryRun });
    console.log(JSON.stringify({ orphanRepair: orphanResult }, null, 2));
  }

  if (!skipMinutes) {
    const minutesResult = await backfillBongiMinutes(dryRun);
    console.log(JSON.stringify({ bongiMinutes: minutesResult }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
