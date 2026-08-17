/**
 * Import league tables for all supported competitions without duplicating rows.
 *
 * Strategy:
 *  1) Planet Rugby SDMS — unique competition slugs, table-only, all SDMS seasons
 *     (delete+insert per view → no standing_rows duplicates)
 *  2) LiveSport — for preset leagues, fill seasons that still have zero overall rows
 *  3) Wikipedia — Premiership seasons still missing tables
 *  4) Re-sync SDMS standings for any local competition that already has sdmsCompCode
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-all-tables.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-all-tables.ts --skip-livesport
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-all-tables.ts --skip-wiki
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import {
  PLANET_RUGBY_LEAGUE_PRESETS,
  importOptionsForMode,
} from "../apps/web/src/lib/planet-rugby-import-presets";
import { importFromPlanetRugbyTournamentUrl } from "../apps/web/src/lib/planet-rugby-import-service";
import { LIVESPORT_LEAGUE_PRESETS } from "../apps/web/src/lib/livesport-import-presets";
import { importFromLiveSportTournamentUrl } from "../apps/web/src/lib/livesport-import-service";
import { syncCompetitionStandings } from "../apps/web/src/lib/standings-sync-service";
import { listCompetitions, getCompetitionBySlug } from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";

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
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

const skipLivesport = process.argv.includes("--skip-livesport");
const skipWiki = process.argv.includes("--skip-wiki");
const skipPlanet = process.argv.includes("--skip-planet");
const skipResync = process.argv.includes("--skip-resync");

/** Presets that are fixtures hubs / duplicates — not useful for league tables. */
const SKIP_PLANET_SLUGS = new Set(["international", "nations-championship"]);

/** Prefer results/table URLs over hub/fixtures duplicates. */
function uniquePlanetPresets() {
  const bySlug = new Map<string, (typeof PLANET_RUGBY_LEAGUE_PRESETS)[number]>();
  for (const preset of PLANET_RUGBY_LEAGUE_PRESETS) {
    if (SKIP_PLANET_SLUGS.has(preset.slug)) continue;
    const existing = bySlug.get(preset.slug);
    if (!existing) {
      bySlug.set(preset.slug, preset);
      continue;
    }
    // Prefer /table or /results over hub/fixtures.
    const prefer =
      /\/(table|results)/.test(preset.url) && !/\/(table|results)/.test(existing.url);
    if (prefer) bySlug.set(preset.slug, preset);
  }
  return [...bySlug.values()];
}

async function seasonHasOverallTable(competitionId: string, year: number): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(standingRows)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, standingRows.seasonId))
    .where(
      and(
        eq(competitionSeasons.competitionId, competitionId),
        eq(competitionSeasons.year, year),
        eq(standingRows.view, "overall"),
      ),
    );
  return Number(row?.count ?? 0) > 0;
}

async function countTables(): Promise<{ comps: number; seasons: number; rows: number }> {
  const db = getDb();
  const rows = await db
    .select({
      comps: sql<number>`count(distinct ${competitions.id})::int`,
      seasons: sql<number>`count(distinct ${competitionSeasons.id})::int`,
      rows: sql<number>`count(*)::int`,
    })
    .from(standingRows)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, standingRows.seasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(eq(standingRows.view, "overall"));
  return {
    comps: Number(rows[0]?.comps ?? 0),
    seasons: Number(rows[0]?.seasons ?? 0),
    rows: Number(rows[0]?.rows ?? 0),
  };
}

