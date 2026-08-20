/**
 * Find NZ NPC provincial teams + any existing coach rows for the 2026 seed pack.
 */
import { ilike, or } from "drizzle-orm";
import { teams, coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const TEAM_QUERIES = [
  "Auckland",
  "Bay of Plenty",
  "Canterbury",
  "Counties Manukau",
  "Hawke",
  "Manawat",
  "North Harbour",
  "Northland",
  "Otago",
  "Southland",
  "Taranaki",
  "Tasman",
  "Waikato",
  "Wellington",
];

const COACH_NAMES = [
  "Craig McGrath",
  "Steven Bates",
  "Richard Watt",
  "Alex Robertson",
  "Reon Graham",
  "Jason Parata",
  "Mike Rogers",
  "Jimmy Maher",
  "Dale MacLeod",
  "Tom Donnelly",
  "Mark Brown",
  "Matt Saunders",
  "Jarrad Hoeata",
  "Gray Cornelius",
  "Ross Filipo",
  "Alando Soakai",
];

async function main() {
  const db = getDb();
  console.log("=== TEAMS ===");
  for (const n of TEAM_QUERIES) {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        slug: teams.slug,
      })
      .from(teams)
      .where(or(ilike(teams.name, `%${n}%`), ilike(teams.shortName, `%${n}%`)))
      .limit(10);
    console.log(
      n + ":",
      rows.map((r) => `${r.name} [${r.slug}] ${r.id}`).join(" | ") || "NONE",
    );
  }

  console.log("\n=== EXISTING COACHES ===");
  for (const n of COACH_NAMES) {
    const last = n.split(" ").slice(-1)[0]!;
    const rows = await db
      .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
      .from(coaches)
      .where(ilike(coaches.name, `%${last}%`))
      .limit(8);
    console.log(
      n + ":",
      rows.map((r) => `${r.name} [${r.slug}]`).join(" | ") || "NONE",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
