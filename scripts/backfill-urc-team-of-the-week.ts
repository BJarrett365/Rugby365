/**
 * Generate + publish URC Team of the Week for seasons that already have match ratings.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc-team-of-the-week.ts --publish
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc-team-of-the-week.ts --years=2024,2025 --publish
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-urc-team-of-the-week.ts --dry-run
 */
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { calculateAndPersistFixtureMatchRatings } from "../apps/web/src/lib/match-rating-service";
import { isFixtureRatingsPublished } from "../apps/web/src/lib/match-rating-math";
import {
  generateTeamOfWeek,
  listRoundsForSeason,
  publishTeamOfWeekEdition,
} from "../apps/web/src/lib/team-of-week-service";

const SLUG = "united-rugby-championship";
const args = process.argv.slice(2);
const publish = args.includes("--publish");
const dryRun = args.includes("--dry-run");
const skipRatings = args.includes("--skip-ratings");
const onlyYears =
  args
    .find((a) => a.startsWith("--years="))
    ?.split("=")[1]
    ?.split(",")
    .map((y) => Number(y.trim()))
    .filter((y) => Number.isFinite(y)) ?? [2023, 2024, 2025];
const maxRounds = Number(args.find((a) => a.startsWith("--max-rounds="))?.split("=")[1] ?? "0") || 0;

async function ensureRatings(seasonId: string, competitionId: string) {
  if (skipRatings) return { attempted: 0, ok: 0, failed: 0 };
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      ratingCount: sql<number>`(
        select count(*)::int from player_match_ratings pmr where pmr.fixture_id = ${fixtures.id}
      )`,
    })
    .from(fixtures)
    .where(and(eq(fixtures.competitionId, competitionId), eq(fixtures.seasonId, seasonId)));

  const need = rows.filter(
    (r) => isFixtureRatingsPublished(r.status) && Number(r.ratingCount) < 8,
  );
  let ok = 0;
  let failed = 0;
  for (const row of need.slice(0, 40)) {
    try {
      await calculateAndPersistFixtureMatchRatings(row.id);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { attempted: Math.min(need.length, 40), ok, failed };
}

async function main() {
  console.log("=== URC Team of the Week backfill ===");
  console.log(JSON.stringify({ onlyYears, publish, dryRun, skipRatings, maxRounds }, null, 2));

  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, SLUG))
    .limit(1);
  if (!competition) throw new Error(`Missing competition ${SLUG}`);

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.competitionId, competition.id),
        eq(competitionSeasons.isDeprecated, false),
      ),
    );

  for (const year of onlyYears) {
    const season = seasons.find((s) => s.year === year);
    if (!season) {
      console.log(`\n! no season for ${year}`);
      continue;
    }
    console.log(`\n→ ${season.label}`);

    if (!dryRun) {
      const ratings = await ensureRatings(season.id, competition.id);
      console.log(
        `  ratings repair: attempted=${ratings.attempted} ok=${ratings.ok} failed=${ratings.failed}`,
      );
    }

    const rounds = await listRoundsForSeason({
      competitionId: competition.id,
      seasonId: season.id,
    });
    const eligible = rounds
      .filter((r) => r.completedCount > 0 && r.ratedPlayerCount >= 8)
      .sort((a, b) => (a.roundNumber ?? 999) - (b.roundNumber ?? 999));
    const targets = maxRounds > 0 ? eligible.slice(0, maxRounds) : eligible;
    console.log(`  rounds eligible=${eligible.length} targeting=${targets.length}`);

    let generated = 0;
    let published = 0;
    let failed = 0;
    for (const round of targets) {
      if (dryRun) {
        console.log(
          `    dry ${round.roundKey} completed=${round.completedCount} rated=${round.ratedPlayerCount}`,
        );
        continue;
      }
      try {
        const result = await generateTeamOfWeek({
          competitionId: competition.id,
          seasonId: season.id,
          roundKey: round.roundKey,
        });
        generated += 1;
        if (publish) {
          await publishTeamOfWeekEdition(result.editionId);
          published += 1;
        }
        console.log(
          `    ✓ ${round.roundKey} starting=${result.startingCount} provisional=${result.provisional}`,
        );
      } catch (error) {
        failed += 1;
        console.error(
          `    ✗ ${round.roundKey}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    console.log(`  totw generated=${generated} published=${published} failed=${failed}`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
