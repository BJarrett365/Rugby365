/**
 * Merge "Unknown team …" placeholders that appear on Rugby World Cup fixtures
 * onto the canonical nation rows (inferred from fixture slugs).
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-orphan-teams.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/repair-rwc-orphan-teams.ts --dry-run
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { inferOrphanClubVotes } from "../apps/web/src/lib/repair-orphan-teams-service";
import { mergeTeamRecords } from "../apps/web/src/lib/entity-dedup-service";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  const rwcOrphans = await db.execute<{ team_id: string }>(sql`
    SELECT DISTINCT t.id AS team_id
    FROM teams t
    JOIN fixtures f ON f.home_team_id = t.id OR f.away_team_id = t.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND (t.name ILIKE 'Unknown team%' OR t.slug LIKE 'orphan-%')
  `);
  const rwcIds = new Set<string>();
  for (const row of rwcOrphans) rwcIds.add(row.team_id);
  const votes = await inferOrphanClubVotes();
  const planned = votes.filter((vote) => rwcIds.has(vote.orphanId) && vote.canonicalId);

  console.log(`RWC unknown teams: ${rwcIds.size}; mergeable: ${planned.length}; dryRun=${dryRun}`);
  for (const vote of planned) {
    console.log(`  ${vote.orphanId.slice(0, 8)}… → ${vote.canonicalName} (votes ${vote.votes})`);
  }

  if (dryRun) return;

  const byCanonical = new Map<string, string[]>();
  for (const vote of planned) {
    const list = byCanonical.get(vote.canonicalId!) ?? [];
    list.push(vote.orphanId);
    byCanonical.set(vote.canonicalId!, list);
  }

  let merged = 0;
  for (const [canonicalId, dupes] of byCanonical) {
    const ids = dupes.filter((id) => id !== canonicalId);
    if (!ids.length) continue;
    await mergeTeamRecords(canonicalId, ids);
    merged += ids.length;
    console.log(`merged ${ids.length} onto ${canonicalId.slice(0, 8)}…`);
  }
  console.log(`Done. merged=${merged}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
