/**
 * Bootstrap + import Northern Hemisphere international seasons from Wikipedia.
 *
 * Covers gaps for:
 *   - Six Nations / Five Nations (1995+)
 *   - Rugby World Cup (1987–2027)
 *   - Rugby Europe Championship (2017+)
 *   - End-of-year / Autumn Internationals (verified Wikipedia pages)
 *   - Autumn Nations Cup 2020
 *
 * Also links the NH national team Wikipedia pages and ensures Czech Republic exists.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-northern-hemisphere-internationals.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-northern-hemisphere-internationals.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-northern-hemisphere-internationals.ts --competition=six-nations
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-northern-hemisphere-internationals.ts --gaps-only
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-wikipedia-northern-hemisphere-internationals.ts --year=2008
 */
import { and, eq, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  standingRows,
  teams,
} from "@rugby365/db";
import {
  AUTUMN_NATIONS_CUP_SEASONS,
  END_OF_YEAR_INTERNATIONALS_SEASONS,
  NORTHERN_HEMISPHERE_NATIONS,
  RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS,
  RUGBY_WORLD_CUP_CHAMPIONS,
  SIX_NATIONS_CHAMPIONS,
} from "../apps/web/src/lib/competition-champions-catalog";
import {
  createCompetition,
  getCompetitionBySlug,
  updateCompetition,
  upsertSeason,
} from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import {
  autumnNationsCupWikipediaSeasonUrls,
  endOfYearInternationalsWikipediaSeasonUrls,
  importWikipediaSeasonPage,
  rugbyEuropeChampionshipWikipediaSeasonUrls,
  rugbyWorldCupWikipediaSeasonUrls,
  sixNationsWikipediaSeasonUrls,
} from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const gapsOnly = args.includes("--gaps-only") || !args.includes("--all");
const onlyCompetition = args.find((a) => a.startsWith("--competition="))?.split("=")[1] ?? null;
const onlyYear = args.find((a) => a.startsWith("--year="))?.split("=")[1] ?? null;
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2500);

type CompPlan = {
  slug: string;
  name: string;
  competitionType: "international" | "world_cup";
  wikipediaUrl: string;
  catalog: Array<{ startYear: number; url: string; winner: string }>;
  /** Existing DB slug aliases to treat as the same competition when auditing gaps. */
  aliasSlugs?: string[];
};

const PLANS: CompPlan[] = [
  {
    slug: "six-nations",
    name: "Six Nations",
    competitionType: "international",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Six_Nations_Championship",
    catalog: sixNationsWikipediaSeasonUrls(),
  },
  {
    slug: "rugby-world-cup",
    name: "Rugby World Cup",
    competitionType: "world_cup",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Rugby_World_Cup",
    catalog: rugbyWorldCupWikipediaSeasonUrls(),
  },
  {
    slug: "rugby-europe-championship",
    name: "Rugby Europe Championship",
    competitionType: "international",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Rugby_Europe_Championship",
    catalog: rugbyEuropeChampionshipWikipediaSeasonUrls(),
  },
  {
    slug: "end-of-year-internationals",
    name: "End-of-year Internationals",
    competitionType: "international",
    wikipediaUrl: "https://en.wikipedia.org/wiki/End-of-year_rugby_union_internationals",
    catalog: endOfYearInternationalsWikipediaSeasonUrls(),
  },
  {
    slug: "autumn-nations-cup",
    name: "Autumn Nations Cup",
    competitionType: "international",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Autumn_Nations_Cup",
    catalog: autumnNationsCupWikipediaSeasonUrls(),
    aliasSlugs: ["autumn-nations-cup-vx917e9w"],
  },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCompetition(plan: CompPlan) {
  const db = getDb();
  let competition = await getCompetitionBySlug(plan.slug);

  if (!competition && plan.aliasSlugs?.length) {
    for (const alias of plan.aliasSlugs) {
      const existing = await getCompetitionBySlug(alias);
      if (existing) {
        await updateCompetition(existing.id, {
          name: plan.name,
          slug: plan.slug,
          competitionType: plan.competitionType,
        });
        competition = await getCompetitionBySlug(plan.slug);
        console.log(`Renamed ${alias} → ${plan.slug}`);
        break;
      }
    }
  }

  if (!competition) {
    competition = await createCompetition({
      name: plan.name,
      slug: plan.slug,
      competitionType: plan.competitionType,
    });
    console.log(`Created competition ${plan.slug}`);
  } else if (competition.competitionType !== plan.competitionType) {
    await updateCompetition(competition.id, { competitionType: plan.competitionType });
    console.log(`Fixed ${plan.slug} type → ${plan.competitionType}`);
  }

  await db
    .update(competitions)
    .set({ wikipediaUrl: plan.wikipediaUrl })
    .where(eq(competitions.id, competition!.id));

  return competition!;
}

async function existingSeasonYears(competitionId: string) {
  const db = getDb();
  const rows = await db
    .select({ year: competitionSeasons.year })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));
  return new Set(rows.map((r) => r.year));
}

async function seedNationWikipediaLinks() {
  const db = getDb();
  let updated = 0;

  for (const nation of NORTHERN_HEMISPHERE_NATIONS) {
    const team = await resolveTeam({
      name: nation.name,
      createIfMissing: true,
      sourceProvider: "wikipedia",
    });
    if (!team) continue;

    const patch: Partial<typeof teams.$inferInsert> = {};
    if (team.teamType !== "international") patch.teamType = "international";
    if (!team.wikipediaUrl) patch.wikipediaUrl = nation.wikipediaUrl;
    if (!team.countryName) patch.countryName = nation.name;
    if (Object.keys(patch).length) {
      await db.update(teams).set(patch).where(eq(teams.id, team.id));
      updated += 1;
    }
  }

  console.log(`Nation Wikipedia links: updated ${updated}, roster size ${NORTHERN_HEMISPHERE_NATIONS.length}`);
}

