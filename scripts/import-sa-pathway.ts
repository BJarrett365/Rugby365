/**
 * Seed + Wikipedia-import the Springboks / SA pathway competitions.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-sa-pathway.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-sa-pathway.ts --ensure-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-sa-pathway.ts --wiki-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-sa-pathway.ts --slug=varsity-cup
 */
import { eq } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import {
  createCompetition,
  getCompetitionBySlug,
} from "../apps/web/src/lib/competition-admin-service";
import {
  COMPETITION_IMPORT_CATALOG,
  type CompCatalogEntry,
} from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const SA_PATHWAY_SLUGS = [
  // Schools / university / provincial pathway (catalog entries)
  "craven-week",
  "academy-week",
  "sa-schools",
  "varsity-cup",
  "varsity-shield",
  "sa-cup",
  "currie-cup-first-division",
  // Historic European shells linked from the pathway table
  "heineken-cup",
  "european-challenge-cup-historic",
  "celtic-league",
  "pro12",
  "pro14",
] as const;

const args = process.argv.slice(2);
const ensureOnly = args.includes("--ensure-only");
const wikiOnly = args.includes("--wiki-only");
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2500);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCompetition(entry: CompCatalogEntry) {
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
  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(competitions)
      .set(patch)
      .where(eq(competitions.id, competition.id))
      .returning();
    competition = updated ?? competition;
    console.log(`  ~ updated ${entry.slug}: ${Object.keys(patch).join(", ")}`);
  } else {
    console.log(`  = ${entry.slug}`);
  }
  return competition;
}

async function importWikiSeasons(entry: CompCatalogEntry) {
  const seasons = entry.wikiSeasons ?? [];
  if (!seasons.length) {
    console.log(`  (no wiki seasons listed for ${entry.slug} — hub only)`);
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
        importTable: true,
      });
      console.log(
        `    ✓ table ${report.table.created}c/${report.table.updated}u fixtures ${report.fixtures.created}c/${report.fixtures.updated}u`,
      );
      if (report.unmappedTeams.length) {
        console.log(`    unmapped: ${report.unmappedTeams.slice(0, 8).join(", ")}`);
      }
    } catch (error) {
      console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function ensureSpringboks() {
  console.log("\n=== Springboks national team ===");
  const team = await resolveTeam({
    name: "South Africa",
    createIfMissing: true,
    sourceProvider: "wikipedia",
  });
  console.log(`  ${team ? `OK ${team.name} (${team.slug})` : "failed to resolve"}`);

  // Common aliases used in fixtures / SDMS
  for (const alias of ["Springboks", "South Africa Springboks", "RSA"]) {
    const resolved = await resolveTeam({
      name: alias,
      createIfMissing: false,
      sourceProvider: "wikipedia",
    });
    console.log(`  alias ${alias}: ${resolved ? resolved.name : "not found"}`);
  }
}

async function main() {
  const entries = COMPETITION_IMPORT_CATALOG.filter((e) =>
    SA_PATHWAY_SLUGS.includes(e.slug as (typeof SA_PATHWAY_SLUGS)[number]),
  ).filter((e) => !onlySlug || e.slug === onlySlug);

  if (!entries.length) {
    console.error(onlySlug ? `No catalog entry for ${onlySlug}` : "No SA pathway catalog entries");
    process.exit(1);
  }

  console.log("=== SA / Springboks pathway ===");
  console.log(JSON.stringify({ ensureOnly, wikiOnly, onlySlug, delayMs, count: entries.length }, null, 2));

  for (const entry of entries) {
    console.log(`\n=== ${entry.name} (${entry.slug}) ===`);
    await ensureCompetition(entry);
    if (ensureOnly) continue;
    if (wikiOnly || !ensureOnly) {
      await importWikiSeasons(entry);
    }
  }

  if (!onlySlug) await ensureSpringboks();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
