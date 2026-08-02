/**
 * 1) Remove pure-numeric junk teams (Wikipedia table ranks imported as clubs).
 * 2) Recompute standing_rows.form from finished fixtures where form is blank/dashy.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-junk-teams-and-standing-form.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-junk-teams-and-standing-form.ts --dry-run
 */
import { and, eq, sql } from "drizzle-orm";
import { standingRows } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  computeFormSequenceFromFixtures,
  parseStandingForm,
  standingFormNeedsRecompute,
} from "../apps/web/src/lib/standing-form";

const dryRun = process.argv.includes("--dry-run");
const forceForm = process.argv.includes("--force-form");
const formOnly = process.argv.includes("--form-only");

async function purgeNumericJunkTeams() {
  const db = getDb();
  const junk = (await db.execute(sql`
    select id, name, slug from teams
    where name ~ '^[0-9]+$' or slug ~ '^[0-9]+$'
  `)) as unknown as Array<{ id: string; name: string; slug: string }>;

  console.log(`Numeric junk teams: ${junk.length}`);
  if (!junk.length) return 0;

  for (const team of junk) {
    console.log(`  ${team.name} (${team.slug})`);
  }

  if (dryRun) return junk.length;

  const ids = junk.map((t) => t.id);
  await db.execute(sql`
    delete from standing_rows where team_id in ${sql`(${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`}
  `);
  await db.execute(sql`
    delete from fixtures where home_team_id in ${sql`(${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`}
    or away_team_id in ${sql`(${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`}
  `);
  // Only delete teams that still have no FK references.
  const deleted = await db.execute(sql`
    delete from teams t
    where t.id in ${sql`(${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`}
      and not exists (select 1 from fixture_players fp where fp.team_id = t.id)
      and not exists (select 1 from fixtures f where f.home_team_id = t.id or f.away_team_id = t.id)
      and not exists (select 1 from standing_rows sr where sr.team_id = t.id)
      and not exists (select 1 from players p where p.club_team_id = t.id or p.international_team_id = t.id)
    returning t.id
  `);
  console.log(`Deleted ${Array.isArray(deleted) ? deleted.length : 0} junk teams`);
  return junk.length;
}

async function recomputeStandingForm() {
  const db = getDb();
  const seasons = (await db.execute(
    forceForm
      ? sql`
    select distinct cs.id as season_id, cs.label, c.slug, c.name
    from competition_seasons cs
    join competitions c on c.id = cs.competition_id
    join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    where cs.is_deprecated = false
      and exists (
        select 1 from fixtures f
        where f.season_id = cs.id
          and f.home_score is not null
          and f.away_score is not null
          and not (f.home_score = 0 and f.away_score = 0)
      )
    order by c.name, cs.label
  `
      : sql`
    select distinct cs.id as season_id, cs.label, c.slug, c.name
    from competition_seasons cs
    join competitions c on c.id = cs.competition_id
    join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    where cs.is_deprecated = false
      and (
        sr.form is null
        or sr.form = ''
        or sr.form ~ '^-+$'
        or sr.form ~ '^-{1,}[WDL]-*$'
        or sr.form ~ '^D+$'
        or (sr.played > 0 and (sr.form is null or sr.form = ''))
      )
      and exists (
        select 1 from fixtures f
        where f.season_id = cs.id
          and f.home_score is not null
          and f.away_score is not null
          and not (f.home_score = 0 and f.away_score = 0)
      )
    order by c.name, cs.label
  `,
  )) as unknown as Array<{ season_id: string; label: string; slug: string; name: string }>;

  console.log(`\nSeasons needing form recompute: ${seasons.length}`);
  let updated = 0;

  for (const season of seasons) {
    const fixtures = (await db.execute(sql`
      select home_team_id, away_team_id, home_score, away_score, kickoff_at
      from fixtures
      where season_id = ${season.season_id}
        and home_score is not null
        and away_score is not null
        and not (home_score = 0 and away_score = 0)
        and status in ('full_time', 'result', 'complete', 'finished')
      order by kickoff_at nulls last
    `)) as unknown as Array<{
      home_team_id: string;
      away_team_id: string;
      home_score: number;
      away_score: number;
      kickoff_at: Date | string | null;
    }>;

    // Fall back: any scored fixture if status labels differ.
    const scored =
      fixtures.length > 0
        ? fixtures
        : ((await db.execute(sql`
            select home_team_id, away_team_id, home_score, away_score, kickoff_at
            from fixtures
            where season_id = ${season.season_id}
              and home_score is not null
              and away_score is not null
              and not (home_score = 0 and away_score = 0)
            order by kickoff_at nulls last
          `)) as unknown as typeof fixtures);

    const rows = (await db.execute(sql`
      select sr.id, sr.team_id, sr.form, sr.played, t.name as team_name
      from standing_rows sr
      join teams t on t.id = sr.team_id
      where sr.season_id = ${season.season_id} and sr.view = 'overall'
    `)) as unknown as Array<{
      id: string;
      team_id: string;
      form: string | null;
      played: number;
      team_name: string;
    }>;

    const teamNameById = new Map<string, string>();
    const teamIdsByName = new Map<string, string[]>();
    const allSeasonTeams = (await db.execute(sql`
      select distinct t.id, lower(trim(t.name)) as name
      from fixtures f
      join teams t on t.id in (f.home_team_id, f.away_team_id)
      where f.season_id = ${season.season_id}
    `)) as unknown as Array<{ id: string; name: string }>;
    for (const team of allSeasonTeams) {
      teamNameById.set(team.id, team.name);
      const bucket = teamIdsByName.get(team.name) ?? [];
      bucket.push(team.id);
      teamIdsByName.set(team.name, bucket);
    }
    // Common nation aliases used across providers.
    const aliases: Record<string, string[]> = {
      "united states": ["usa", "us", "united states of america"],
      usa: ["united states", "us", "united states of america"],
      "hong kong": ["hong kong china", "hong kong, china"],
      "hong kong china": ["hong kong"],
    };

    let seasonUpdated = 0;
    for (const row of rows) {
      const letters = (parseStandingForm(row.form).lastFive ?? "").replace(/-/g, "").length;
      const expected = Math.min(Math.max(row.played ?? 0, 0), 5);
      const weakForm =
        forceForm ||
        standingFormNeedsRecompute(row.form) ||
        (expected > 0 && letters < expected) ||
        // All-draw sequences are usually 0-0 placeholders, not real rugby results.
        /^D+$/.test((parseStandingForm(row.form).lastFive ?? "").replace(/-/g, ""));
      if (!weakForm) continue;

      const key = row.team_name.trim().toLowerCase();
      const relatedIds = new Set<string>([row.team_id, ...(teamIdsByName.get(key) ?? [])]);
      for (const alias of aliases[key] ?? []) {
        for (const id of teamIdsByName.get(alias) ?? []) relatedIds.add(id);
      }

      const form = computeFormSequenceFromFixtures(
        row.team_id,
        scored.flatMap((f) => {
          const homeMatch = relatedIds.has(f.home_team_id);
          const awayMatch = relatedIds.has(f.away_team_id);
          if (!homeMatch && !awayMatch) return [];
          // Rewrite fixture sides onto the standing team id so the helper matches.
          return [
            {
              teamId: row.team_id,
              homeTeamId: homeMatch ? row.team_id : f.home_team_id,
              awayTeamId: awayMatch ? row.team_id : f.away_team_id,
              homeScore: f.home_score,
              awayScore: f.away_score,
              kickoffAt: f.kickoff_at,
            },
          ];
        }),
        5,
      );
      if (!form) {
        if (forceForm && row.form && !dryRun) {
          await db.update(standingRows).set({ form: null }).where(eq(standingRows.id, row.id));
          seasonUpdated += 1;
        }
        continue;
      }
      if (dryRun) {
        seasonUpdated += 1;
        continue;
      }
      await db.update(standingRows).set({ form }).where(eq(standingRows.id, row.id));
      seasonUpdated += 1;
    }

    if (seasonUpdated) {
      console.log(`  ${season.name} ${season.label}: ${seasonUpdated} form row(s)`);
      updated += seasonUpdated;
    }
  }

  return updated;
}

async function rerankDidiSeasons() {
  const db = getDb();
  const seasons = (await db.execute(sql`
    select cs.id, cs.label
    from competition_seasons cs
    join competitions c on c.id = cs.competition_id
    where c.slug = 'didi-10' and cs.is_deprecated = false
  `)) as unknown as Array<{ id: string; label: string }>;

  for (const season of seasons) {
    const rows = (await db.execute(sql`
      select sr.id
      from standing_rows sr
      join teams t on t.id = sr.team_id
      where sr.season_id = ${season.id} and sr.view = 'overall'
        and t.name !~ '^[0-9]+$'
      order by sr.points desc, sr.points_diff desc, t.name
    `)) as unknown as Array<{ id: string }>;
    if (dryRun) {
      console.log(`  didi ${season.label}: would keep ${rows.length} real teams`);
      continue;
    }
    let rank = 0;
    for (const row of rows) {
      rank += 1;
      await db.update(standingRows).set({ rank }).where(eq(standingRows.id, row.id));
    }
    console.log(`  didi ${season.label}: reranked ${rows.length} teams`);
  }
}

async function main() {
  console.log(dryRun ? "=== Dry run ===\n" : "=== Applying cleanup ===\n");
  if (!formOnly) {
    await purgeNumericJunkTeams();
    console.log("\n=== Rerank Didi 10 ===");
    await rerankDidiSeasons();
  }
  console.log("\n=== Recompute standing form ===");
  const updated = await recomputeStandingForm();
  console.log(`\nForm rows ${dryRun ? "would update" : "updated"}: ${updated}`);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
