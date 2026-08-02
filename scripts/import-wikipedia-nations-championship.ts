/**
 * Import World Rugby Nations Championship + Nations Cup from feeds and Wikipedia.
 *
 * Prefer Planet Rugby / SDMS + Rugby Data for 2026, then Wikipedia for structure,
 * roster, and any feed gaps. Also seeds nation Wikipedia URLs.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-nations-championship.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-nations-championship.ts --feeds-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-nations-championship.ts --wiki-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-nations-championship.ts --teams-only
 */
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows, teams } from "@rugby365/db";
import {
  createCompetition,
  getCompetitionBySlug,
  upsertSeason,
} from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import {
  NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS,
  NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS,
} from "../apps/web/src/lib/nations-championship-hemisphere";
import { importPlanetRugbyAllSeasons } from "../apps/web/src/lib/planet-rugby-import-service";
import { confirmMapping } from "../apps/web/src/lib/provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "../apps/web/src/lib/provider-mapping-types";
import { importRugbyDataLeague } from "../apps/web/src/lib/rugby-data-import-service";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const feedsOnly = args.includes("--feeds-only");
const wikiOnly = args.includes("--wiki-only");
const teamsOnly = args.includes("--teams-only");
const runFeeds = !wikiOnly && !teamsOnly;
const runWiki = !feedsOnly && !teamsOnly;
const runTeams = !feedsOnly && !wikiOnly;

const NATIONS_CHAMPIONSHIP_WIKI = "https://en.wikipedia.org/wiki/Nations_Championship";
const NATIONS_CUP_WIKI = "https://en.wikipedia.org/wiki/World_Rugby_Nations_Cup_(2026%E2%80%93)";

const NATIONS_CUP_TEAMS = [
  { name: "Canada", wikipediaUrl: "https://en.wikipedia.org/wiki/Canada_national_rugby_union_team" },
  { name: "Chile", wikipediaUrl: "https://en.wikipedia.org/wiki/Chile_national_rugby_union_team" },
  { name: "Georgia", wikipediaUrl: "https://en.wikipedia.org/wiki/Georgia_national_rugby_union_team" },
  {
    name: "Hong Kong China",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Hong_Kong_national_rugby_union_team",
    aliases: ["Hong Kong"],
  },
  { name: "Portugal", wikipediaUrl: "https://en.wikipedia.org/wiki/Portugal_national_rugby_union_team" },
  { name: "Romania", wikipediaUrl: "https://en.wikipedia.org/wiki/Romania_national_rugby_union_team" },
  { name: "Samoa", wikipediaUrl: "https://en.wikipedia.org/wiki/Samoa_national_rugby_union_team" },
  { name: "Spain", wikipediaUrl: "https://en.wikipedia.org/wiki/Spain_national_rugby_union_team" },
  { name: "Tonga", wikipediaUrl: "https://en.wikipedia.org/wiki/Tonga_national_rugby_union_team" },
  {
    name: "United States",
    wikipediaUrl: "https://en.wikipedia.org/wiki/United_States_national_rugby_union_team",
    aliases: ["USA"],
  },
  { name: "Uruguay", wikipediaUrl: "https://en.wikipedia.org/wiki/Uruguay_national_rugby_union_team" },
  { name: "Zimbabwe", wikipediaUrl: "https://en.wikipedia.org/wiki/Zimbabwe_national_rugby_union_team" },
] as const;

const NATIONS_CHAMPIONSHIP_TEAM_WIKIS: Record<string, string> = {
  England: "https://en.wikipedia.org/wiki/England_national_rugby_union_team",
  France: "https://en.wikipedia.org/wiki/France_national_rugby_union_team",
  Ireland: "https://en.wikipedia.org/wiki/Ireland_national_rugby_union_team",
  Italy: "https://en.wikipedia.org/wiki/Italy_national_rugby_union_team",
  Scotland: "https://en.wikipedia.org/wiki/Scotland_national_rugby_union_team",
  Wales: "https://en.wikipedia.org/wiki/Wales_national_rugby_union_team",
  Argentina: "https://en.wikipedia.org/wiki/Argentina_national_rugby_union_team",
  Australia: "https://en.wikipedia.org/wiki/Australia_national_rugby_union_team",
  Fiji: "https://en.wikipedia.org/wiki/Fiji_national_rugby_union_team",
  Japan: "https://en.wikipedia.org/wiki/Japan_national_rugby_union_team",
  "New Zealand": "https://en.wikipedia.org/wiki/New_Zealand_national_rugby_union_team",
  "South Africa": "https://en.wikipedia.org/wiki/South_Africa_national_rugby_union_team",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCompetition(input: {
  slug: string;
  name: string;
  wikipediaUrl: string;
  planetRugbySlug?: string;
}) {
  const db = getDb();
  let competition = await getCompetitionBySlug(input.slug);
  if (!competition) {
    competition = await createCompetition({
      name: input.name,
      slug: input.slug,
      competitionType: "international",
      planetRugbySlug: input.planetRugbySlug ?? input.slug,
    });
    console.log(`Created competition ${input.slug}`);
  }

  const patch: Partial<typeof competitions.$inferInsert> = {};
  if (!competition.wikipediaUrl) patch.wikipediaUrl = input.wikipediaUrl;
  if (competition.competitionType !== "international") patch.competitionType = "international";
  if (!competition.planetRugbySlug && input.planetRugbySlug) {
    patch.planetRugbySlug = input.planetRugbySlug;
  }
  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(competitions)
      .set(patch)
      .where(eq(competitions.id, competition.id))
      .returning();
    competition = updated ?? competition;
    console.log(`Updated ${input.slug}: ${Object.keys(patch).join(", ")}`);
  }
  return competition;
}

