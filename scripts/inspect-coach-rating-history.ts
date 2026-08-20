import { asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { coaches, coachRatingHistory, coachRatingSnapshots } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function inspectCoach(slug: string) {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, slug)).limit(1);
  if (!coach) {
    console.log("missing", slug);
    return;
  }
  const hist = await db
    .select()
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, coach.id))
    .orderBy(asc(coachRatingHistory.calculatedAt));
  const withFx = hist.filter((h) => h.fixtureId != null);
  const snaps = await db
    .select({
      calculatedAt: coachRatingSnapshots.calculatedAt,
      overallRating: coachRatingSnapshots.overallRating,
      fixtureId: coachRatingSnapshots.fixtureId,
      modelVersion: coachRatingSnapshots.modelVersion,
      powerIndexVersion: coachRatingSnapshots.powerIndexVersion,
      dataConfidence: coachRatingSnapshots.dataConfidence,
    })
    .from(coachRatingSnapshots)
    .where(eq(coachRatingSnapshots.coachId, coach.id))
    .orderBy(asc(coachRatingSnapshots.calculatedAt));

  console.log("\n===", coach.name, `(${slug}) ===`);
  console.log("history rows", hist.length, "with fixtureId", withFx.length);
  console.log("snapshots", snaps.length, "with fixtureId", snaps.filter((s) => s.fixtureId).length);
  if (hist[0]) {
    console.log("earliest history", {
      at: hist[0].calculatedAt,
      rating: hist[0].rating,
      change: hist[0].change,
      fixtureId: hist[0].fixtureId,
      modelVersion: hist[0].modelVersion,
    });
  }
  if (hist.at(-1)) {
    const latest = hist.at(-1)!;
    console.log("latest history", {
      at: latest.calculatedAt,
      rating: latest.rating,
      change: latest.change,
      fixtureId: latest.fixtureId,
      modelVersion: latest.modelVersion,
    });
  }
  console.log(
    "history versions",
    [...new Set(hist.map((h) => h.modelVersion))],
  );
  console.log(
    "sample ratings",
    hist.slice(0, 5).map((h) => `${h.calculatedAt.toISOString().slice(0, 10)}=${h.rating}`),
    "...",
    hist.slice(-3).map((h) => `${h.calculatedAt.toISOString().slice(0, 10)}=${h.rating}`),
  );
}

async function main() {
  const db = getDb();
  const [h] = await db.select({ n: count() }).from(coachRatingHistory);
  const [s] = await db.select({ n: count() }).from(coachRatingSnapshots);
  const [hFx] = await db
    .select({ n: count() })
    .from(coachRatingHistory)
    .where(isNotNull(coachRatingHistory.fixtureId));
  const [hNull] = await db
    .select({ n: count() })
    .from(coachRatingHistory)
    .where(isNull(coachRatingHistory.fixtureId));
  console.log("GLOBAL history", h.n, "fixture-linked", hFx.n, "null fixture", hNull.n);
  console.log("GLOBAL snapshots", s.n);

  await inspectCoach("rassie-erasmus");
  await inspectCoach("johann-van-graan");
  await inspectCoach("mark-brown");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
