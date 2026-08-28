/**
 * Collapse duplicate Rugby World Cup fixtures (same nations on the same day)
 * onto one canonical match using the existing fixture merge helper.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-duplicate-fixtures.ts --dry-run
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-duplicate-fixtures.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { mergeFixtureDuplicatePair } from "../apps/web/src/lib/fixture-dedupe-service";
import {
  resolveTeamNamesFromFixtureSlug,
  scoreFixtureForStandingsDedupe,
  standingsMatchDayKey,
  type StandingsDedupeFixtureMeta,
} from "../apps/web/src/lib/table-lab/standings-fixture-dedupe";

const dryRun = process.argv.includes("--dry-run");

type Row = StandingsDedupeFixtureMeta;

async function main() {
  const db = getDb();
  const rows = await db.execute<Row>(sql`
    SELECT
      f.id,
      f.slug,
      f.status,
      coalesce(f.home_score, 0)::int AS "homeScore",
      coalesce(f.away_score, 0)::int AS "awayScore",
      coalesce(ht.name, '') AS "homeName",
      coalesce(at.name, '') AS "awayName",
      f.kickoff_at AS "kickoffAt"
    FROM fixtures f
    JOIN competitions c ON c.id = f.competition_id
    LEFT JOIN teams ht ON ht.id = f.home_team_id
    LEFT JOIN teams at ON at.id = f.away_team_id
    WHERE c.slug = 'rugby-world-cup'
      AND coalesce(f.stage, '') <> 'stats_seed'
      AND coalesce(f.round, '') <> 'stats_seed'
      AND coalesce(f.external_match_id, '') NOT LIKE 'rwc-wiki-statistics:%'
      AND coalesce(f.external_match_id, '') NOT LIKE 'rwc-opta-leaderboard:%'
  `);

  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const resolved = resolveTeamNamesFromFixtureSlug(row.slug, row.homeName, row.awayName);
    const meta = { ...row, homeName: resolved.homeName, awayName: resolved.awayName };
    if (!meta.kickoffAt) continue;
    const key = standingsMatchDayKey(meta.kickoffAt, meta.homeName, meta.awayName);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(meta);
    buckets.set(key, list);
  }

  const groups = [...buckets.values()].filter((list) => list.length > 1);
  console.log(
    `RWC fixtures=${[...rows].length} duplicate match-days=${groups.length} extra=${groups.reduce((n, g) => n + g.length - 1, 0)} dryRun=${dryRun}`,
  );

  let merged = 0;
  for (const group of groups) {
    const ranked = [...group].sort(
      (a, b) => scoreFixtureForStandingsDedupe(b) - scoreFixtureForStandingsDedupe(a) || a.slug.localeCompare(b.slug),
    );
    const keeper = ranked[0]!;
    for (const loser of ranked.slice(1)) {
      console.log(`  ${dryRun ? "would merge" : "merge"} ${loser.slug} → ${keeper.slug}`);
      if (dryRun) continue;
      await mergeFixtureDuplicatePair({ keeperId: keeper.id, loserId: loser.id });
      merged += 1;
    }
  }
  if (!dryRun) console.log(`Done. merged=${merged}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
