/**
 * Enrich South Africa (Springboks) public team profile from existing pipes.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-south-africa-team.ts
 */
import { eq, sql } from "drizzle-orm";
import { teams, venues } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { importWikipediaArchive } from "../apps/web/src/lib/wikipedia-import-service";
import { assignCurrentCoaches } from "../apps/web/src/lib/assign-current-coaches-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const WIKI = "https://en.wikipedia.org/wiki/South_Africa_national_rugby_union_team";

async function resolveEllisParkOrCapeTown(db: ReturnType<typeof getDb>) {
  const candidates = [
    "Ellis Park Stadium",
    "Ellis Park",
    "Emirates Airline Park",
    "Loftus Versfeld",
    "Cape Town Stadium",
  ];
  for (const name of candidates) {
    const [row] = await db
      .select()
      .from(venues)
      .where(sql`lower(${venues.name}) = ${name.toLowerCase()}`)
      .limit(1);
    if (row) return row;
  }
  const [fuzzy] = await db
    .select()
    .from(venues)
    .where(sql`${venues.name} ilike ${"%ellis%park%"}`)
    .limit(1);
  return fuzzy ?? null;
}

async function main() {
  const db = getDb();
  const dryRun = process.argv.includes("--dry-run");
  const skipWiki = process.argv.includes("--skip-wiki");

  const [before] = await db.select().from(teams).where(eq(teams.id, SA_ID)).limit(1);
  if (!before) throw new Error("South Africa team not found");

  console.log("Before:", {
    name: before.name,
    shortName: before.shortName,
    foundedYear: before.foundedYear,
    region: before.region,
    bioLen: before.bioSummary?.length ?? 0,
    imageUrl: before.imageUrl?.slice(0, 60) ?? null,
    homeVenueId: before.homeVenueId,
  });

  if (!skipWiki) {
    console.log("\n→ Wikipedia team archive import…");
    if (!dryRun) {
      const result = await importWikipediaArchive({
        articleTitleOrUrl: WIKI,
        entityType: "team",
        linkEntityId: SA_ID,
      });
      console.log("Wiki import:", {
        entityId: result.entityId,
        slug: result.slug,
        created: result.created,
        founded: result.archive.foundedYear,
        bioLen: result.archive.bioSummary?.length ?? 0,
        image: result.archive.imageUrl?.slice(0, 80) ?? null,
        wikidataId: result.archive.wikidataId,
      });
    }
  }

  const venue = await resolveEllisParkOrCapeTown(db);
  console.log("\n→ Home venue candidate:", venue?.name ?? "(none found)");

  if (!dryRun) {
    // Preserve Springboks identity; wiki article title can overwrite display name.
    await db
      .update(teams)
      .set({
        name: "South Africa",
        shortName: "Springboks",
        countryName: "South Africa",
        region: "Africa",
        hemisphere: "southern",
        teamType: "international",
        ...(venue ? { homeVenueId: venue.id } : {}),
      })
      .where(eq(teams.id, SA_ID));
    console.log("✓ Identity / region / venue patched");
  }

  const pastScheduled = await db.execute(sql`
    select count(*)::int as n from fixtures
    where (home_team_id = ${SA_ID} or away_team_id = ${SA_ID})
      and status = 'scheduled'
      and kickoff_at < now()
  `);
  console.log("\n→ Past-dated scheduled fixtures (filtered from Upcoming in UI):", pastScheduled);

  console.log("\n→ Assign current coaches…");
  if (!dryRun) {
    const coachResult = await assignCurrentCoaches();
    console.log("Coach assign summary:", {
      created: coachResult.assignmentsCreated,
      updated: coachResult.assignmentsUpdated,
      demoted: coachResult.demotedPriorCurrent,
      failures: coachResult.failures.filter((f) => f.teamSlug === "south-africa"),
    });
  }

  const [after] = await db.select().from(teams).where(eq(teams.id, SA_ID)).limit(1);
  console.log("\nAfter:", {
    name: after?.name,
    shortName: after?.shortName,
    foundedYear: after?.foundedYear,
    region: after?.region,
    hemisphere: after?.hemisphere,
    bioLen: after?.bioSummary?.length ?? 0,
    bioPreview: after?.bioSummary?.slice(0, 180) ?? null,
    imageUrl: after?.imageUrl?.slice(0, 80) ?? null,
    wikipediaUrl: after?.wikipediaUrl,
    wikidataId: after?.wikidataId,
    homeVenueId: after?.homeVenueId,
  });

  const playerStats = await db.execute(sql`
    select
      count(*)::int as linked,
      count(*) filter (where image_url is not null and length(btrim(image_url)) > 0)::int as with_img,
      count(*) filter (where international_team_id = ${SA_ID})::int as intl,
      count(*) filter (where club_team_id = ${SA_ID})::int as club
    from players
    where club_team_id = ${SA_ID} or international_team_id = ${SA_ID}
  `);
  console.log("\nLinked players:", playerStats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
