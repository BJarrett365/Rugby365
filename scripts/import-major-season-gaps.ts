/**
 * Backfill major competition seasons that have shells but no standings rows.
 * Uses existing Wikipedia season catalogs / import service.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-major-season-gaps.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-major-season-gaps.ts --competition=premiership --limit=8
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-major-season-gaps.ts --limit=12
 */
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, createDb, standingRows } from "@rugby365/db";
import {
  importWikipediaSeasonPage,
  wikipediaSeasonImportPresets,
} from "../apps/web/src/lib/wikipedia-season-import-service";

type CatalogEntry = { startYear: number; url: string; winner?: string };

const CATALOGS: Array<{
  competitionSlug: string;
  label: string;
  /** Prefer modern years first for public value */
  minYear?: number;
}> = [
  { competitionSlug: "premiership", label: "Premiership", minYear: 1987 },
  { competitionSlug: "top-14", label: "Top 14", minYear: 2005 },
  { competitionSlug: "super-rugby", label: "Super Rugby", minYear: 1996 },
  { competitionSlug: "npc", label: "NPC", minYear: 2006 },
  { competitionSlug: "rugby-champions-cup", label: "Champions Cup" },
  { competitionSlug: "challenge-cup", label: "Challenge Cup" },
  { competitionSlug: "currie-cup-pd9ro98v", label: "Currie Cup" },
  { competitionSlug: "rugby-championship", label: "Rugby Championship" },
  { competitionSlug: "six-nations", label: "Six Nations", minYear: 1995 },
];

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const competitionArg = args.find((a) => a.startsWith("--competition="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 12;
const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 2500;
/** Skip future season shells (e.g. 2027–28). */
const maxYear = Number(
  args.find((a) => a.startsWith("--max-year="))?.split("=")[1] ?? new Date().getUTCFullYear() + 1,
);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function seasonsMissingStandings(competitionSlug: string) {
  const db = createDb();
  const rows = await db
    .select({
      seasonId: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      slug: competitions.slug,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .where(
      and(
        eq(competitions.slug, competitionSlug),
        sql`not exists (select 1 from ${standingRows} sr where sr.season_id = ${competitionSeasons.id})`,
      ),
    )
    .orderBy(sql`${competitionSeasons.year} desc nulls last`);
  return rows;
}

async function main() {
  const catalogs = CATALOGS.filter((c) => !competitionArg || c.competitionSlug === competitionArg);
  if (!catalogs.length) {
    console.error(`No catalog for --competition=${competitionArg}`);
    process.exit(1);
  }

  type Job = {
    competitionSlug: string;
    label: string;
    year: number;
    url: string;
    winner?: string;
  };
  const jobs: Job[] = [];

  for (const catalog of catalogs) {
    const missing = await seasonsMissingStandings(catalog.competitionSlug);
    const missingYears = new Set(
      missing.map((r) => r.year).filter((y): y is number => typeof y === "number"),
    );
    const entries: CatalogEntry[] = wikipediaSeasonImportPresets(catalog.competitionSlug);
    const byYear = new Map(entries.map((e) => [e.startYear, e]));
    const years = [...missingYears]
      .filter((y) => (catalog.minYear == null ? true : y >= catalog.minYear))
      .filter((y) => y <= maxYear)
      .sort((a, b) => b - a);

    console.log(
      `${catalog.label} (${catalog.competitionSlug}): ${missingYears.size} season(s) without standings` +
        (catalog.minYear != null ? ` (import minYear=${catalog.minYear})` : ""),
    );

    for (const year of years) {
      const entry = byYear.get(year);
      if (!entry) continue;
      jobs.push({
        competitionSlug: catalog.competitionSlug,
        label: catalog.label,
        year,
        url: entry.url,
        winner: entry.winner,
      });
    }
  }

  const selected = jobs.slice(0, limit);
  console.log(`\nQueued ${selected.length} import(s) (limit=${limit}).\n`);
  if (auditOnly) {
    for (const job of selected) {
      console.log(`- ${job.label} ${job.year} ${job.url}`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const [index, job] of selected.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`→ [${index + 1}/${selected.length}] ${job.label} ${job.year} ${job.winner ?? ""}`);
    console.log(`  ${job.url}`);
    try {
      const report = await importWikipediaSeasonPage(job.url, {
        competitionSlug: job.competitionSlug,
        seasonStartYear: job.year,
        mode: "update_existing",
        createMissingTeams: true,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u  fixtures ${report.fixtures.created}c/${report.fixtures.updated}u  warnings=${report.warnings.length}`,
      );
      ok += 1;
    } catch (error) {
      fail += 1;
      console.warn(`  ✗ ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nDone: ${ok} ok · ${fail} failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