async function seedNationWikipediaLinks() {
  const db = getDb();
  let updated = 0;

  const all = [
    ...Object.entries(NATIONS_CHAMPIONSHIP_TEAM_WIKIS).map(([name, wikipediaUrl]) => ({
      name,
      wikipediaUrl,
      aliases: [] as string[],
    })),
    ...NATIONS_CUP_TEAMS.map((t) => ({
      name: t.name,
      wikipediaUrl: t.wikipediaUrl,
      aliases: "aliases" in t ? [...t.aliases] : [],
    })),
  ];

  for (const nation of all) {
    const team = await resolveTeam({
      name: nation.name,
      createIfMissing: true,
      sourceProvider: "wikipedia",
    });
    if (!team) continue;

    const patch: Partial<typeof teams.$inferInsert> = {};
    if (team.teamType !== "international") patch.teamType = "international";
    if (!team.wikipediaUrl) patch.wikipediaUrl = nation.wikipediaUrl;
    if (!team.countryName) patch.countryName = nation.name === "Hong Kong China" ? "Hong Kong" : nation.name;
    if (Object.keys(patch).length) {
      await db.update(teams).set(patch).where(eq(teams.id, team.id));
      updated += 1;
    }

    for (const alias of nation.aliases) {
      const aliasTeam = await resolveTeam({
        name: alias,
        createIfMissing: false,
        sourceProvider: "wikipedia",
      });
      if (!aliasTeam || aliasTeam.id === team.id) continue;
      const aliasPatch: Partial<typeof teams.$inferInsert> = {};
      if (!aliasTeam.wikipediaUrl) aliasPatch.wikipediaUrl = nation.wikipediaUrl;
      if (aliasTeam.teamType !== "international") aliasPatch.teamType = "international";
      if (Object.keys(aliasPatch).length) {
        await db.update(teams).set(aliasPatch).where(eq(teams.id, aliasTeam.id));
        updated += 1;
      }
    }
  }

  console.log(`Nation Wikipedia links: updated ${updated}`);
}

async function seedRosterStandings(competitionId: string, year: number, roster: string[]) {
  const db = getDb();
  const season = await upsertSeason({
    competitionId,
    label: String(year),
    isActive: year === new Date().getFullYear(),
  });

  // Prefer calendar-year label
  if (season.label !== String(year)) {
    await db
      .update(competitionSeasons)
      .set({ label: String(year), slug: String(year) })
      .where(eq(competitionSeasons.id, season.id));
  }

  const existing = await db
    .select({ teamId: standingRows.teamId })
    .from(standingRows)
    .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));
  const existingIds = new Set(existing.map((r) => r.teamId));

  let seeded = 0;
  let rank = existing.length;
  for (const name of roster) {
    const team = await resolveTeam({
      name,
      createIfMissing: true,
      sourceProvider: "wikipedia",
    });
    if (!team || existingIds.has(team.id)) continue;
    if (team.teamType !== "international") {
      await db.update(teams).set({ teamType: "international" }).where(eq(teams.id, team.id));
    }
    rank += 1;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId: team.id,
      view: "overall",
      rank,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: 0,
      tryBonusPoints: 0,
      losingBonusPoints: 0,
      pointsDeduction: 0,
      points: 0,
      form: null,
      syncedAt: new Date(),
    });
    seeded += 1;
  }
  return { seasonId: season.id, seeded };
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