async function seedNationsOntoSeason(seasonId: string, nationNames: string[]) {
  const db = getDb();
  let created = 0;
  for (const [index, name] of nationNames.entries()) {
    const team = await resolveTeam({
      name,
      createIfMissing: true,
      sourceProvider: "wikipedia",
    });
    if (!team) continue;
    if (team.teamType !== "international") {
      await db.update(teams).set({ teamType: "international" }).where(eq(teams.id, team.id));
    }
    const [existing] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, seasonId),
          eq(standingRows.teamId, team.id),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existing) continue;
    await db.insert(standingRows).values({
      seasonId,
      teamId: team.id,
      view: "overall",
      rank: index + 1,
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
    created += 1;
  }
  return created;
}

async function main() {
  console.log("=== Northern Hemisphere internationals Wikipedia import ===");
  console.log(JSON.stringify({ auditOnly, gapsOnly, onlyCompetition, onlyYear, delayMs }, null, 2));

  await seedNationWikipediaLinks();

  const summary = {
    competitions: 0,
    seasonsImported: 0,
    seasonsSkipped: 0,
    failed: 0,
  };

  for (const plan of PLANS) {
    if (onlyCompetition && plan.slug !== onlyCompetition) continue;

    const competition = await ensureCompetition(plan);
    summary.competitions += 1;
    const existingYears = await existingSeasonYears(competition.id);

    let seasons = plan.catalog;
    if (onlyYear) {
      // Explicit --year always re-imports that season (even if the shell already exists).
      seasons = seasons.filter((s) => String(s.startYear) === onlyYear);
    } else if (gapsOnly) {
      seasons = seasons.filter((s) => !existingYears.has(s.startYear));
    }

    // Prefer importing seasons that lack standings even if the season row exists.
    if (gapsOnly && !onlyYear) {
      const thin = await getDb().execute(sql`
        select s.year
        from competition_seasons s
        where s.competition_id = ${competition.id}
          and not exists (select 1 from standing_rows sr where sr.season_id = s.id)
      `);
      const thinYears = new Set((thin as Array<{ year: number }>).map((r) => r.year));
      const thinCatalog = plan.catalog.filter((s) => thinYears.has(s.startYear));
      const merged = new Map<number, (typeof seasons)[number]>();
      for (const s of [...seasons, ...thinCatalog]) merged.set(s.startYear, s);
      seasons = [...merged.values()].sort((a, b) => a.startYear - b.startYear);
    }

    console.log(`\n→ ${plan.name} (${plan.slug}): ${seasons.length} season(s) to import`);
    if (auditOnly) {
      for (const s of seasons) console.log(`  · ${s.startYear} ${s.url}`);
      continue;
    }

    for (const [index, season] of seasons.entries()) {
      if (index > 0) await sleep(delayMs);
      console.log(`  [${index + 1}/${seasons.length}] ${season.startYear} (${season.winner})`);
      console.log(`    ${season.url}`);
      try {
        const report = await importWikipediaSeasonPage(season.url, {
          competitionSlug: plan.slug,
          seasonStartYear: season.startYear,
          mode: "update_existing",
          createMissingTeams: true,
          importFixtures: true,
          importPlayoffs: true,
        });
        summary.seasonsImported += 1;
        console.log(
          `    ✓ table ${report.table.created}c/${report.table.updated}u (${report.table.found}) fixtures ${report.fixtures.created}c/${report.fixtures.updated}u`,
        );
        if (report.unmappedTeams.length) {
          console.log(`    unmapped: ${report.unmappedTeams.slice(0, 8).join(", ")}`);
        }

        // Ensure Six Nations / Rugby Europe always have the core NH nations visible in Admin → Teams.
        if (plan.slug === "six-nations" || plan.slug === "rugby-europe-championship") {
          const nationNames =
            plan.slug === "six-nations"
              ? ["England", "France", "Ireland", "Italy", "Scotland", "Wales"]
              : NORTHERN_HEMISPHERE_NATIONS.map((n) => n.name).filter(
                  (n) => !["England", "France", "Ireland", "Italy", "Scotland", "Wales"].includes(n),
                );
          const seeded = await seedNationsOntoSeason(report.seasonId, nationNames);
          if (seeded) console.log(`    seeded ${seeded} nation standing rows`);
        }
      } catch (error) {
        summary.failed += 1;
        summary.seasonsSkipped += 1;
        console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // Keep Autumn Nations Cup alias season rows usable even when Wikipedia import is limited.
  if (!auditOnly && (!onlyCompetition || onlyCompetition === "autumn-nations-cup")) {
    const cup = await getCompetitionBySlug("autumn-nations-cup");
    if (cup) {
      const season = await upsertSeason({
        competitionId: cup.id,
        label: "2020",
        isActive: false,
        seasonKind: "international",
      });
      const seeded = await seedNationsOntoSeason(
        season.id,
        ["England", "France", "Ireland", "Italy", "Scotland", "Wales", "Georgia", "Fiji"],
      );
      console.log(`Autumn Nations Cup 2020 roster seed: ${seeded} rows`);
    }
  }

  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("Catalog sizes:", {
    sixNations: SIX_NATIONS_CHAMPIONS.length,
    worldCup: RUGBY_WORLD_CUP_CHAMPIONS.length,
    rugbyEurope: RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS.length,
    endOfYear: END_OF_YEAR_INTERNATIONALS_SEASONS.length,
    autumnCup: AUTUMN_NATIONS_CUP_SEASONS.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
