import { ilike, or, eq, inArray } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const names = [
    "England",
    "France",
    "Ireland",
    "Scotland",
    "Wales",
    "Italy",
    "New Zealand",
    "Australia",
    "Argentina",
    "Japan",
    "Fiji",
    "South Africa",
  ];
  const byName = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      teamType: teams.teamType,
      countryName: teams.countryName,
    })
    .from(teams)
    .where(inArray(teams.name, names));
  console.log("by exact name", byName);

  const fuzzy = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      teamType: teams.teamType,
    })
    .from(teams)
    .where(
      or(
        ilike(teams.name, "England%"),
        ilike(teams.name, "France%"),
        ilike(teams.slug, "%england%"),
        ilike(teams.slug, "%france%"),
        ilike(teams.slug, "%ireland%"),
        eq(teams.teamType, "international"),
        eq(teams.teamType, "national"),
      ),
    )
    .limit(60);
  console.log("fuzzy/intl", fuzzy);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
