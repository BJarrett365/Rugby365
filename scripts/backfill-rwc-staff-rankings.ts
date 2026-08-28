/**
 * Backfill RWC coach/referee match ratings for archive seasons.
 * Does not attach current team staff to historical fixtures.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-staff-rankings.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/backfill-rwc-staff-rankings.ts --cleanup-only
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures, refereeMatchRatings, referees } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { mergeRefereeRecords } from "../apps/web/src/lib/entity-dedup-service";
import { backfillStaffMatchRatingsForCompetitionSeason } from "../apps/web/src/lib/staff-match-rating-service";

const CANCELLED_2019_SLUGS = [
  "england-5294m098-v-france-go9p0p68-2019-10-12",
  "all-blacks-v-italy-n0620o98-2019-10-12",
  "namibia-wrmru58-v-canada-wrmru50-2019-10-13",
];

async function unlinkCancelled2019Unknowns() {
  const db = getDb();
  const rows = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(inArray(fixtures.slug, CANCELLED_2019_SLUGS));
  const ids = rows.map((row) => row.id);
  if (!ids.length) return 0;
  await db.delete(refereeMatchRatings).where(inArray(refereeMatchRatings.fixtureId, ids));
  await db
    .update(fixtures)
    .set({ refereeId: null, refereeName: null })
    .where(inArray(fixtures.id, ids));
  return ids.length;
}

async function mergePaulMarksIntoWilliams() {
  const db = getDb();
  const marks = await db
    .select({ id: referees.id })
    .from(referees)
    .where(eq(referees.name, "Paul Marks"));
  const [williams] = await db.execute<{ id: string }>(sql`
    SELECT r.id
    FROM referees r
    JOIN referee_match_ratings rmr ON rmr.referee_id = r.id
    JOIN competitions c ON c.id = rmr.competition_id
    WHERE c.slug = 'rugby-world-cup' AND r.name = 'Paul Williams'
    LIMIT 1
  `);
  if (!williams?.id || !marks.length) return;
  await mergeRefereeRecords(williams.id, marks.map((row) => row.id));
  console.log(`merged Paul Marks → Paul Williams (${marks.length})`);
}

async function syncRatingSeasonIds() {
  const db = getDb();
  await db.execute(sql`
    UPDATE referee_match_ratings rmr
    SET season_id = f.season_id, competition_id = f.competition_id
    FROM fixtures f
    WHERE rmr.fixture_id = f.id
      AND (rmr.season_id IS DISTINCT FROM f.season_id
        OR rmr.competition_id IS DISTINCT FROM f.competition_id)
  `);
  await db.execute(sql`
    UPDATE coach_match_ratings cmr
    SET season_id = f.season_id, competition_id = f.competition_id
    FROM fixtures f
    WHERE cmr.fixture_id = f.id
      AND (cmr.season_id IS DISTINCT FROM f.season_id
        OR cmr.competition_id IS DISTINCT FROM f.competition_id)
  `);
  console.log("synced rating season/competition ids from fixtures");
}

function canonicalRefereeName(name: string): string {
  return name
    .replace(/\s*replaced by[\s\S]*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function mergeSuffixedRefereeDuplicates() {
  const db = getDb();
  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT r.id, r.name
    FROM referees r
    JOIN fixtures f ON f.referee_id = r.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
  `);
  const byCanonical = new Map<string, { id: string; name: string }[]>();
  for (const row of rows) {
    const key = canonicalRefereeName(row.name).toLowerCase();
    if (!key) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(row);
    byCanonical.set(key, list);
  }
  let merged = 0;
  for (const [, group] of byCanonical) {
    if (group.length < 2) continue;
    const canonical =
      group.find((row) => canonicalRefereeName(row.name) === row.name) ?? group[0]!;
    const dups = group.filter((row) => row.id !== canonical.id).map((row) => row.id);
    if (!dups.length) continue;
    await mergeRefereeRecords(canonical.id, dups);
    merged += dups.length;
    console.log(`merged ${dups.length} → ${canonical.name}`);
  }
  console.log(`suffixed referee merges=${merged}`);
}

async function main() {
  const cleanupOnly = process.argv.includes("--cleanup-only");
  const unlinked = await unlinkCancelled2019Unknowns();
  console.log(`unlinked cancelled 2019 unknown-ref fixtures=${unlinked}`);
  await mergePaulMarksIntoWilliams();
  await mergeSuffixedRefereeDuplicates();
  await syncRatingSeasonIds();
  if (cleanupOnly) return;

  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) throw new Error("rugby-world-cup missing");

  const seasons = await db
    .select({ id: competitionSeasons.id, year: competitionSeasons.year })
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), sql`${competitionSeasons.year} <= 2023`))
    .orderBy(competitionSeasons.year);

  for (const season of seasons) {
    const result = await backfillStaffMatchRatingsForCompetitionSeason(competition.id, season.id, {
      fillCurrentCoaches: false,
    });
    console.log(
      `${season.year}: fixtures=${result.fixturesProcessed} coaches=${result.coachesCalculated} refs=${result.refereeCalculated}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
