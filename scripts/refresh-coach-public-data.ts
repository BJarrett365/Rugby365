/**
 * Persist coach public-page data to Rugby365 Supabase.
 * Uses lite rating snapshots (no 800-peer scan).
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/refresh-coach-public-data.ts
 */
import { and, eq, ilike, inArray, isNull } from "drizzle-orm";
import {
  coachPlayingStints,
  coachRatingHistory,
  teams,
  venues,
  worldRankingFeeds,
  worldRankingRows,
} from "@rugby365/db";
import { CURRENT_COACH_ASSIGNMENTS } from "../apps/web/src/lib/assign-current-coaches-service";
import { resolveCoach } from "../apps/web/src/lib/coach-admin-service";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";
import { setCoachPrimaryImage } from "../apps/web/src/lib/coach-image-service";
import {
  listCoachWorldRankings,
  persistLiteCoachRatingSnapshot,
} from "../apps/web/src/lib/coach-rating-service";
import { synthesizeRatingTrendsFromMatches } from "../apps/web/src/lib/coach-rating-trends-service";
import { getDb } from "../apps/web/src/lib/db";
import { fetchWikipediaThumbnails } from "../apps/web/src/lib/wikipedia-page-image";

const FARRELL_ID = "1beeacf9-0b1e-4ae7-80b6-00c4b298f050";

const NATION_META: Array<{ name: string; foundedYear: number; venue: string }> = [
  { name: "Ireland", foundedYear: 1879, venue: "Aviva Stadium" },
  { name: "England", foundedYear: 1871, venue: "Twickenham Stadium" },
  { name: "Wales", foundedYear: 1881, venue: "Principality Stadium" },
  { name: "Scotland", foundedYear: 1873, venue: "Murrayfield Stadium" },
  { name: "France", foundedYear: 1919, venue: "Stade de France" },
  { name: "Italy", foundedYear: 1928, venue: "Stadio Olimpico" },
  { name: "South Africa", foundedYear: 1889, venue: "Ellis Park Stadium" },
  { name: "New Zealand", foundedYear: 1892, venue: "Eden Park" },
  { name: "Australia", foundedYear: 1949, venue: "Stadium Australia" },
  { name: "Argentina", foundedYear: 1899, venue: "José Amalfitani Stadium" },
];

const INTERNATIONAL_SLUGS = new Set(
  CURRENT_COACH_ASSIGNMENTS.filter((row) =>
    [
      "ireland-m46v8v9z",
      "england-5294m098",
      "wales",
      "scotland",
      "france-go9p0p68",
      "south-africa",
      "new-zealand",
      "australia",
      "italy-n0620o98",
      "japan",
      "argentina",
      "fiji",
      "united-states-216mky9n",
      "samoa-016oqwj5",
      "georgia-zd935n6v",
      "canada-k76k4rjy",
      "uruguay-og9n31jl",
      "chile-pm6wdmj4",
    ].includes(row.teamSlug),
  ).map((row) => row.teamSlug),
);

async function fillNationTeams() {
  const db = getDb();
  for (const meta of NATION_META) {
    const [venue] = await db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(ilike(venues.name, `%${meta.venue.replace(/stadium/i, "").trim()}%`))
      .limit(1);
    const rows = await db
      .select({
        id: teams.id,
        foundedYear: teams.foundedYear,
        homeVenueId: teams.homeVenueId,
      })
      .from(teams)
      .where(eq(teams.name, meta.name));
    for (const row of rows) {
      const patch: { foundedYear?: number; homeVenueId?: string } = {};
      if (row.foundedYear == null) patch.foundedYear = meta.foundedYear;
      if (!row.homeVenueId && venue?.id) patch.homeVenueId = venue.id;
      if (Object.keys(patch).length === 0) continue;
      await db.update(teams).set(patch).where(eq(teams.id, row.id));
      console.log(`  team ${meta.name} ${row.id.slice(0, 8)}`, patch);
    }
  }
}

async function linkWorldRankingTeams() {
  const db = getDb();
  const [feed] = await db
    .select()
    .from(worldRankingFeeds)
    .where(eq(worldRankingFeeds.category, "mru"))
    .limit(1);
  if (!feed?.currentSnapshotId) {
    console.log("  no current MRU ranking snapshot");
    return;
  }
  const rows = await db
    .select({
      id: worldRankingRows.id,
      teamName: worldRankingRows.teamName,
      teamId: worldRankingRows.teamId,
    })
    .from(worldRankingRows)
    .where(and(eq(worldRankingRows.snapshotId, feed.currentSnapshotId), isNull(worldRankingRows.teamId)));
  for (const row of rows) {
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, row.teamName))
      .limit(1);
    if (!team) continue;
    await db.update(worldRankingRows).set({ teamId: team.id }).where(eq(worldRankingRows.id, row.id));
    console.log(`  linked ranking ${row.teamName} → ${team.id.slice(0, 8)}`);
  }
}

