/**
 * Merge duplicate Rugby World Cup nation rows (legacy clones, wrmru copies,
 * All Blacks vs New Zealand) onto one canonical team per country.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-duplicate-teams.ts --dry-run
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-duplicate-teams.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { mergeTeamRecords } from "../apps/web/src/lib/entity-dedup-service";
import {
  canonicalStandingsTeamName,
  isUnknownStandingsTeamName,
  pickCanonicalTeamIdByName,
} from "../apps/web/src/lib/table-lab/standings-fixture-dedupe";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    name: string;
    slug: string;
    fixtures: number;
  }>(sql`
    SELECT t.id, t.name, t.slug, count(*)::int AS fixtures
    FROM teams t
    JOIN fixtures f ON f.home_team_id = t.id OR f.away_team_id = t.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND coalesce(f.stage, '') <> 'stats_seed'
      AND coalesce(f.round, '') <> 'stats_seed'
    GROUP BY t.id, t.name, t.slug
  `);

  const groups = new Map<string, Array<{ id: string; name: string; slug: string; fixtures: number }>>();
  for (const row of rows) {
    const name = canonicalStandingsTeamName(row.name);
    if (isUnknownStandingsTeamName(name)) continue;
    const key = name.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const planned: Array<{ canonicalId: string; canonicalName: string; duplicateIds: string[] }> = [];
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    const canonical = pickCanonicalTeamIdByName(members);
    const kept =
      [...canonical.values()][0] ??
      [...members].sort((a, b) => b.fixtures - a.fixtures || a.slug.length - b.slug.length)[0]!;
    const duplicateIds = members.map((m) => m.id).filter((id) => id !== kept.id);
    if (!duplicateIds.length) continue;
    planned.push({
      canonicalId: kept.id,
      canonicalName: kept.name,
      duplicateIds,
    });
    console.log(
      `${kept.name}: keep ${kept.id.slice(0, 8)}… merge ${duplicateIds.length} (${members.map((m) => m.slug).join(", ")})`,
    );
  }

  console.log(`Duplicate RWC nation groups: ${planned.length}; dryRun=${dryRun}`);
  if (dryRun) return;

  let merged = 0;
  for (const group of planned) {
    await mergeTeamRecords(group.canonicalId, group.duplicateIds, {
      displayName: group.canonicalName,
    });
    merged += group.duplicateIds.length;
  }
  console.log(`Done. merged=${merged}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
