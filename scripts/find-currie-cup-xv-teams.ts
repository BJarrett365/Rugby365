import { ilike, or } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const rows = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, shortName: teams.shortName })
    .from(teams)
    .where(
      or(
        ilike(teams.name, "%Bulls%XV%"),
        ilike(teams.name, "%Bulls XV%"),
        ilike(teams.name, "%Sharks%XV%"),
        ilike(teams.name, "%Sharks XV%"),
        ilike(teams.name, "%XXIII%"),
        ilike(teams.slug, "%bulls%x%"),
        ilike(teams.slug, "%sharks%x%"),
        ilike(teams.slug, "%xxiii%"),
        ilike(teams.name, "%Vodacom Bulls%"),
        ilike(teams.name, "%Cell C Sharks%"),
        ilike(teams.name, "%Hollywoodbets Sharks%"),
      ),
    );
  console.log(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