async function persistInternationalSnapshots() {
  const international = CURRENT_COACH_ASSIGNMENTS.filter((row) => INTERNATIONAL_SLUGS.has(row.teamSlug));
  const seen = new Set<string>();
  for (const row of international) {
    const coach = await resolveCoach({ name: row.coachName, createIfMissing: false });
    if (!coach || seen.has(coach.id)) continue;
    seen.add(coach.id);
    process.stdout.write(`  snapshot ${coach.name}… `);
    try {
      const bundle = await persistLiteCoachRatingSnapshot(coach.id, {
        skipIntelligence: coach.id !== FARRELL_ID,
      });
      console.log(
        `rating=${bundle.overallRating ?? "—"} power=${bundle.powerIndex ?? "—"} matches=${bundle.matchCount}`,
      );
      if (!coach.imageUrl) {
        const thumbs = await fetchWikipediaThumbnails([
          coach.name,
          `${coach.name} rugby`,
          `${coach.name} rugby coach`,
        ]);
        const url =
          thumbs.get(coach.name) ||
          thumbs.get(`${coach.name} rugby`) ||
          thumbs.get(`${coach.name} rugby coach`);
        if (url) {
          await setCoachPrimaryImage({
            coachId: coach.id,
            imageUrl: url,
            sourceProvider: "wikipedia",
            credit: "Wikipedia",
          });
          console.log(`    image ${url}`);
        }
      }
    } catch (error) {
      console.log("FAILED", error instanceof Error ? error.message : error);
    }
  }
}

async function backfillFarrellHistory() {
  const db = getDb();
  const matches = await loadCoachEligibleMatches(FARRELL_ID, { primaryOnly: true });
  const points = synthesizeRatingTrendsFromMatches(FARRELL_ID, matches);
  let written = 0;
  for (const point of points) {
    if (!point.fixtureId) continue;
    const [existing] = await db
      .select({ id: coachRatingHistory.id })
      .from(coachRatingHistory)
      .where(
        and(eq(coachRatingHistory.coachId, FARRELL_ID), eq(coachRatingHistory.fixtureId, point.fixtureId)),
      )
      .limit(1);
    if (existing) continue;
    await db.insert(coachRatingHistory).values({
      coachId: FARRELL_ID,
      fixtureId: point.fixtureId,
      snapshotType: "backfilled",
      rating: point.rating,
      previousRating: point.previousRating,
      change: point.change,
      matchDate: point.matchDate ? new Date(point.matchDate) : new Date(),
      result: point.result,
      scoreFor: point.scoreFor,
      scoreAgainst: point.scoreAgainst,
      teamId: point.teamId,
      teamName: point.teamName,
      opponentId: point.opponentId,
      opponentName: point.opponentName,
      competitionName: point.competitionName,
      fixtureSlug: point.fixtureSlug,
      homeAwayNeutral: point.homeAwayNeutral,
      majorMatchLabel: point.majorMatchLabel,
      powerIndex: point.powerIndex,
      powerIndexChange: point.powerIndexChange,
      confidence: point.confidence,
      coverage: point.coverage,
      dataConfidence: point.dataConfidence,
      modelVersion: point.modelVersion,
      contributions: point.contributions,
      intelligence: point.intelligence,
      metrics: {},
    });
    written += 1;
  }
  console.log(`  Farrell history written ${written} / ${points.length}`);
}

async function resolveFarrellPlayingStints() {
  const db = getDb();
  const stints = await db
    .select()
    .from(coachPlayingStints)
    .where(eq(coachPlayingStints.coachId, FARRELL_ID));
  for (const stint of stints) {
    const names = [
      stint.teamName,
      stint.teamDisplayName,
      stint.teamName.replace(/\s+national rugby (union|league) team$/i, ""),
    ].filter((name): name is string => Boolean(name?.trim()));
    if (/^wigan$/i.test(stint.teamName)) names.push("Wigan Warriors");
    if (/saracens/i.test(stint.teamName)) names.push("Saracens");
    if (/great britain/i.test(stint.teamName)) names.push("Great Britain");
    if (/england/i.test(stint.teamName) && stint.teamType === "international") names.push("England");
    const [team] = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.name, [...new Set(names)]))
      .limit(1);
    const patch: { teamId?: string; apps?: number; teamType?: string; careerType?: string } = {};
    if (!stint.teamId && team) patch.teamId = team.id;
    if (/england/i.test(stint.teamName) && stint.teamType !== "international") {
      patch.teamType = "international";
      patch.careerType = "international_player";
    }
    if (Object.keys(patch).length === 0) continue;
    await db.update(coachPlayingStints).set(patch).where(eq(coachPlayingStints.id, stint.id));
    console.log(`  stint ${stint.teamName}`, patch);
  }
}

async function main() {
  console.log("1. Nation team metadata");
  await fillNationTeams();
  console.log("2. World ranking team links");
  await linkWorldRankingTeams();
  console.log("3. International coach lite snapshots");
  await persistInternationalSnapshots();
  console.log("4. Farrell rating history");
  await backfillFarrellHistory();
  console.log("5. Farrell playing stints");
  await resolveFarrellPlayingStints();
  console.log("6. World coach board");
  const board = await listCoachWorldRankings(15);
  for (const row of board) {
    console.log(
      `  #${row.rank} ${row.name} ${row.rating.toFixed(1)} ${row.currentTeamName ?? "—"} image=${row.imageUrl ? "yes" : "no"}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
