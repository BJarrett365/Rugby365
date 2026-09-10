/**
 * Generate + publish Rugby Championship Team of the Week for 2012–2026.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rugby-championship-team-of-the-week.ts --publish
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rugby-championship-team-of-the-week.ts --years=2012,2015,2023 --publish
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-rugby-championship-team-of-the-week.ts --dry-run
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { and, eq } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { calculateAndPersistFixtureMatchRatings } from "../apps/web/src/lib/match-rating-service";
import { isFixtureRatingsPublished } from "../apps/web/src/lib/match-rating-math";
import { importRugbyChampionshipTotwInputs } from "../apps/web/src/lib/rugby-championship-totw-import-service";
import {
  generateTeamOfWeek,
  listRoundsForSeason,
  publishTeamOfWeekEdition,
} from "../apps/web/src/lib/team-of-week-service";
import { RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS } from "../apps/web/src/lib/rugby-championship-lineage";

const SLUG = "rugby-championship";
const TOURNAMENT_ROUND_KEY = "team-of-the-tournament";
const args = process.argv.slice(2);
const publish = args.includes("--publish");
const dryRun = args.includes("--dry-run");
const skipImport = args.includes("--skip-import");
const skipRatings = args.includes("--skip-ratings");
const onlyYears =
  args
    .find((a) => a.startsWith("--years="))
    ?.split("=")[1]
    ?.split(",")
    .map((y) => Number(y.trim()))
    .filter((y) => Number.isFinite(y)) ?? [
    2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
  ];

async function rateSeason(seasonId: string, competitionId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: fixtures.id, status: fixtures.status, slug: fixtures.slug })
    .from(fixtures)
    .where(and(eq(fixtures.competitionId, competitionId), eq(fixtures.seasonId, seasonId)));
  const targets = rows.filter((r) => isFixtureRatingsPublished(r.status));
  let ok = 0;
  let failed = 0;
  let players = 0;
  for (const row of targets) {
    try {
      const result = await calculateAndPersistFixtureMatchRatings(row.id);
      ok += 1;
      players += result.calculated;
    } catch {
      failed += 1;
    }
  }
  return { attempted: targets.length, ok, failed, players };
}

async function main() {
  console.log("=== Rugby Championship Team of the Week backfill ===");
  console.log(JSON.stringify({ onlyYears, publish, dryRun, skipImport, skipRatings }, null, 2));

  const db = getDb();
  const [competition] = await db.select().from(competitions).where(eq(competitions.slug, SLUG)).limit(1);
  if (!competition) throw new Error(`Missing competition ${SLUG}`);

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.isDeprecated, false)));

  for (const year of onlyYears) {
    if (RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS.has(year)) {
      console.log(`\n→ ${year} not held — skipping generate`);
      continue;
    }
    const season = seasons.find((s) => s.year === year);
    if (!season) {
      console.log(`\n! no season for ${year}`);
      continue;
    }
    console.log(`\n→ ${season.label}`);

    if (!dryRun && !skipImport) {
      const imported = await importRugbyChampionshipTotwInputs(year);
      console.log(
        `  import wiki=${imported.wikipediaMatches}/${imported.wikipediaPlayers} sdms=${imported.sdmsMatches}/${imported.sdmsPlayers} warnings=${imported.warnings.length}`,
      );
      for (const warning of imported.warnings.slice(0, 8)) console.log(`    ! ${warning}`);
    }

    if (!dryRun && !skipRatings) {
      const ratings = await rateSeason(season.id, competition.id);
      console.log(
        `  ratings attempted=${ratings.attempted} ok=${ratings.ok} players=${ratings.players} failed=${ratings.failed}`,
      );
    }

    const rounds = await listRoundsForSeason({
      competitionId: competition.id,
      seasonId: season.id,
    });
    const eligible = rounds.filter((r) => r.completedCount > 0 && r.ratedPlayerCount >= 8);
    console.log(`  rounds eligible=${eligible.length} (+ tournament)`);

    let generated = 0;
    let published = 0;
    let failed = 0;
    for (const roundKey of [...eligible.map((r) => r.roundKey), TOURNAMENT_ROUND_KEY].filter(
      (key, index, all) => all.indexOf(key) === index,
    )) {
      if (dryRun) {
        const round = eligible.find((r) => r.roundKey === roundKey);
        console.log(`    dry ${roundKey} rated=${round?.ratedPlayerCount ?? "tournament"}`);
        continue;
      }
      try {
        const result = await generateTeamOfWeek({
          competitionId: competition.id,
          seasonId: season.id,
          roundKey,
        });
        generated += 1;
        if (publish) {
          await publishTeamOfWeekEdition(result.editionId, undefined, { allowProvisional: true });
          published += 1;
        }
        console.log(
          `    ✓ ${roundKey} starting=${result.startingCount} provisional=${result.provisional}`,
        );
      } catch (error) {
        failed += 1;
        console.error(`    ✗ ${roundKey}: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log(`  totw generated=${generated} published=${published} failed=${failed}`);
  }

  console.log("\nDone. Public: /competitions/rugby-championship/team-of-the-week");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
