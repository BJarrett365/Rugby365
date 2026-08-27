/**
 * Snapshot Rugby World Cup team identity + coach completeness on the connected DB.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { teamDedupKey } from "../apps/web/src/lib/entity-normalize";
import { canonicalStandingsTeamName } from "../apps/web/src/lib/table-lab/standings-fixture-dedupe";

async function main() {
  const db = getDb();

  const unknown = await db.execute(sql`
    SELECT t.id, t.name, t.slug
    FROM teams t
    JOIN fixtures f ON f.home_team_id = t.id OR f.away_team_id = t.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND (t.name ILIKE 'Unknown team%' OR t.slug LIKE 'orphan-%')
    GROUP BY t.id, t.name, t.slug
    ORDER BY t.name
  `);
  console.log(`RWC unknown/orphan teams: ${[...unknown].length}`);
  for (const row of unknown) {
    console.log(`  ${row.name}  ${row.slug}`);
  }

  const rwcTeams = await db.execute(sql`
    SELECT t.id, t.name, t.slug, count(*)::int AS fixtures
    FROM teams t
    JOIN fixtures f ON f.home_team_id = t.id OR f.away_team_id = t.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND coalesce(f.stage, '') <> 'stats_seed'
      AND coalesce(f.round, '') <> 'stats_seed'
      AND coalesce(f.external_match_id, '') NOT LIKE 'rwc-wiki-statistics:%'
      AND coalesce(f.external_match_id, '') NOT LIKE 'rwc-opta-leaderboard:%'
    GROUP BY t.id, t.name, t.slug
    ORDER BY t.name, t.slug
  `);
  const groups = new Map<string, Array<{ id: string; name: string; slug: string; fixtures: number }>>();
  for (const row of rwcTeams) {
    const key = teamDedupKey(canonicalStandingsTeamName(String(row.name ?? "")));
    const bucket = groups.get(key) ?? [];
    bucket.push({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      fixtures: Number(row.fixtures),
    });
    groups.set(key, bucket);
  }
  const dups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  console.log(`\nRWC fixture teams: ${[...rwcTeams].length}; duplicate identity groups: ${dups.length}`);
  for (const [key, rows] of dups) {
    console.log(`  ${key}`);
    for (const row of rows) {
      console.log(`    ${row.fixtures}fx  ${row.name}  ${row.slug}`);
    }
  }

  const coachStats = await db.execute(sql`
    SELECT
      count(*)::int AS coaches,
      count(wikipedia_url)::int AS wikipedia,
      count(image_url)::int AS images,
      count(bio_summary)::int AS bios,
      count(birth_date)::int AS dobs,
      count(nationality)::int AS nationality
    FROM coaches
  `);
  const extra = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM team_coaching_staff) AS assignments,
      (SELECT count(*) FROM team_coaching_staff WHERE is_current) AS current_assignments,
      (SELECT count(DISTINCT coach_id) FROM team_coaching_staff) AS coaches_with_assignment,
      (SELECT count(*) FROM coach_honours) AS honours,
      (SELECT count(*) FROM coach_playing_stints) AS playing_stints,
      (SELECT count(*) FROM coaches WHERE wikipedia_url IS NOT NULL AND (bio_summary IS NULL OR image_url IS NULL)) AS wiki_but_thin
  `);
  console.log("\nCoaches:", [...coachStats][0]);
  console.log("Coach extras:", [...extra][0]);

  const sample = await db.execute(sql`
    SELECT c.name, c.nationality, c.birth_date IS NOT NULL AS has_dob,
           c.bio_summary IS NOT NULL AS has_bio, c.wikipedia_url IS NOT NULL AS has_wiki,
           c.image_url IS NOT NULL AS has_image,
           (SELECT count(*) FROM team_coaching_staff s WHERE s.coach_id = c.id) AS assignments,
           (SELECT count(*) FROM coach_honours h WHERE h.coach_id = c.id) AS honours
    FROM coaches c
    ORDER BY c.name
    LIMIT 15
  `);
  console.log("\nSample coaches:");
  for (const row of sample) {
    console.log(
      `  ${row.name} nat=${row.nationality ?? "—"} dob=${row.has_dob} bio=${row.has_bio} wiki=${row.has_wiki} img=${row.has_image} assign=${row.assignments} honours=${row.honours}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
