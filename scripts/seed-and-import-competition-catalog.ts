/**
 * Ensure catalog competitions exist, then import from Rugby Data feeds and Wikipedia.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-and-import-competition-catalog.ts --ensure-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-and-import-competition-catalog.ts --feeds-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-and-import-competition-catalog.ts --wiki-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-and-import-competition-catalog.ts --all
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-and-import-competition-catalog.ts --slug=pro-d2
 */
import { eq } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import {
  createCompetition,
  getCompetitionBySlug,
} from "../apps/web/src/lib/competition-admin-service";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import { confirmMapping } from "../apps/web/src/lib/provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "../apps/web/src/lib/provider-mapping-types";
import { importRugbyDataLeague } from "../apps/web/src/lib/rugby-data-import-service";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const ensureOnly = args.includes("--ensure-only");
const feedsOnly = args.includes("--feeds-only");
const wikiOnly = args.includes("--wiki-only");
const runAll = args.includes("--all") || (!ensureOnly && !feedsOnly && !wikiOnly);
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCompetition(entry: (typeof COMPETITION_IMPORT_CATALOG)[number]) {
  const db = getDb();
  let competition = await getCompetitionBySlug(entry.slug);
  if (!competition) {
    competition = await createCompetition({
      name: entry.name,
      slug: entry.slug,
      competitionType: entry.competitionType,
      planetRugbySlug: entry.planetRugbySlug,
      sdmsCompCode: entry.sdmsCompCode,
    });
    console.log(`  + created ${entry.slug}`);
  }

  const patch: Partial<typeof competitions.$inferInsert> = {};
  if (competition.name !== entry.name) patch.name = entry.name;
  if (competition.competitionType !== entry.competitionType) {
    patch.competitionType = entry.competitionType;
  }
  if (!competition.wikipediaUrl) patch.wikipediaUrl = entry.wikipediaUrl;
  if (entry.planetRugbySlug && !competition.planetRugbySlug) {
    patch.planetRugbySlug = entry.planetRugbySlug;
  }
  if (entry.sdmsCompCode && !competition.sdmsCompCode) {
    patch.sdmsCompCode = entry.sdmsCompCode;
  }
  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(competitions)
      .set(patch)
      .where(eq(competitions.id, competition.id))
      .returning();
    competition = updated ?? competition;
    console.log(`  ~ updated ${entry.slug}: ${Object.keys(patch).join(", ")}`);
  } else if (competition) {
    console.log(`  = ${entry.slug}`);
  }
  return competition;
}

async function importFeeds(entry: (typeof COMPETITION_IMPORT_CATALOG)[number], competitionId: string) {
  const ids = entry.rugbyDataLeagueIds ?? [];
  if (!ids.length) {
    console.log(`  (no Rugby Data IDs for ${entry.slug})`);
    return;
  }
  for (const leagueId of ids) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId: String(leagueId),
      rugby365Id: competitionId,
      rugby365Name: entry.name,
      confirmedBy: "cli_competition_catalog",
      notes: `Map Rugby Data ${leagueId} → ${entry.slug}`,
    });
    try {
      const result = await importRugbyDataLeague(leagueId);
      console.log(
        `  RD ${leagueId}: teams=${result.teams} fix+${result.fixturesCreated}/~${result.fixturesUpdated} standings=${result.standings} err=${result.errors.length}`,
      );
      if (result.errors.length) {
        for (const e of result.errors.slice(0, 2)) console.log(`    ! ${e}`);
      }
    } catch (error) {
      console.error(
        `  RD ${leagueId} failed: ${error instanceof Error ? error.message : error}`,
      );
    }
    await sleep(400);
  }
}

async function importWiki(entry: (typeof COMPETITION_IMPORT_CATALOG)[number]) {
  const seasons = entry.wikiSeasons ?? [];
  if (!seasons.length) {
    console.log(`  (no Wikipedia season pages for ${entry.slug})`);
    return;
  }
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`  wiki ${season.startYear}: ${season.url}`);
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
  console.log("=== Competition catalog seed / import ===");
  console.log(
    JSON.stringify({ ensureOnly, feedsOnly, wikiOnly, runAll, onlySlug, delayMs }, null, 2),
  );

  const catalog = COMPETITION_IMPORT_CATALOG.filter((e) =>
    onlySlug ? e.slug === onlySlug : true,
  );
  if (!catalog.length) {
    console.error(`No catalog entries for slug=${onlySlug}`);
    process.exit(1);
  }

  const doEnsure = ensureOnly || runAll || feedsOnly || wikiOnly;
  const doFeeds = feedsOnly || (runAll && !ensureOnly && !wikiOnly);
  const doWiki = wikiOnly || (runAll && !ensureOnly && !feedsOnly);

  const ensured = new Map<string, string>();

  if (doEnsure) {
    console.log("\n=== Ensure competitions ===");
    for (const entry of catalog) {
      const comp = await ensureCompetition(entry);
      ensured.set(entry.slug, comp.id);
    }
  }

  if (doFeeds) {
    console.log("\n=== Rugby Data feeds ===");
    for (const entry of catalog) {
      console.log(`\n→ ${entry.slug}`);
      let id = ensured.get(entry.slug);
      if (!id) {
        const comp = await ensureCompetition(entry);
        id = comp.id;
        ensured.set(entry.slug, id);
      }
      await importFeeds(entry, id);
    }
  }

  if (doWiki) {
    console.log("\n=== Wikipedia seasons ===");
    for (const entry of catalog) {
      console.log(`\n→ ${entry.slug}`);
      if (!ensured.has(entry.slug)) await ensureCompetition(entry);
      await importWiki(entry);
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
