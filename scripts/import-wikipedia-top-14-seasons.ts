/**
 * Bulk import Top 14 seasons from Wikipedia (tables, fixtures, playoffs).
 *
 * Prefer Planet Rugby / SDMS feeds first for recent seasons, then run this
 * to fill historical gaps (2005–06 onward).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-top-14-seasons.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-top-14-seasons.ts --gaps-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-top-14-seasons.ts --from=2005
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-top-14-seasons.ts --year=2015
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-top-14-seasons.ts --all
 */
import { eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  importWikipediaSeasonPage,
  top14WikipediaSeasonUrls,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const COMPETITION_SLUG = "top-14";
const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/Top_14";

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const gapsOnly = args.includes("--gaps-only") || !args.includes("--all");
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1] ?? null;
const fromYear = Number.parseInt(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "2005", 10);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2500);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function existingSeasonYears(competitionId: string) {
  const db = getDb();
  const rows = await db
    .select({ year: competitionSeasons.year })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));
  return new Set(rows.map((r) => r.year));
}

async function thinSeasonYears(competitionId: string) {
  const thin = await getDb().execute(sql`
    select s.year
    from competition_seasons s
    where s.competition_id = ${competitionId}
      and s.is_deprecated = false
      and (
        not exists (select 1 from standing_rows sr where sr.season_id = s.id and sr.view = 'overall')
        or (
          select count(*) from standing_rows sr where sr.season_id = s.id and sr.view = 'overall'
        ) < 10
      )
  `);
  return new Set((thin as Array<{ year: number }>).map((r) => r.year));
}

async function main() {
  console.log("=== Top 14 Wikipedia import ===");
  console.log(JSON.stringify({ auditOnly, gapsOnly, onlyYear, fromYear, delayMs }, null, 2));

  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) {
    console.error(`Competition ${COMPETITION_SLUG} not found`);
    process.exit(1);
  }

  if (!competition.wikipediaUrl) {
    await db
      .update(competitions)
      .set({ wikipediaUrl: WIKIPEDIA_URL })
      .where(eq(competitions.id, competition.id));
    console.log(`Set Wikipedia URL → ${WIKIPEDIA_URL}`);
  }

  const existingYears = await existingSeasonYears(competition.id);
  let seasons = top14WikipediaSeasonUrls().filter((s) => s.startYear >= fromYear);

  if (onlyYear) {
    seasons = seasons.filter((s) => String(s.startYear) === onlyYear);
  } else if (gapsOnly) {
    const thinYears = await thinSeasonYears(competition.id);
    seasons = seasons.filter((s) => !existingYears.has(s.startYear) || thinYears.has(s.startYear));
  }

  seasons = [...seasons].sort((a, b) => a.startYear - b.startYear);
  console.log(`\n→ Top 14: ${seasons.length} season(s) to import`);
  if (auditOnly) {
    for (const s of seasons) console.log(`  · ${s.startYear} ${s.url}`);
    return;
  }

  const summary = { imported: 0, failed: 0 };
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`  [${index + 1}/${seasons.length}] ${season.startYear} (${season.winner})`);
    console.log(`    ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: COMPETITION_SLUG,
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      summary.imported += 1;
      console.log(
        `    ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found}) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u playoffs ${report.playoffs.created}c/${report.playoffs.updated}u champion=${report.championName ?? "—"}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`    unmapped: ${report.unmappedTeams.slice(0, 8).join(", ")}`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("Catalog size:", top14WikipediaSeasonUrls().length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
