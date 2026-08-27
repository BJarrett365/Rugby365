/**
 * Backfill United Rugby Championship lineage under the canonical slug.
 *
 * Phases:
 *  1) Merge __legacy__ URC clones into united-rugby-championship
 *  2) Season hygiene (shells from 2001–02; deprecate pre-2001 / future)
 *  3) Remount orphan/legacy season fixtures onto canonical URC seasons
 *  4) Clone fixtures + tables from celtic-league / pro12 / pro14 by year
 *  5) Wikipedia season pages (gaps) onto URC
 *  6) Planet Rugby all-seasons (fixtures + tables + match details)
 *  7) LiveSport for seasons still missing tables
 *  8) SDMS standings re-sync for seasons with fixtures but thin tables
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc.ts --skip-planet --skip-livesport
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc.ts --wiki-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc.ts --from=2017
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, fixtures, standingRows } from "@rugby365/db";
import {
  getCompetitionBySlug,
  syncDomesticSeasonCatalog,
  upsertSeason,
} from "../apps/web/src/lib/competition-admin-service";
import { COMPETITION_IMPORT_CATALOG } from "../apps/web/src/lib/competition-import-catalog";
import {
  findLegacySlugCompetitionGroups,
  migrateSeasonId,
} from "../apps/web/src/lib/competition-dedupe-service";
import { getDb } from "../apps/web/src/lib/db";
import {
  importOptionsForMode,
  planetRugbyPresetById,
} from "../apps/web/src/lib/planet-rugby-import-presets";
import { importFromPlanetRugbyTournamentUrl } from "../apps/web/src/lib/planet-rugby-import-service";
import { importFromLiveSportTournamentUrl } from "../apps/web/src/lib/livesport-import-service";
import { liveSportPresetForSlug } from "../apps/web/src/lib/livesport-import-presets";
import {
  currentDomesticSeasonStartYear,
  domesticSeasonFirstYearForCompetition,
  formatSeasonRangeLabel,
  kickoffInSeason,
  parseSeasonStartYear,
} from "../apps/web/src/lib/season-label-utils";
import { syncSeasonStandings } from "../apps/web/src/lib/standings-sync-service";
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
const LINEAGE = [
  { slug: "celtic-league", from: 2001, to: 2010 },
  { slug: "pro12", from: 2011, to: 2016 },
  { slug: "pro14", from: 2017, to: 2020 },
] as const;

const args = process.argv.slice(2);
const wikiOnly = args.includes("--wiki-only");
const skipMerge = args.includes("--skip-merge");
const skipClone = args.includes("--skip-clone");
const skipWiki = args.includes("--skip-wiki") || false;
const skipPlanet = args.includes("--skip-planet");
const skipLivesport = args.includes("--skip-livesport");
const skipSdms = args.includes("--skip-sdms");
const fromYear = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "0");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 1500);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function coverage(competitionId: string) {
  const db = getDb();
  const rows = await db.execute(sql`
    select cs.year, cs.label, cs.is_deprecated,
      (select count(*)::int from fixtures f where f.season_id = cs.id) as fixtures,
      (select count(*)::int from standing_rows sr where sr.season_id = cs.id and sr.view = 'overall') as standings
    from competition_seasons cs
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
    order by cs.year
  `);
  return (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    (rows as Array<Record<string, unknown>>);
}

async function mergeLegacyUrc(keeperId: string) {
  console.log("\n=== 1) Merge legacy URC competitions ===");
  const db = getDb();
  const groups = await findLegacySlugCompetitionGroups();
  const urcGroups = groups.filter((g) =>
    g.rows.some((r) => r.slug === SLUG || r.slug.startsWith(`${SLUG}__legacy__`)),
  );
  console.log(`  URC legacy groups: ${urcGroups.length}`);

  const keeperSeasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, keeperId));

  for (const group of urcGroups) {
    const losers = group.rows.filter((r) => r.id !== keeperId && r.slug.includes("__legacy__"));
    for (const loser of losers) {
      console.log(`  merging ${loser.slug} → ${SLUG}`);
      const loserSeasons = await db
        .select()
        .from(competitionSeasons)
        .where(eq(competitionSeasons.competitionId, loser.id));

      for (const season of loserSeasons) {
        const year = season.year ?? parseSeasonStartYear(season.label);
        const match =
          (year != null ? keeperSeasons.find((k) => k.year === year) : null) ??
          keeperSeasons.find((k) => k.label === season.label) ??
          null;
        if (match) {
          await migrateSeasonId(season.id, match.id);
          await db.delete(competitionSeasons).where(eq(competitionSeasons.id, season.id));
        } else {
          await db
            .update(competitionSeasons)
            .set({ competitionId: keeperId })
            .where(eq(competitionSeasons.id, season.id));
          keeperSeasons.push({ ...season, competitionId: keeperId });
        }
      }

      await db.execute(sql`
        update fixtures set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_transfers set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_team_memberships set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update team_match_stats set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_match_performance_stats set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_match_ratings set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_suspensions set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);
      await db.execute(sql`
        update player_season_stats set competition_id = ${keeperId}::uuid
        where competition_id = ${loser.id}::uuid
      `);

      try {
        await db.execute(sql`delete from competitions where id = ${loser.id}::uuid`);
        console.log(`    deleted ${loser.slug}`);
      } catch (error) {
        console.error(`    ! could not delete ${loser.slug}:`, error instanceof Error ? error.message : error);
      }
    }
  }
}

async function hygieneSeasons(competitionId: string) {
  console.log("\n=== 2) Season hygiene ===");
  await syncDomesticSeasonCatalog(competitionId);
  const firstYear = domesticSeasonFirstYearForCompetition(SLUG);
  const currentYear = currentDomesticSeasonStartYear();
  const db = getDb();

  // Clear bogus future tables (e.g. 2027–28 with standings but no fixtures).
  await db.execute(sql`
    delete from standing_rows sr
    using competition_seasons cs
    where sr.season_id = cs.id
      and cs.competition_id = ${competitionId}
      and cs.year > ${currentYear}
  `);

  await db.execute(sql`
    update competition_seasons
    set is_deprecated = true, is_active = false
    where competition_id = ${competitionId}
      and (year < ${firstYear} or year > ${currentYear})
  `);

  await db.execute(sql`
    update competition_seasons
    set is_deprecated = false
    where competition_id = ${competitionId}
      and year >= ${firstYear}
      and year <= ${currentYear}
  `);

  await db.execute(sql`
    update competition_seasons
    set is_active = (year = ${currentYear})
    where competition_id = ${competitionId}
      and is_deprecated = false
  `);

  console.log(`  active window ${firstYear}–${currentYear} (active=${currentYear})`);
}

async function remountOrphanFixtures(competitionId: string) {
  console.log("\n=== 3) Remount orphan / legacy-season fixtures ===");
  const db = getDb();
  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.isDeprecated, false)));
  const byYear = new Map(seasons.map((s) => [s.year, s]));

  // Fixtures on canonical URC but season belongs to another competition.
  const misplaced = await db.execute(sql`
    select f.id, f.kickoff_at, f.season_id, cs.year as season_year, c.slug as season_comp
    from fixtures f
    left join competition_seasons cs on cs.id = f.season_id
    left join competitions c on c.id = cs.competition_id
    where f.competition_id = ${competitionId}
      and (f.season_id is null or cs.competition_id is distinct from ${competitionId})
  `);
  const rows =
    (misplaced as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    (misplaced as Array<Record<string, unknown>>);

  let remounted = 0;
  let attached = 0;
  const migratedSeasons = new Set<string>();

  for (const row of rows) {
    const kickoff = row.kickoff_at ? new Date(String(row.kickoff_at)) : null;
    let year: number | null =
      typeof row.season_year === "number" ? row.season_year : null;

    if (year == null && kickoff && !Number.isNaN(kickoff.getTime())) {
      for (const [y] of byYear) {
        if (kickoffInSeason(kickoff, y)) {
          year = y;
          break;
        }
      }
      if (year == null) {
        year = kickoff.getMonth() >= 6 ? kickoff.getFullYear() : kickoff.getFullYear() - 1;
      }
    }

    if (year == null) continue;
    const target = byYear.get(year);
    if (!target) continue;

    const seasonId = row.season_id ? String(row.season_id) : null;
    const seasonComp = String(row.season_comp ?? "");
    if (seasonId && seasonComp.includes("__legacy__")) {
      if (!migratedSeasons.has(seasonId)) {
        await migrateSeasonId(seasonId, target.id);
        migratedSeasons.add(seasonId);
        remounted += 1;
      }
      continue;
    }

    await db
      .update(fixtures)
      .set({ seasonId: target.id, competitionId })
      .where(eq(fixtures.id, String(row.id)));
    attached += 1;
  }
  console.log(`  remounted legacy seasons=${remounted} · attached orphans=${attached} · scanned=${rows.length}`);
}

async function cloneLineageOntoUrc(urcId: string) {
  console.log("\n=== 4) Clone Celtic/Pro12/Pro14 fixtures + tables onto URC ===");
  const db = getDb();
  const urcSeasons = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, urcId), eq(competitionSeasons.isDeprecated, false)));
  const urcByYear = new Map(urcSeasons.map((s) => [s.year, s]));

  for (const era of LINEAGE) {
    const source = await getCompetitionBySlug(era.slug);
    if (!source) {
      console.log(`  ! missing ${era.slug}`);
      continue;
    }
    const sourceSeasons = await db
      .select()
      .from(competitionSeasons)
      .where(eq(competitionSeasons.competitionId, source.id));

    for (const src of sourceSeasons) {
      if (src.year < era.from || src.year > era.to) continue;
      if (src.year < fromYear) continue;
      const dest = urcByYear.get(src.year);
      if (!dest) {
        const created = await upsertSeason({
          competitionId: urcId,
          label: formatSeasonRangeLabel(src.year),
        });
        urcByYear.set(src.year, created);
      }
      const target = urcByYear.get(src.year)!;

      const [{ count: destFx }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fixtures)
        .where(eq(fixtures.seasonId, target.id));
      const [{ count: destSt }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(standingRows)
        .where(and(eq(standingRows.seasonId, target.id), eq(standingRows.view, "overall")));
      const [{ count: srcFx }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fixtures)
        .where(eq(fixtures.seasonId, src.id));
      const [{ count: srcSt }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(standingRows)
        .where(and(eq(standingRows.seasonId, src.id), eq(standingRows.view, "overall")));

      let clonedFx = 0;
      let clonedSt = 0;

      if (Number(destFx) < 10 && Number(srcFx) > 0) {
        try {
          await db.execute(sql`
            insert into fixtures (
              id, slug, sport_id, home_team_id, away_team_id, competition_id, season_id,
              stage, competition_name, kickoff_at, status, home_score, away_score,
              half_time_home, half_time_away, match_minute, match_second, period,
              sport365_url, planet_rugby_url, external_match_id, provider_snapshot,
              referee_name, venue_name, is_neutral_venue, venue_id, attendance,
              referee_id, home_coach_id, away_coach_id, round,
              home_try_bonus_points, away_try_bonus_points,
              home_losing_bonus_points, away_losing_bonus_points
            )
            select
              gen_random_uuid(),
              left(f.slug, 140) || '-urc-' || replace(f.id::text, '-', ''),
              f.sport_id, f.home_team_id, f.away_team_id, ${urcId}::uuid, ${target.id}::uuid,
              f.stage, f.competition_name, f.kickoff_at, f.status, f.home_score, f.away_score,
              f.half_time_home, f.half_time_away, f.match_minute, f.match_second, f.period,
              f.sport365_url, f.planet_rugby_url,
              case when f.external_match_id is null then null
                   else left(f.external_match_id || '-urc-' || replace(f.id::text, '-', ''), 180) end,
              f.provider_snapshot,
              f.referee_name, f.venue_name, f.is_neutral_venue, f.venue_id, f.attendance,
              f.referee_id, f.home_coach_id, f.away_coach_id, f.round,
              f.home_try_bonus_points, f.away_try_bonus_points,
              f.home_losing_bonus_points, f.away_losing_bonus_points
            from fixtures f
            where f.season_id = ${src.id}
              and not exists (
                select 1 from fixtures x
                where x.season_id = ${target.id}
                  and x.home_team_id is not distinct from f.home_team_id
                  and x.away_team_id is not distinct from f.away_team_id
                  and x.kickoff_at is not distinct from f.kickoff_at
              )
            on conflict (slug) do nothing
          `);
          const [{ count: afterFx }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(fixtures)
            .where(eq(fixtures.seasonId, target.id));
          clonedFx = Math.max(0, Number(afterFx) - Number(destFx));
        } catch (error) {
          console.error(
            `    ! fixture clone failed ${src.label}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      if (Number(destSt) < 4 && Number(srcSt) > 0) {
        await db.execute(sql`
          insert into standing_rows (
            id, season_id, team_id, view, rank, played, won, draw, lost,
            points_for, points_against, points_diff, bonus_points,
            try_bonus_points, losing_bonus_points, points_deduction, points, form, synced_at
          )
          select
            gen_random_uuid(), ${target.id}::uuid, sr.team_id, sr.view, sr.rank,
            sr.played, sr.won, sr.draw, sr.lost, sr.points_for, sr.points_against,
            sr.points_diff, sr.bonus_points, sr.try_bonus_points, sr.losing_bonus_points,
            sr.points_deduction, sr.points, sr.form, sr.synced_at
          from standing_rows sr
          where sr.season_id = ${src.id}
            and not exists (
              select 1 from standing_rows x
              where x.season_id = ${target.id}
                and x.team_id = sr.team_id
                and x.view = sr.view
            )
        `);
        clonedSt = Number(srcSt);
      }

      console.log(
        `  ${era.slug} ${src.label}: src fx=${srcFx}/st=${srcSt} → urc fx=${destFx}+${clonedFx} st=${destSt}+${clonedSt}`,
      );
    }
  }
}

async function importWikiGaps(competitionId: string) {
  console.log("\n=== 5) Wikipedia season pages (gaps) ===");
  const entry = COMPETITION_IMPORT_CATALOG.find((e) => e.slug === SLUG);
  if (!entry?.wikiSeasons?.length) {
    console.log("  ! no wiki seasons configured");
    return;
  }

  const thin = await getDb().execute(sql`
    select s.year
    from competition_seasons s
    where s.competition_id = ${competitionId}
      and s.is_deprecated = false
      and (
        not exists (select 1 from standing_rows sr where sr.season_id = s.id and sr.view = 'overall')
        or (select count(*) from standing_rows sr where sr.season_id = s.id and sr.view = 'overall') < 4
        or (select coalesce(sum(played), 0) from standing_rows sr where sr.season_id = s.id and sr.view = 'overall') = 0
        or (select count(*) from fixtures f where f.season_id = s.id) < 10
      )
  `);
  const thinYears = new Set(
    ((thin as unknown as { rows?: Array<{ year: number }> }).rows ??
      (thin as Array<{ year: number }>)).map((r) => r.year),
  );

  const seasons = entry.wikiSeasons
    .filter((s) => s.startYear >= (fromYear || 0) && thinYears.has(s.startYear))
    .sort((a, b) => a.startYear - b.startYear);

  console.log(`  wiki → ${seasons.length} gap season(s)`);
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    console.log(`  [${index + 1}/${seasons.length}] ${season.startYear}`);
    console.log(`    ${season.url}`);
    try {
      const report = await importWikipediaSeasonPage(season.url, {
        competitionSlug: SLUG,
        seasonStartYear: season.startYear,
        mode: "update_existing",
        createMissingTeams: true,
        // Fixtures are already cloned/mounted for historic URC — standings fill is the gap.
        importFixtures: false,
        importPlayoffs: false,
      });
      console.log(
        `    ✓ table ${report.table.created}c/${report.table.updated}u fixtures ${report.fixtures.created}c/${report.fixtures.updated}u`,
      );
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 2)) console.log(`    ! ${w}`);
      }
    } catch (error) {
      console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function importPlanet() {
  console.log("\n=== 6) Planet Rugby all seasons (full) ===");
  const preset = planetRugbyPresetById("urc-results") ?? {
    url: "https://www.planetrugby.com/tournament/united-rugby-championship/results",
  };
  const opts = importOptionsForMode("full");
  const started = Date.now();
  try {
    const result = await importFromPlanetRugbyTournamentUrl(preset.url, {
      importAllSeasons: true,
      ...opts,
    });
    if ("seasonsImported" in result) {
      console.log(
        `  ✓ ${result.seasonsImported} seasons (${Math.round((Date.now() - started) / 1000)}s)`,
      );
      for (const s of result.seasons) {
        console.log(
          `    ${s.seasonLabel}: standings=${s.standingsRows ?? "?"} matches +${s.created}/${s.updated}`,
        );
      }
    } else {
      console.log(`  ✓ ${result.seasonLabel} (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  } catch (error) {
    console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
  }
}

async function importLivesportGaps(competitionId: string) {
  console.log("\n=== 7) LiveSport gaps ===");
  const preset = liveSportPresetForSlug(SLUG);
  if (!preset) {
    console.log("  ! no LiveSport preset");
    return;
  }
  const currentYear = currentDomesticSeasonStartYear();
  const from = Math.max(fromYear || 2017, 2017);
  for (let year = from; year <= currentYear; year += 1) {
    const [{ count }] = await getDb()
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
    if (Number(count) >= 8) {
      console.log(`  ${year}: skip (table exists, ${count} rows)`);
      continue;
    }
    const started = Date.now();
    try {
      const result = await importFromLiveSportTournamentUrl(preset.url, {
        seasonLabel: String(year),
        importFixtures: true,
        importResults: true,
        syncStandings: true,
      });
      console.log(
        `  ✓ ${year}: standings=${result.standingsRows} results=${result.resultCount} (${Math.round((Date.now() - started) / 1000)}s)`,
      );
    } catch (error) {
      console.error(`  ✗ ${year}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function resyncSdmsTables(competitionId: string) {
  console.log("\n=== 8) SDMS standings for thin modern seasons ===");
  const competition = await getCompetitionBySlug(SLUG);
  if (!competition?.sdmsCompCode) {
    console.log("  ! no sdmsCompCode");
    return;
  }
  const thin = await getDb().execute(sql`
    select s.id, s.year, s.label,
      (select count(*)::int from fixtures f where f.season_id = s.id) as fixtures,
      (select count(*)::int from standing_rows sr where sr.season_id = s.id and sr.view = 'overall') as standings
    from competition_seasons s
    where s.competition_id = ${competitionId}
      and s.is_deprecated = false
      and s.year >= 2021
      and (
        (select count(*) from standing_rows sr where sr.season_id = s.id and sr.view = 'overall') < 8
      )
    order by s.year
  `);
  const rows =
    (thin as unknown as { rows?: Array<{ id: string; year: number; label: string }> }).rows ??
    (thin as Array<{ id: string; year: number; label: string }>);

  for (const season of rows) {
    try {
      const result = await syncSeasonStandings(season.id);
      console.log(`  ✓ ${season.label}: ${result.rowsUpserted} rows`);
    } catch (error) {
      console.error(`  ✗ ${season.label}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function main() {
  console.log("=== URC lineage backfill ===");
  console.log(
    JSON.stringify(
      { wikiOnly, skipMerge, skipClone, skipWiki, skipPlanet, skipLivesport, skipSdms, fromYear, delayMs },
      null,
      2,
    ),
  );

  const competition = await getCompetitionBySlug(SLUG);
  if (!competition) throw new Error(`Competition not found: ${SLUG}`);

  if (!wikiOnly && !skipMerge) await mergeLegacyUrc(competition.id);
  await hygieneSeasons(competition.id);
  if (!wikiOnly) await remountOrphanFixtures(competition.id);
  if (!wikiOnly && !skipClone) await cloneLineageOntoUrc(competition.id);
  if (!skipWiki) await importWikiGaps(competition.id);
  if (!wikiOnly && !skipPlanet) await importPlanet();
  if (!wikiOnly && !skipLivesport) await importLivesportGaps(competition.id);
  if (!wikiOnly && !skipSdms) await resyncSdmsTables(competition.id);

  console.log("\n=== Coverage snapshot ===");
  const snap = await coverage(competition.id);
  for (const row of snap) {
    console.log(
      `  ${row.label}: fx=${row.fixtures} table=${row.standings}${row.is_deprecated ? " [deprecated]" : ""}`,
    );
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