async function importFeeds() {
  console.log("\n=== Feeds: Nations Championship (SDMS) ===");
  try {
    const result = await importPlanetRugbyAllSeasons({
      competitionSlug: "nations-championship",
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
    console.error(`SDMS Nations Championship failed: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n=== Feeds: Rugby Data leagues 184 + 219 ===");
  const championship = await getCompetitionBySlug("nations-championship");
  const cup = await getCompetitionBySlug("world-rugby-nations-cup");
  if (championship) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId: "184",
      rugby365Id: championship.id,
      rugby365Name: championship.name,
      confirmedBy: "cli_nations_championship",
      notes: "World Rugby Nations Championship league 184",
    });
  }
  if (cup) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId: "219",
      rugby365Id: cup.id,
      rugby365Name: cup.name,
      confirmedBy: "cli_nations_cup",
      notes: "World Rugby Nations Cup league 219",
    });
  }

  for (const leagueId of [184, 219]) {
    try {
      const result = await importRugbyDataLeague(leagueId);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Rugby Data ${leagueId} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function importWiki() {
  const pages = [
    {
      slug: "nations-championship",
      url: "https://en.wikipedia.org/wiki/2026_Nations_Championship",
      year: 2026,
    },
    {
      slug: "world-rugby-nations-cup",
      url: "https://en.wikipedia.org/wiki/2026_World_Rugby_Nations_Cup",
      year: 2026,
    },
  ];

  for (const [index, page] of pages.entries()) {
    if (index > 0) await sleep(2500);
    console.log(`\n=== Wikipedia: ${page.slug} ${page.year} ===`);
    console.log(`  ${page.url}`);
    try {
      const report = await importWikipediaSeasonPage(page.url, {
        competitionSlug: page.slug,
        seasonStartYear: page.year,
        mode: "update_existing",
        createMissingTeams: true,
        importFixtures: true,
        importPlayoffs: true,
      });
      console.log(
        `  ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found}) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u playoffs ${report.playoffs.created}c/${report.playoffs.updated}u champion=${report.championName ?? "—"}`,
      );
      if (report.unmappedTeams.length) {
        console.log(`  unmapped: ${report.unmappedTeams.slice(0, 10).join(", ")}`);
      }
      if (report.warnings.length) {
        for (const w of report.warnings.slice(0, 4)) console.log(`  ! ${w}`);
      }
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function main() {
  console.log("=== Nations Championship / Nations Cup import ===");
  console.log(JSON.stringify({ runFeeds, runWiki, runTeams }, null, 2));

  const championship = await ensureCompetition({
    slug: "nations-championship",
    name: "Nations Championship",
    wikipediaUrl: NATIONS_CHAMPIONSHIP_WIKI,
    planetRugbySlug: "nations-championship",
  });
  const cup = await ensureCompetition({
    slug: "world-rugby-nations-cup",
    name: "World Rugby Nations Cup",
    wikipediaUrl: NATIONS_CUP_WIKI,
    planetRugbySlug: "world-rugby-nations-cup",
  });

  await fixCalendarYearLabels(championship.id);
  await fixCalendarYearLabels(cup.id);

  if (runTeams) {
    await seedNationWikipediaLinks();
    const champRoster = [
      ...NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS,
      ...NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS,
    ];
    const cupRoster = NATIONS_CUP_TEAMS.map((t) => t.name);
    const champSeed = await seedRosterStandings(championship.id, 2026, champRoster);
    const cupSeed = await seedRosterStandings(cup.id, 2026, cupRoster);
    console.log(`Championship 2026 roster seed: ${champSeed.seeded}`);
    console.log(`Nations Cup 2026 roster seed: ${cupSeed.seeded}`);
  }

  if (runFeeds) await importFeeds();
  if (runWiki) await importWiki();

  await fixCalendarYearLabels(championship.id);
  await fixCalendarYearLabels(cup.id);

  const db = getDb();
  for (const slug of ["nations-championship", "world-rugby-nations-cup"]) {
    const [comp] = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
    if (!comp) continue;
    const coverage = await db.execute(sql`
      select cs.year, cs.label,
        count(distinct sr.id) filter (where sr.view = 'overall')::int as standings,
        count(distinct f.id)::int as fixtures
      from competition_seasons cs
      left join standing_rows sr on sr.season_id = cs.id
      left join fixtures f on f.season_id = cs.id
      where cs.competition_id = ${comp.id} and cs.is_deprecated = false
      group by cs.year, cs.label
      order by cs.year
    `);
    console.log(`\n=== Coverage ${slug} ===`);
    for (const row of coverage as Array<{ year: number; label: string; standings: number; fixtures: number }>) {
      console.log(`  ${row.year} (${row.label}): ${row.standings}t / ${row.fixtures}f`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