async function importPlanetTables() {
  const presets = uniquePlanetPresets();
  const tableOpts = importOptionsForMode("table");
  console.log(`\n=== 1) Planet Rugby tables (${presets.length} unique competitions) ===\n`);

  for (const preset of presets) {
    const started = Date.now();
    console.log(`→ ${preset.name} (${preset.slug})`);
    try {
      const result = await importFromPlanetRugbyTournamentUrl(preset.url, {
        importAllSeasons: true,
        ...tableOpts,
      });
      if ("seasonsImported" in result) {
        console.log(
          `  ✓ ${result.seasonsImported} seasons · standings synced (${Math.round((Date.now() - started) / 1000)}s)`,
        );
        for (const s of result.seasons) {
          console.log(
            `    ${s.seasonLabel}: standingsRows=${s.standingsRows ?? "?"} (+${s.created}/${s.updated} matches)`,
          );
        }
      } else {
        console.log(
          `  ✓ ${result.seasonLabel}: standingsRows=${result.standingsRows ?? "?"} (${Math.round((Date.now() - started) / 1000)}s)`,
        );
      }
    } catch (e) {
      console.error(`  ✗ ${preset.slug}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function importLivesportGaps() {
  console.log(`\n=== 2) LiveSport fallback for seasons without tables ===\n`);

  // Recent/historic window per competition type
  const yearRanges: Record<string, [number, number]> = {
    premiership: [2015, 2025],
    "top-14": [2015, 2025],
    "united-rugby-championship": [2017, 2025],
    "super-rugby": [2015, 2025],
    "six-nations": [2015, 2026],
    "autumn-nations-cup": [2020, 2020],
    "rugby-world-cup": [2015, 2023],
    "rugby-championship": [2012, 2025],
  };

  // Extra TRC livesport URL (not in presets list)
  const extras = [
    {
      slug: "rugby-championship",
      name: "The Rugby Championship",
      url: "https://www.livesport.com/uk/rugby-union/world/rugby-championship/",
    },
  ] as const;

  const jobs = [
    ...LIVESPORT_LEAGUE_PRESETS.map((p) => ({
      slug: p.slug,
      name: p.name,
      url: p.url,
    })),
    ...extras,
  ];

  // Dedupe by slug
  const bySlug = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) bySlug.set(job.slug, job);

  for (const job of bySlug.values()) {
    const [from, to] = yearRanges[job.slug] ?? [2020, 2025];
    console.log(`→ ${job.name} (${job.slug}) years ${from}–${to}`);

    // Ensure competition exists / resolve id after first successful year
    for (let year = from; year <= to; year++) {
      const competition = await getCompetitionBySlug(job.slug);
      if (competition && (await seasonHasOverallTable(competition.id, year))) {
        console.log(`    ${year}: skip (table exists)`);
        continue;
      }
      const started = Date.now();
      try {
        const result = await importFromLiveSportTournamentUrl(job.url, {
          seasonLabel: String(year),
          importFixtures: true,
          importResults: true,
          syncStandings: true,
        });
        console.log(
          `    ✓ ${year}: ${result.standingsRows} standings, ${result.resultCount} results (${Math.round((Date.now() - started) / 1000)}s)`,
        );
      } catch (e) {
        console.error(`    ✗ ${year}:`, e instanceof Error ? e.message : e);
      }
    }
  }
}

async function importWikipediaPremiershipGaps() {
  console.log(`\n=== 3) Wikipedia Premiership for seasons still missing tables ===\n`);
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    "npx",
    [
      "tsx",
      "--require",
      "./scripts/stub-server-only.cjs",
      "scripts/import-wikipedia-premiership-seasons.ts",
      "--from=2015",
    ],
    { stdio: "inherit", cwd: process.cwd(), env: process.env },
  );
  if (r.status !== 0) console.error("  ✗ Wikipedia Premiership import failed");
  else console.log("  ✓ Wikipedia Premiership import finished");
}

async function resyncExistingSdms() {
  console.log(`\n=== 4) Re-sync SDMS standings for competitions with sdmsCompCode ===\n`);
  const all = await listCompetitions();
  for (const c of all) {
    if (!c.sdmsCompCode) continue;
    try {
      const result = await syncCompetitionStandings(c.id);
      console.log(`  ✓ ${c.slug}: season ${result.seasonId.slice(0, 8)}… · ${result.rowsUpserted} rows`);
    } catch (e) {
      console.error(`  ✗ ${c.slug}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function main() {
  const before = await countTables();
  console.log(
    `Before: ${before.comps} competitions · ${before.seasons} seasons · ${before.rows} overall standing rows`,
  );

  if (!skipPlanet) await importPlanetTables();
  else console.log("\n=== 1) Skipped Planet Rugby (--skip-planet) ===");

  if (!skipLivesport) await importLivesportGaps();
  else console.log("\n=== 2) Skipped LiveSport (--skip-livesport) ===");

  if (!skipWiki) await importWikipediaPremiershipGaps();
  else console.log("\n=== 3) Skipped Wikipedia (--skip-wiki) ===");

  if (!skipResync) await resyncExistingSdms();
  else console.log("\n=== 4) Skipped SDMS re-sync (--skip-resync) ===");

  const after = await countTables();
  console.log(
    `\nDone.\nAfter:  ${after.comps} competitions · ${after.seasons} seasons · ${after.rows} overall standing rows`,
  );
  console.log(
    `Delta: +${after.comps - before.comps} comps · +${after.seasons - before.seasons} seasons · +${after.rows - before.rows} rows`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
