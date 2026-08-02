/**
 * Create previous-season shells (like Premiership) for catalog competitions,
 * then import Wikipedia seasons for teams / tables / results.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-competition-previous-seasons.ts --shells-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-competition-previous-seasons.ts --wiki-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-competition-previous-seasons.ts --all
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-competition-previous-seasons.ts --slug=pro-d2
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { competitionSeasons } from "@rugby365/db";
import {
  getCompetitionBySlug,
  syncDomesticSeasonCatalog,
  upsertSeason,
} from "../apps/web/src/lib/competition-admin-service";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import {
  currentDomesticSeasonStartYear,
  formatSeasonLabelForKind,
  seasonKindForCompetition,
  usesCalendarYearSeasons,
  usesDomesticSeasonCatalogForCompetition,
} from "../apps/web/src/lib/season-label-utils";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const shellsOnly = args.includes("--shells-only");
const wikiOnly = args.includes("--wiki-only");
const runAll = args.includes("--all") || (!shellsOnly && !wikiOnly);
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
const fromYear = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "0");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2000);
const gapsOnly = args.includes("--gaps-only");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureSeasonShells(entry: (typeof COMPETITION_IMPORT_CATALOG)[number]) {
  const competition = await getCompetitionBySlug(entry.slug);
  if (!competition) {
    console.log(`  ! missing competition ${entry.slug}`);
    return null;
  }

  const calendar = usesCalendarYearSeasons(competition.slug, competition.competitionType);
  const firstYear = entry.firstYear ?? (calendar ? 2015 : 2000);
  const kind = seasonKindForCompetition(competition.slug, competition.competitionType);

  if (usesDomesticSeasonCatalogForCompetition(competition.slug, competition.competitionType)) {
    // Premiership-style shells from firstYear via domestic catalog, then trim older than firstYear.
    await syncDomesticSeasonCatalog(competition.id);
    if (entry.firstYear) {
      await getDb()
        .update(competitionSeasons)
        .set({ isDeprecated: true })
        .where(
          and(
            eq(competitionSeasons.competitionId, competition.id),
            lt(competitionSeasons.year, entry.firstYear),
          ),
        );
    }
  } else {
    const endYear = calendar
      ? new Date().getFullYear()
      : currentDomesticSeasonStartYear();
    for (let year = firstYear; year <= endYear; year += 1) {
      const label = formatSeasonLabelForKind(year, kind);
      await upsertSeason({
        competitionId: competition.id,
        label,
        seasonKind: kind,
        ...(year === endYear ? { isActive: true } : {}),
      });
    }
    // Drop accidental Premiership-style shells outside the intended range.
    await getDb().execute(sql`
      update competition_seasons
      set is_deprecated = true
      where competition_id = ${competition.id}
        and is_deprecated = false
        and (year < ${firstYear} or year > ${endYear})
    `);
  }

  const count = await getDb().execute(sql`
    select count(*)::int as n from competition_seasons
    where competition_id = ${competition.id} and is_deprecated = false
  `);
  console.log(`  shells → ${(count as Array<{ n: number }>)[0]?.n ?? "?"} seasons`);
  return competition;
}

async function thinWikiYears(competitionId: string) {
  const thin = await getDb().execute(sql`
    select s.year
    from competition_seasons s
    where s.competition_id = ${competitionId}
      and s.is_deprecated = false
      and (
        not exists (select 1 from standing_rows sr where sr.season_id = s.id and sr.view = 'overall')
        or (select count(*) from standing_rows sr where sr.season_id = s.id and sr.view = 'overall') < 4
      )
  `);
  return new Set((thin as Array<{ year: number }>).map((r) => r.year));
}

async function importWikiSeasons(entry: (typeof COMPETITION_IMPORT_CATALOG)[number]) {
  const competition = await getCompetitionBySlug(entry.slug);
  if (!competition) {
    console.log(`  ! missing competition ${entry.slug}`);
    return;
  }

  let seasons = (entry.wikiSeasons ?? []).filter((s) => s.startYear >= (fromYear || 0));
  if (gapsOnly) {
    const thin = await thinWikiYears(competition.id);
    seasons = seasons.filter((s) => thin.has(s.startYear));
  }
  seasons = [...seasons].sort((a, b) => a.startYear - b.startYear);
  console.log(`  wiki → ${seasons.length} season page(s)`);

  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`  [${index + 1}/${seasons.length}] ${season.startYear}`);
    console.log(`    ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: entry.slug,
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      console.log(
        `    ✓ table ${report.table.created}c/${report.table.updated}u fixtures ${report.fixtures.created}c/${report.fixtures.updated}u playoffs ${report.playoffs.created}c/${report.playoffs.updated}u`,
      );
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 2)) console.log(`    ! ${w}`);
      }
    } catch (error) {
      console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function main() {
  console.log("=== Backfill previous seasons (shells + Wikipedia) ===");
  console.log(JSON.stringify({ shellsOnly, wikiOnly, runAll, onlySlug, fromYear, delayMs, gapsOnly }, null, 2));

  const catalog = COMPETITION_IMPORT_CATALOG.filter((e) =>
    onlySlug ? e.slug === onlySlug : e.slug !== "international-matches-n062z68w",
  );

  const doShells = shellsOnly || runAll;
  const doWiki = wikiOnly || runAll;

  if (doShells) {
    console.log("\n=== Season shells ===");
    for (const entry of catalog) {
      console.log(`\n→ ${entry.slug}`);
      await ensureSeasonShells(entry);
    }
  }

  if (doWiki) {
    console.log("\n=== Wikipedia previous seasons ===");
    for (const entry of catalog) {
      if (!(entry.wikiSeasons?.length)) {
        console.log(`\n→ ${entry.slug} (no wiki seasons configured)`);
        continue;
      }
      console.log(`\n→ ${entry.slug}`);
      await importWikiSeasons(entry);
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
