/**
 * Repair Wikipedia debris teams:
 * - {{ru-rt|BRA}}, {{ruu-rt|20|KEN}}, Football kit…, (short-term deal)
 * Remap fixtures/standings onto proper country/club rows, then delete junk.
 *
 * Also clarifies Springboks naming: South Africa shortName = "Springboks".
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-wiki-junk-teams.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-wiki-junk-teams.ts
 */
import { sql } from "drizzle-orm";
import { parseWikiTeamLabel } from "@rugby365/import-sdk";
import { getDb } from "../apps/web/src/lib/db";
import { isJunkTeamName, normalizeTeamName } from "../apps/web/src/lib/entity-normalize";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";

const dryRun = process.argv.includes("--dry-run");

type JunkRow = { id: string; name: string; slug: string };

function intendedName(raw: string): string | null {
  const parsed = parseWikiTeamLabel(raw);
  if (parsed && !isJunkTeamName(parsed) && !/^\{\{/.test(parsed)) {
    const cleaned = normalizeTeamName(parsed);
    if (cleaned && !isJunkTeamName(cleaned)) return cleaned;
  }

  // Transfer-note debris: Exeter Chiefs (short-term deal) / Edinburgh "short-term loan"
  const stripped = raw
    .replace(/\(short[-\s]?term(?:\s+deal|\s+loan)?\)/gi, " ")
    .replace(/["']short[-\s]?term(?:\s+deal|\s+loan)?["']/gi, " ")
    .replace(/\s+"[^"]*short[-\s]?term[^"]*"/gi, " ")
    .replace(/\s+'[^']*short[-\s]?term[^']*'/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    stripped &&
    stripped.toLowerCase() !== raw.toLowerCase() &&
    !isJunkTeamName(stripped) &&
    !/^\{\{/.test(stripped) &&
    !/^ru\s+sf\b/i.test(stripped) &&
    !/short[-\s]?term/i.test(stripped)
  ) {
    return normalizeTeamName(stripped);
  }

  // Bracket / pool placeholders
  if (/^ru\s+sf\b/i.test(raw) || /^winner\b/i.test(raw) || /^loser\b/i.test(raw)) return null;

  return null;
}

async function listJunkTeams(): Promise<JunkRow[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select id, name, slug from teams
    where name like '{{%'
       or name like '%}}%'
       or name ilike '%football kit%'
       or name ilike '%short-term%'
       or name ilike '%short term%'
       or name ilike '%smalldiv%'
       or name ~* '^ru[[:space:]]+sf'
       or slug like 'ru-%'
       or slug like 'ruu-%'
       or slug like 'rua-%'
       or slug like 'rus-%'
       or slug = 'short-term-deal'
       or slug like 'ru-sf-%'
    order by name
  `);
  return (Array.isArray(rows) ? rows : rows.rows ?? []) as JunkRow[];
}

async function reassignAndDelete(junk: JunkRow, targetId: string | null) {
  const db = getDb();
  const junkId = junk.id;

  if (targetId) {
    await db.execute(sql`update fixtures set home_team_id = ${targetId}::uuid where home_team_id = ${junkId}::uuid`);
    await db.execute(sql`update fixtures set away_team_id = ${targetId}::uuid where away_team_id = ${junkId}::uuid`);
    await db.execute(sql`
      delete from standing_rows a
      using standing_rows b
      where a.team_id = ${junkId}::uuid
        and b.team_id = ${targetId}::uuid
        and a.season_id = b.season_id
        and a.view = b.view
    `);
    await db.execute(sql`update standing_rows set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update players set club_team_id = ${targetId}::uuid where club_team_id = ${junkId}::uuid`);
    await db.execute(sql`update players set international_team_id = ${targetId}::uuid where international_team_id = ${junkId}::uuid`);
    await db.execute(sql`update fixture_players set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update match_events set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_transfers set from_team_id = ${targetId}::uuid where from_team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_transfers set to_team_id = ${targetId}::uuid where to_team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_team_memberships set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_career_stints set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update team_match_stats set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_match_performance_stats set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_match_ratings set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_season_stats set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update competition_seasons set champion_team_id = ${targetId}::uuid where champion_team_id = ${junkId}::uuid`);
    await db.execute(sql`update venues set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
    await db.execute(sql`update world_ranking_rows set team_id = ${targetId}::uuid where team_id = ${junkId}::uuid`);
  } else {
    await db.execute(sql`delete from standing_rows where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from fixtures where home_team_id = ${junkId}::uuid or away_team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from fixture_players where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from match_events where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from team_match_stats where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from player_match_performance_stats where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from player_match_ratings where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from player_season_stats where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from player_team_memberships where team_id = ${junkId}::uuid`);
    await db.execute(sql`delete from player_career_stints where team_id = ${junkId}::uuid`);
    await db.execute(sql`update players set club_team_id = null where club_team_id = ${junkId}::uuid`);
    await db.execute(sql`update players set international_team_id = null where international_team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_transfers set from_team_id = null where from_team_id = ${junkId}::uuid`);
    await db.execute(sql`update player_transfers set to_team_id = null where to_team_id = ${junkId}::uuid`);
    await db.execute(sql`update competition_seasons set champion_team_id = null where champion_team_id = ${junkId}::uuid`);
    await db.execute(sql`update venues set team_id = null where team_id = ${junkId}::uuid`);
    await db.execute(sql`update world_ranking_rows set team_id = null where team_id = ${junkId}::uuid`);
  }

  // Best-effort null/delete remaining soft refs, then delete team.
  for (const tableCol of [
    ["coach_match_ratings", "team_id"],
    ["person_intelligence_score_history", "team_id"],
    ["player_injuries", "team_id"],
    ["player_legends", "team_id"],
    ["player_legends", "international_team_id"],
    ["player_radar_caches", "team_id"],
    ["player_selection_trends", "team_id"],
    ["player_suspensions", "team_id"],
    ["squad_audit_clubs", "team_id"],
    ["squad_audit_jobs", "team_id"],
    ["squad_audit_log", "team_id"],
    ["squad_audit_players", "team_id"],
    ["team_coaching_staff", "team_id"],
  ] as const) {
    try {
      if (targetId) {
        await db.execute(
          sql.raw(
            `update ${tableCol[0]} set ${tableCol[1]} = '${targetId}' where ${tableCol[1]} = '${junkId}'`,
          ),
        );
      } else {
        await db.execute(
          sql.raw(`update ${tableCol[0]} set ${tableCol[1]} = null where ${tableCol[1]} = '${junkId}'`),
        );
      }
    } catch {
      // Ignore missing columns / not-null constraints on optional audit tables.
    }
  }

  await db.execute(sql`delete from teams where id = ${junkId}::uuid`);
}

async function fixSpringboksNaming() {
  const db = getDb();
  console.log("\n=== Springboks naming ===");
  if (dryRun) {
    console.log('  would set South Africa short_name="Springboks", team_type=international');
    console.log('  would set Emerging Springboks team_type=development / short_name=Emerging');
    return;
  }
  await db.execute(sql`
    update teams
    set short_name = 'Springboks',
        team_type = coalesce(team_type, 'international')
    where slug = 'south-africa'
  `);
  await db.execute(sql`
    update teams
    set short_name = 'Emerging',
        team_type = 'development'
    where slug = 'emerging-springboks'
  `);
  console.log("  South Africa → shortName Springboks");
  console.log("  Emerging Springboks → development side (kept separate)");
}

async function main() {
  console.log(dryRun ? "=== Dry run ===\n" : "=== Applying wiki junk cleanup ===\n");
  const junk = await listJunkTeams();
  console.log(`Junk / template teams: ${junk.length}`);

  let remapped = 0;
  let deleted = 0;
  let skipped = 0;

  for (const row of junk) {
    const targetName = intendedName(row.name);
    if (!targetName) {
      console.log(`  DELETE unmapped: ${row.name}`);
      if (!dryRun) await reassignAndDelete(row, null);
      deleted += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  REMAP ${row.name} → ${targetName}`);
      remapped += 1;
      continue;
    }

    const target = await resolveTeam({
      name: targetName,
      createIfMissing: true,
      sourceProvider: "wikipedia",
    });
    if (!target) {
      console.log(`  SKIP could not resolve target for ${row.name} → ${targetName}`);
      skipped += 1;
      continue;
    }
    if (target.id === row.id) {
      // Resolved to itself somehow — rename in place.
      await getDb().execute(sql`
        update teams set name = ${targetName}, slug = ${target.slug}
        where id = ${row.id}::uuid
      `);
      console.log(`  RENAME ${row.name} → ${targetName}`);
      remapped += 1;
      continue;
    }

    console.log(`  REMAP ${row.name} → ${target.name} (${target.slug})`);
    await reassignAndDelete(row, target.id);
    remapped += 1;
  }

  await fixSpringboksNaming();

  console.log(
    `\nDone. remapped=${remapped} deleted=${deleted} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
