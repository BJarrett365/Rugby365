/**
 * Import Rugby World Cup match results from Wikipedia (fixtures, playoffs,
 * venues, referees, attendance, and rugby-box scoring events when present).
 *
 * By default imports seasons that look thin in the DB (below expected match counts).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-world-cup-seasons.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-world-cup-seasons.ts --year=1995
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-rugby-world-cup-seasons.ts --all
 */
import { eq, sql } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  importWikipediaSeasonPage,
  rugbyWorldCupWikipediaSeasonUrls,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const importAll = args.includes("--all");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2500);

/** Rough full-tournament sizes used to decide whether a season still needs importing. */
function expectedMatchCount(year: number): number {
  if (year <= 1995) return 32;
  if (year === 1999) return 41;
  return 48;
}

async function thinSeasonYears(): Promise<number[]> {
  const db = getDb();
  const [comp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!comp) return [1995, 2007, 2015];

  const rows = await db.execute(sql`
    select s.year, count(f.id)::int as fixtures
    from competition_seasons s
    left join fixtures f on f.season_id = s.id
    where s.competition_id = ${comp.id}
      and s.year <= 2023
    group by s.year
    order by s.year
  `);

  const thin: number[] = [];
  for (const row of rows as Array<{ year: number; fixtures: number }>) {
    if (row.fixtures < expectedMatchCount(row.year)) thin.push(row.year);
  }

  // Always include known empty/historically missing years even if season row absent.
  for (const year of [1995, 2007, 2015]) {
    if (!thin.includes(year)) {
      const hasSeason = (rows as Array<{ year: number }>).some((r) => r.year === year);
      if (!hasSeason) thin.push(year);
    }
  }

  return [...new Set(thin)].sort((a, b) => a - b);
}

async function main() {
  let seasons = rugbyWorldCupWikipediaSeasonUrls()
    .filter((s) => s.startYear <= 2023)
    .sort((a, b) => a.startYear - b.startYear);

  if (onlyYear) {
    seasons = seasons.filter((s) => String(s.startYear) === onlyYear);
  } else if (!importAll) {
    const thin = await thinSeasonYears();
    console.log(`Thin / missing seasons detected: ${thin.join(", ") || "(none)"}`);
    seasons = seasons.filter((s) => thin.includes(s.startYear));
  }

  if (!seasons.length) {
    console.log("Nothing to import — all RWC seasons look complete.");
    return;
  }

  console.log(`Importing ${seasons.length} Rugby World Cup season(s) from Wikipedia…\n`);

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, delayMs));
    console.log(`→ ${season.startYear} (${season.winner})`);
    console.log(`  ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: "rugby-world-cup",
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
        importAttendance: true,
        importTable: false, // keep scraped official/UR pool tables
      });
      console.log(
        `  ✓ fixtures ${report.fixtures.created}c/${report.fixtures.updated}u/${report.fixtures.found}found` +
          ` playoffs ${report.playoffs.created}c/${report.playoffs.updated}u/${report.playoffs.found}found` +
          ` venues ${report.venues.created}c/${report.venues.updated}u` +
          ` refs ${report.referees.created}c/${report.referees.updated}u` +
          ` errors=${report.fixtures.errors + report.playoffs.errors}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.join(", ")}`);
      }
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 8)) console.log(`  warn: ${w}`);
        if (report.warnings.length > 8) console.log(`  … +${report.warnings.length - 8} more warnings`);
      }
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
