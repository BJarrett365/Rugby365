/**
 * Repair URC historic display quality:
 *  - drop junk Wikipedia footnote "teams" from standing_rows
 *  - force-recompute last-5 form from finished fixtures
 *  - re-import Wikipedia seasons that still have Unknown teams / thin data
 *  - generate TotW for seasons that already have ratings
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-historic-display.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-historic-display.ts --skip-wiki
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-historic-display.ts --from=2001 --to=2012
 */
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures, standingRows, teams } from "@rugby365/db";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import { isJunkTeamName } from "../apps/web/src/lib/entity-normalize";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import { recomputeStandingForms } from "../apps/web/src/lib/standing-form-recompute-service";
import {
  generateTeamOfWeek,
  listRoundsForSeason,
  publishTeamOfWeekEdition,
} from "../apps/web/src/lib/team-of-week-service";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const SLUG = "united-rugby-championship";
const args = process.argv.slice(2);
const skipWiki = args.includes("--skip-wiki");
const skipTotw = args.includes("--skip-totw");
const publishTotw = args.includes("--publish-totw");
const fromYear = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "2001");
const toYear = Number(args.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "2021");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "1500");
const maxTotwRounds = Number(args.find((a) => a.startsWith("--max-totw="))?.split("=")[1] ?? "8");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pull a human team name out of a fixture slug like `leinster-pd9rxo98-v-newport-urc-…`. */
function teamHintsFromSlug(slug: string): { home?: string; away?: string } {
  const base = slug.replace(/-urc-[a-f0-9]+$/i, "").replace(/-[a-f0-9]{8}$/i, "");
  const parts = base.split("-v-");
  if (parts.length < 2) return {};
  const clean = (s: string) =>
    s
      .replace(/-[a-z0-9]{6,}$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  return { home: clean(parts[0]!), away: clean(parts[1]!) };
}

async function dropJunkStandingRows(competitionId: string) {
  const db = getDb();
  const rows = await db.execute(sql`
    select sr.id, t.name
    from standing_rows sr
    join teams t on t.id = sr.team_id
    join competition_seasons cs on cs.id = sr.season_id
    where cs.competition_id = ${competitionId}
  `);
  const list =
    (rows as unknown as { rows?: Array<{ id: string; name: string }> }).rows ??
    (rows as Array<{ id: string; name: string }>);
  let deleted = 0;
  for (const row of list) {
    if (!isJunkTeamName(row.name) && !/source:|bonus point system|includereff/i.test(row.name)) {
      continue;
    }
    await db.delete(standingRows).where(eq(standingRows.id, row.id));
    deleted += 1;
  }
  console.log(`  junk standings deleted=${deleted}`);
}

async function repairUnknownFixtureTeams(competitionId: string) {
  const db = getDb();
  const unknown = await db.execute(sql`
    select f.id, f.slug, f.home_team_id, f.away_team_id, ht.name as home_name, at.name as away_name
    from fixtures f
    left join teams ht on ht.id = f.home_team_id
    left join teams at on at.id = f.away_team_id
    join competition_seasons cs on cs.id = f.season_id
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and (
        ht.name like 'Unknown team%'
        or at.name like 'Unknown team%'
        or f.home_team_id is null
        or f.away_team_id is null
      )
  `);
  const rows =
    (unknown as unknown as { rows?: Array<Record<string, string | null>> }).rows ??
    (unknown as Array<Record<string, string | null>>);

  let repaired = 0;
  for (const row of rows) {
    const hints = teamHintsFromSlug(String(row.slug ?? ""));
    const patch: { homeTeamId?: string; awayTeamId?: string } = {};
    if ((!row.home_name || String(row.home_name).startsWith("Unknown team")) && hints.home) {
      const team = await resolveTeam({ name: hints.home, createIfMissing: true });
      if (team) patch.homeTeamId = team.id;
    }
    if ((!row.away_name || String(row.away_name).startsWith("Unknown team")) && hints.away) {
      const team = await resolveTeam({ name: hints.away, createIfMissing: true });
      if (team) patch.awayTeamId = team.id;
    }
    if (!Object.keys(patch).length) continue;
    await db.update(fixtures).set(patch).where(eq(fixtures.id, String(row.id)));
    repaired += 1;
  }
  console.log(`  unknown fixture teams repaired=${repaired}/${rows.length}`);
}

async function importWikiGaps(competitionId: string) {
  const entry = COMPETITION_IMPORT_CATALOG.find((e) => e.slug === SLUG);
  if (!entry?.wikiSeasons?.length) {
    console.log("  ! no wiki seasons configured");
    return;
  }
  const seasons = entry.wikiSeasons
    .filter((s) => s.startYear >= fromYear && s.startYear <= toYear)
    .sort((a, b) => a.startYear - b.startYear);

  console.log(`  wiki → ${seasons.length} season page(s)`);
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`  [${index + 1}/${seasons.length}] ${season.startYear}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: SLUG,
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      console.log(
        `    ✓ table ${report.table.created}c/${report.table.updated}u fixtures ${report.fixtures.created}c/${report.fixtures.updated}u`,
      );
    } catch (error) {
      console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
    }
  }

  // After wiki, drop any junk that came back.
  await dropJunkStandingRows(competitionId);
}

async function generateTotw(competitionId: string) {
  const db = getDb();
  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.isDeprecated, false)),
    );
  // Prefer seasons that already have ratings (modern URC).
  for (const year of [2023, 2024, 2025]) {
    const season = seasons.find((s) => s.year === year);
    if (!season) continue;
    console.log(`  totw ${season.label}`);
    const rounds = (await listRoundsForSeason({ competitionId, seasonId: season.id }))
      .filter((r) => r.completedCount > 0 && r.ratedPlayerCount >= 8)
      .slice(0, maxTotwRounds);
    let ok = 0;
    for (const round of rounds) {
      try {
        const result = await generateTeamOfWeek({
          competitionId,
          seasonId: season.id,
          roundKey: round.roundKey,
        });
        if (publishTotw) await publishTeamOfWeekEdition(result.editionId);
        ok += 1;
        console.log(`    ✓ ${round.roundKey}`);
      } catch (error) {
        console.error(`    ✗ ${round.roundKey}: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log(`    generated=${ok}/${rounds.length}`);
  }
}

async function main() {
  console.log("=== Repair URC historic display ===");
  console.log(JSON.stringify({ skipWiki, skipTotw, publishTotw, fromYear, toYear, delayMs }, null, 2));

  const db = getDb();
  const [competition] = await db.select().from(competitions).where(eq(competitions.slug, SLUG)).limit(1);
  if (!competition) throw new Error(`Missing ${SLUG}`);

  console.log("\n1) Drop junk standings");
  await dropJunkStandingRows(competition.id);

  console.log("\n2) Repair Unknown fixture teams from slugs");
  await repairUnknownFixtureTeams(competition.id);

  if (!skipWiki) {
    console.log("\n3) Wikipedia re-import (historic)");
    await importWikiGaps(competition.id);
  } else {
    console.log("\n3) Skipped wiki");
  }

  console.log("\n4) Force recompute last-5 form");
  const form = await recomputeStandingForms({
    competitionId: competition.id,
    force: true,
    activeOnly: false,
  });
  console.log("  ", form);

  if (!skipTotw) {
    console.log("\n5) Team of the Week (rated seasons)");
    await generateTotw(competition.id);
  } else {
    console.log("\n5) Skipped TotW");
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
