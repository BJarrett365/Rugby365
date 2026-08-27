/**
 * Re-import URC standings for seasons whose table format is Pool/Conference/single.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-urc-table-formats.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/reimport-urc-table-formats.ts --years=2001,2017,2018
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import { invalidatePublicCache } from "../apps/web/src/lib/public-data-cache";
import { recomputeStandingFormForSeason } from "../apps/web/src/lib/standing-form-recompute-service";
import {
  urcSeasonUsesConferenceTables,
  urcSeasonUsesPoolTables,
} from "../apps/web/src/lib/urc-lineage";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

loadDotEnv();

const SLUG = "united-rugby-championship";
const DEFAULT_YEARS = [2001, 2002, 2017, 2018, 2019, 2020];
const args = process.argv.slice(2);
const yearsArg = args.find((a) => a.startsWith("--years="))?.split("=")[1];
const years = yearsArg
  ? yearsArg.split(",").map((y) => Number(y.trim())).filter((y) => Number.isFinite(y))
  : DEFAULT_YEARS;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = getDb();
  const [comp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, SLUG))
    .limit(1);
  if (!comp) throw new Error(`Competition not found: ${SLUG}`);

  const entry = COMPETITION_IMPORT_CATALOG.find((e) => e.slug === SLUG);
  const wikiByYear = new Map((entry?.wikiSeasons ?? []).map((s) => [s.startYear, s.url] as const));

  for (const [index, year] of years.entries()) {
    const url = wikiByYear.get(year);
    if (!url) {
      console.log(`! ${year}: no wiki URL`);
      continue;
    }
    const format = urcSeasonUsesPoolTables(year)
      ? "Pool A/B"
      : urcSeasonUsesConferenceTables(year)
        ? "Conference A/B"
        : "single table";
    console.log(`\n[${index + 1}/${years.length}] ${year} → ${format}`);
    console.log(`  ${url}`);
    try {
      const report = await importWikipediaSeasonPage(url, {
        competitionSlug: SLUG,
        seasonStartYear: year,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: false,
        importPlayoffs: false,
        importTable: true,
      });
      console.log(`  ✓ table ${report.table.created}c/${report.table.updated}u`);
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 3)) console.log(`  ! ${w}`);
      }
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
    }

    const seasonRows = await db.execute(sql`
      select s.id
      from competition_seasons s
      where s.competition_id = ${comp.id} and s.year = ${year}
      limit 1
    `);
    const seasonId = (
      (seasonRows as unknown as { rows?: Array<{ id: string }> }).rows ??
      (seasonRows as Array<{ id: string }>)
    )[0]?.id;
    if (seasonId) {
      const form = await recomputeStandingFormForSeason(seasonId, { force: true });
      console.log(`  form updated=${form.updated} cleared=${form.cleared}`);
    }

    const views = await db.execute(sql`
      select sr.view, count(*)::int as n
      from standing_rows sr
      join competition_seasons s on s.id = sr.season_id
      where s.competition_id = ${comp.id} and s.year = ${year}
      group by sr.view
      order by sr.view
    `);
    console.log(
      "  views:",
      (
        (views as unknown as { rows?: Array<{ view: string; n: number }> }).rows ??
        (views as Array<{ view: string; n: number }>)
      )
        .map((r) => `${r.view}=${r.n}`)
        .join(", "),
    );

    if (index < years.length - 1) await sleep(1500);
  }

  invalidatePublicCache();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
