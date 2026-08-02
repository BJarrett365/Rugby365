/**
 * Bulk import NZ NPC seasons from feeds + Wikipedia.
 *
 * Prefer Planet Rugby / SDMS (2021+) and Rugby Data, then fill historical
 * gaps from Wikipedia (Air NZ Cup / ITM Cup / Mitre 10 Cup / Bunnings NPC).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --feeds-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --gaps-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --all
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --year=2015
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-npc-seasons.ts --teams-only
 */
import { eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, teams } from "@rugby365/db";
import { getCompetitionBySlug, upsertSeason } from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import { importPlanetRugbyAllSeasons } from "../apps/web/src/lib/planet-rugby-import-service";
import { confirmMapping } from "../apps/web/src/lib/provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "../apps/web/src/lib/provider-mapping-types";
import { importRugbyDataLeague } from "../apps/web/src/lib/rugby-data-import-service";
import {
  importWikipediaSeasonPage,
  wikipediaSeasonImportPresets,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const COMPETITION_SLUG = "npc";
const LEGACY_SLUG = "npc-n0628z68";
const WIKIPEDIA_URL =
  "https://en.wikipedia.org/wiki/National_Provincial_Championship_(2006%E2%80%93present)";

const NPC_TEAM_WIKIS: Array<{ name: string; wikipediaUrl: string; aliases?: string[] }> = [
  { name: "Auckland", wikipediaUrl: "https://en.wikipedia.org/wiki/Auckland_Rugby_Union" },
  { name: "Bay of Plenty", wikipediaUrl: "https://en.wikipedia.org/wiki/Bay_of_Plenty_Rugby_Union" },
  { name: "Canterbury", wikipediaUrl: "https://en.wikipedia.org/wiki/Canterbury_Rugby_Football_Union" },
  {
    name: "Counties Manukau",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Counties_Manukau_Rugby_Football_Union",
  },
  {
    name: "Hawke's Bay",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Hawke%27s_Bay_Rugby_Union",
  },
  {
    name: "Manawatū",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Manawatu_Rugby_Union",
    aliases: ["Manawatu"],
  },
  { name: "North Harbour", wikipediaUrl: "https://en.wikipedia.org/wiki/North_Harbour_Rugby_Union" },
  { name: "Northland", wikipediaUrl: "https://en.wikipedia.org/wiki/Northland_Rugby_Union" },
  { name: "Otago", wikipediaUrl: "https://en.wikipedia.org/wiki/Otago_Rugby_Football_Union" },
  { name: "Southland", wikipediaUrl: "https://en.wikipedia.org/wiki/Southland_Rugby_Football_Union" },
  { name: "Taranaki", wikipediaUrl: "https://en.wikipedia.org/wiki/Taranaki_Rugby_Football_Union" },
  { name: "Tasman", wikipediaUrl: "https://en.wikipedia.org/wiki/Tasman_Rugby_Union" },
  { name: "Waikato", wikipediaUrl: "https://en.wikipedia.org/wiki/Waikato_Rugby_Union" },
  {
    name: "Wellington",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Wellington_Rugby_Football_Union",
  },
];

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const feedsOnly = args.includes("--feeds-only");
const teamsOnly = args.includes("--teams-only");
const gapsOnly = args.includes("--gaps-only") || (!args.includes("--all") && !feedsOnly && !teamsOnly);
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1] ?? null;
const fromYear = Number.parseInt(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "2006", 10);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2500);
const runFeeds = !auditOnly && !teamsOnly && (feedsOnly || args.includes("--all") || gapsOnly);
const runWiki = !auditOnly && !feedsOnly && !teamsOnly;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureNpcCompetition() {
  const db = getDb();
  let competition =
    (await getCompetitionBySlug(COMPETITION_SLUG)) ??
    (await getCompetitionBySlug(LEGACY_SLUG));

  if (!competition) {
    throw new Error(`Competition ${COMPETITION_SLUG} / ${LEGACY_SLUG} not found`);
  }

  const patch: Partial<typeof competitions.$inferInsert> = {};
  if (competition.slug !== COMPETITION_SLUG) patch.slug = COMPETITION_SLUG;
  if (competition.name !== "NPC") patch.name = "NPC";
  if (!competition.wikipediaUrl) patch.wikipediaUrl = WIKIPEDIA_URL;
  if (!competition.planetRugbySlug) patch.planetRugbySlug = "npc";
  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(competitions)
      .set(patch)
      .where(eq(competitions.id, competition.id))
      .returning();
    competition = updated ?? competition;
    console.log(`Updated competition: ${Object.keys(patch).join(", ")}`);
  }
  return competition;
}

async function fixCalendarYearLabels(competitionId: string) {
  const fixed = await getDb().execute(sql`
    update competition_seasons
    set label = year::text, slug = year::text
    where competition_id = ${competitionId}
      and label ~ '[–/-]'
    returning year, label
  `);
  const rows = fixed as Array<{ year: number; label: string }>;
  if (rows.length) console.log(`Fixed ${rows.length} season label(s) to calendar year`);
}

