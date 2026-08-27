/**
 * Repair URC seasons whose fixtures are mostly scheduled 0–0 placeholders
 * (or whose standing forms are short / all-draw), by re-importing Wikipedia
 * results and recomputing form.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-placeholder-forms.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-placeholder-forms.ts --year=2010
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/repair-urc-placeholder-forms.ts --clear-only
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import { getDb } from "../apps/web/src/lib/db";
import { invalidatePublicCache } from "../apps/web/src/lib/public-data-cache";
import { currentDomesticSeasonStartYear } from "../apps/web/src/lib/season-label-utils";
import { recomputeStandingFormForSeason } from "../apps/web/src/lib/standing-form-recompute-service";
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
const args = process.argv.slice(2);
const clearOnly = args.includes("--clear-only");
const yearArg = args.find((a) => a.startsWith("--year="))?.split("=")[1];
const onlyYear = yearArg ? Number(yearArg) : null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type SeasonHit = {
  id: string;
  year: number;
  label: string;
  fixtures?: number;
  placeholder_00?: number;
  real_scores?: number;
  short_forms?: number;
  all_d_rows?: number;
};

function asRows(result: unknown): Array<Record<string, unknown>> {
  return (
    (result as { rows?: Array<Record<string, unknown>> }).rows ??
    (result as Array<Record<string, unknown>>)
  );
}

async function main() {
  const db = getDb();
  const currentYear = currentDomesticSeasonStartYear();
  const [comp] = await db
    .select({ id: competitions.id, name: competitions.name })
    .from(competitions)
    .where(eq(competitions.slug, SLUG))
    .limit(1);
  if (!comp) throw new Error(`Competition not found: ${SLUG}`);

  // Catch seasons that are mostly placeholders even when a few playoff scores exist.
  const placeholder = await db.execute(sql`
    select s.id, s.year, s.label,
      count(*)::int as fixtures,
      count(*) filter (
        where f.status = 'scheduled'
          and coalesce(f.home_score, 0) = 0
          and coalesce(f.away_score, 0) = 0
      )::int as placeholder_00,
      count(*) filter (
        where f.home_score is not null
          and f.away_score is not null
          and not (f.home_score = 0 and f.away_score = 0)
      )::int as real_scores
    from competition_seasons s
    join fixtures f on f.season_id = s.id
    where s.competition_id = ${comp.id}
      and s.is_deprecated = false
      and s.year <= ${currentYear}
    group by s.id, s.year, s.label
    having count(*) filter (
        where f.status = 'scheduled'
          and coalesce(f.home_score, 0) = 0
          and coalesce(f.away_score, 0) = 0
      ) >= 20
      and (
        count(*) filter (
          where f.home_score is not null
            and f.away_score is not null
            and not (f.home_score = 0 and f.away_score = 0)
        ) < 40
        or count(*) filter (
          where f.status = 'scheduled'
            and coalesce(f.home_score, 0) = 0
            and coalesce(f.away_score, 0) = 0
        ) > count(*) filter (
          where f.home_score is not null
            and f.away_score is not null
            and not (f.home_score = 0 and f.away_score = 0)
        )
      )
    order by s.year
  `);

  const shortForm = await db.execute(sql`
    select s.id, s.year, s.label,
      count(*) filter (
        where coalesce(sr.played, 0) >= 5
          and (
            sr.form is null
            or length(regexp_replace(upper(coalesce(sr.form, '')), '[^WDL]', '', 'g')) < 5
          )
      )::int as short_forms
    from competition_seasons s
    join standing_rows sr on sr.season_id = s.id and sr.view = 'overall'
    where s.competition_id = ${comp.id}
      and s.is_deprecated = false
      and s.year <= ${currentYear}
    group by s.id, s.year, s.label
    having count(*) filter (
        where coalesce(sr.played, 0) >= 5
          and (
            sr.form is null
            or length(regexp_replace(upper(coalesce(sr.form, '')), '[^WDL]', '', 'g')) < 5
          )
      ) > 0
    order by s.year
  `);

  const allDraw = await db.execute(sql`
    select s.id, s.year, s.label,
      count(*) filter (
        where sr.form ~* '^D{4,}$'
          or sr.form::text ~ '"lf"\\s*:\\s*"D{4,}"'
      )::int as all_d_rows
    from competition_seasons s
    join standing_rows sr on sr.season_id = s.id
    where s.competition_id = ${comp.id}
      and s.is_deprecated = false
    group by s.id, s.year, s.label
    having count(*) filter (
        where sr.form ~* '^D{4,}$'
          or sr.form::text ~ '"lf"\\s*:\\s*"D{4,}"'
      ) > 0
    order by s.year
  `);

  const filterYear = (row: Record<string, unknown>) =>
    onlyYear == null ? true : Number(row.year) === onlyYear;

  const placeholderRows = asRows(placeholder).filter(filterYear) as SeasonHit[];
  const shortFormRows = asRows(shortForm).filter(filterYear) as SeasonHit[];
  const allDrawRows = asRows(allDraw).filter(filterYear) as SeasonHit[];

  console.log(`Competition: ${comp.name}`);
  console.log(`Placeholder-heavy seasons: ${placeholderRows.length}`);
  for (const row of placeholderRows) {
    console.log(
      `  ${row.year} ${row.label}: fixtures=${row.fixtures} placeholder=${row.placeholder_00} real=${row.real_scores}`,
    );
  }
  console.log(`Short-form seasons: ${shortFormRows.length}`);
  for (const row of shortFormRows) {
    console.log(`  ${row.year} ${row.label}: shortForms=${row.short_forms}`);
  }
  console.log(`All-draw form seasons: ${allDrawRows.length}`);
  for (const row of allDrawRows) {
    console.log(`  ${row.year} ${row.label}: allD=${row.all_d_rows}`);
  }

  const entry = COMPETITION_IMPORT_CATALOG.find((e) => e.slug === SLUG);
  const wikiByYear = new Map(
    (entry?.wikiSeasons ?? []).map((s) => [s.startYear, s.url] as const),
  );

  const seasonIds = new Map<string, SeasonHit>();
  for (const row of [...placeholderRows, ...shortFormRows, ...allDrawRows]) {
    seasonIds.set(String(row.id), {
      id: String(row.id),
      year: Number(row.year),
      label: String(row.label),
    });
  }

  if (!clearOnly) {
    for (const season of [...seasonIds.values()].sort((a, b) => a.year - b.year)) {
      const url = wikiByYear.get(season.year);
      if (!url) {
        console.log(`  ! ${season.year}: no wiki URL configured`);
        continue;
      }
      console.log(`\nRe-importing ${season.year} fixtures from Wikipedia…`);
      console.log(`  ${url}`);
      try {
        const report = await importWikipediaSeasonPage(url, {
          competitionSlug: SLUG,
          seasonStartYear: season.year,
          mode: "update_existing",
          createMissingTeams: true,
          importFixtures: true,
          importPlayoffs: true,
          importTable: true,
        });
        console.log(
          `  ✓ fixtures ${report.fixtures.created}c/${report.fixtures.updated}u table ${report.table.created}c/${report.table.updated}u`,
        );
        if (report.warnings.length) {
          for (const w of report.warnings.slice(0, 3)) console.log(`  ! ${w}`);
        }
      } catch (error) {
        console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
      }
      await sleep(1200);
    }
  }

  // Drop leftover scheduled 0–0 junk once a completed season has enough real scores.
  console.log("\nCleaning leftover 0–0 placeholders…");
  for (const season of [...seasonIds.values()].sort((a, b) => a.year - b.year)) {
    if (season.year >= currentYear) continue;
    const deleted = await db.execute(sql`
      with doomed as (
        select f.id
        from fixtures f
        where f.season_id = ${season.id}::uuid
          and f.status = 'scheduled'
          and coalesce(f.home_score, 0) = 0
          and coalesce(f.away_score, 0) = 0
          and exists (
            select 1 from fixtures good
            where good.season_id = f.season_id
              and good.home_score is not null
              and good.away_score is not null
              and not (good.home_score = 0 and good.away_score = 0)
            having count(*) >= 40
          )
      ),
      del_events as (
        delete from match_events me using doomed d where me.fixture_id = d.id returning me.id
      ),
      del_stats as (
        delete from team_match_stats tms using doomed d where tms.fixture_id = d.id returning tms.id
      )
      delete from fixtures f using doomed d where f.id = d.id
      returning f.id
    `);
    console.log(`  ${season.year}: deleted ${asRows(deleted).length} placeholders`);
  }

  console.log("\nRecomputing / clearing standing forms…");
  for (const season of [...seasonIds.values()].sort((a, b) => a.year - b.year)) {
    const result = await recomputeStandingFormForSeason(season.id, { force: true });
    console.log(
      `  ${season.year}: updated=${result.updated} cleared=${result.cleared} skipped=${result.skipped}`,
    );
  }

  const sweep = await db.execute(sql`
    update standing_rows sr
    set form = null
    from competition_seasons s
    where sr.season_id = s.id
      and s.competition_id = ${comp.id}
      and (
        sr.form ~* '^D{4,}$'
        or sr.form::text ~ '"lf"\\s*:\\s*"D{4,}"'
      )
    returning sr.id
  `);
  console.log(`\nSwept remaining all-draw forms: ${asRows(sweep).length}`);

  const dropped = invalidatePublicCache();
  console.log(`Invalidated public cache entries: ${dropped}`);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
