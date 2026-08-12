import { ilike, or, eq, and } from "drizzle-orm";
import { coaches, teams, teamCoachingStaff, coachPlayingStints, coachHonours, coachAwards } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();

  const more = await db
    .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
    .from(coaches)
    .where(
      or(
        ilike(coaches.name, "%Tandy%"),
        ilike(coaches.name, "%Quesada%"),
        ilike(coaches.name, "%Rennie%"),
        ilike(coaches.name, "%Kiss%"),
        ilike(coaches.name, "%Seruvakula%"),
        ilike(coaches.name, "%Gonzalo%"),
        ilike(coaches.name, "%Dave Rennie%"),
        ilike(coaches.name, "%Les Kiss%"),
      ),
    );
  console.log("extra coaches", more);

  const nationSlugs = [
    "south-africa",
    "england",
    "france",
    "ireland",
    "scotland",
    "wales",
    "italy",
    "new-zealand",
    "australia",
    "argentina",
    "japan",
    "fiji",
  ];
  for (const slug of nationSlugs) {
    const [t] = await db
      .select({ id: teams.id, name: teams.name, slug: teams.slug, type: teams.teamType })
      .from(teams)
      .where(eq(teams.slug, slug))
      .limit(1);
    console.log("team", slug, t ?? "MISSING");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