async function existingSeasonYears(competitionId: string) {
  const rows = await getDb()
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

async function seedNpcTeamWikipediaLinks() {
  const db = getDb();
  let updated = 0;
  for (const entry of NPC_TEAM_WIKIS) {
    const names = [entry.name, ...(entry.aliases ?? [])];
    for (const name of names) {
      const team = await resolveTeam({
        name,
        createIfMissing: true,
        sourceProvider: "wikipedia",
      });
      if (!team) continue;
      const patch: Partial<typeof teams.$inferInsert> = {};
      if (!team.wikipediaUrl) patch.wikipediaUrl = entry.wikipediaUrl;
      if (!team.countryName) patch.countryName = "New Zealand";
      if (team.teamType !== "domestic") patch.teamType = "domestic";
      if (Object.keys(patch).length) {
        await db.update(teams).set(patch).where(eq(teams.id, team.id));
        updated += 1;
      }
    }
  }
  console.log(`NPC team Wikipedia links: updated ${updated}`);
}

async function attachOrphanFixtures(competitionId: string) {
  const db = getDb();
  const orphans = await db.execute(sql`
    select
      case when extract(month from kickoff_at) >= 1
        then extract(year from kickoff_at)::int
        else extract(year from kickoff_at)::int
      end as year,
      count(*)::int as n
    from fixtures
    where competition_id = ${competitionId}
      and season_id is null
      and kickoff_at is not null
    group by 1
    order by 1
  `);
  const rows = orphans as Array<{ year: number; n: number }>;
  for (const row of rows) {
    const season = await upsertSeason({
      competitionId,
      label: String(row.year),
    });
    await db.execute(sql`
      update competition_seasons set label = ${String(row.year)}, slug = ${String(row.year)}
      where id = ${season.id}
    `);
    const updated = await db.execute(sql`
      update fixtures
      set season_id = ${season.id}
      where competition_id = ${competitionId}
        and season_id is null
        and kickoff_at is not null
        and extract(year from kickoff_at)::int = ${row.year}
      returning id
    `);
    console.log(`Attached ${(updated as unknown[]).length} orphan fixtures → ${row.year}`);
  }
}

async function importFeeds(competitionId: string) {
  console.log("\n=== Feeds: NPC SDMS ===");
  try {
    const result = await importPlanetRugbyAllSeasons({
      competitionId,
      importFixtures: true,
      importResults: true,
      syncStandings: true,
      importMatchDetails: false,
      onProgress: (p) => {
        if (p.phase === "season" || p.phase === "complete") console.log(`  [${p.phase}] ${p.message}`);
      },
    });
    console.log(
      JSON.stringify(
        {
          seasonsImported: result.seasonsImported,
          totals: result.totals,
          seasons: result.seasons.map((s) => ({
            label: s.seasonLabel,
            created: s.created,
            updated: s.updated,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`SDMS NPC failed: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n=== Feeds: Rugby Data leagues 45 + 183 ===");
  for (const leagueId of [45, 183]) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId: String(leagueId),
      rugby365Id: competitionId,
      rugby365Name: "NPC",
      confirmedBy: "cli_npc",
      notes: `Map Rugby Data NPC league ${leagueId} → npc`,
    });
    try {
      const result = await importRugbyDataLeague(leagueId);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Rugby Data ${leagueId} failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  await attachOrphanFixtures(competitionId);
  await fixCalendarYearLabels(competitionId);
}

async function main() {
  console.log("=== NPC Wikipedia / feeds import ===");
  console.log(JSON.stringify({ auditOnly, gapsOnly, feedsOnly, teamsOnly, onlyYear, fromYear, delayMs }, null, 2));

  const competition = await ensureNpcCompetition();
  await fixCalendarYearLabels(competition.id);

  if (teamsOnly || runWiki || runFeeds) {
    await seedNpcTeamWikipediaLinks();
  }
  if (teamsOnly) return;

  if (runFeeds) await importFeeds(competition.id);

  let seasons = wikipediaSeasonImportPresets(COMPETITION_SLUG).filter((s) => s.startYear >= fromYear);
  const existingYears = await existingSeasonYears(competition.id);

  if (onlyYear) {
    seasons = seasons.filter((s) => String(s.startYear) === onlyYear);
  } else if (gapsOnly) {
    const thinYears = await thinSeasonYears(competition.id);
    seasons = seasons.filter((s) => !existingYears.has(s.startYear) || thinYears.has(s.startYear));
  }

  seasons = [...seasons].sort((a, b) => a.startYear - b.startYear);
  console.log(`\n→ NPC Wikipedia: ${seasons.length} season(s) to import`);
  if (auditOnly) {
    for (const s of seasons) console.log(`  · ${s.startYear} ${s.url}`);
    return;
  }
  if (!runWiki) return;

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
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 3)) console.log(`    ! ${w}`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`    ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await fixCalendarYearLabels(competition.id);

  const coverage = await getDb().execute(sql`
    select cs.year, cs.label,
      count(distinct sr.id) filter (where sr.view = 'overall')::int as standings,
      count(distinct f.id)::int as fixtures
    from competition_seasons cs
    left join standing_rows sr on sr.season_id = cs.id
    left join fixtures f on f.season_id = cs.id
    where cs.competition_id = ${competition.id} and cs.is_deprecated = false
    group by cs.year, cs.label
    order by cs.year
  `);
  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("=== Coverage npc ===");
  for (const row of coverage as Array<{ year: number; label: string; standings: number; fixtures: number }>) {
    console.log(`  ${row.year} (${row.label}): ${row.standings}t / ${row.fixtures}f`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
