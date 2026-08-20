import { ilike, or, inArray, eq } from "drizzle-orm";
import { coaches, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const coachNames = [
    "Hawies Fourie",
    "Fourie",
    "Nomlomo",
    "Frans Steyn",
    "Pieter Bergh",
    "Nkosi",
    "Stonehouse",
    "Pietersen",
    "Dawson-Squibb",
    "Dawson Squibb",
  ];
  const foundCoaches = await db
    .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
    .from(coaches)
    .where(or(...coachNames.map((n) => ilike(coaches.name, `%${n}%`))));
  console.log("coaches", foundCoaches);

  const teamHints = [
    "Boland",
    "Bulls",
    "Cheetahs",
    "Griquas",
    "Griqua",
    "Lions",
    "Pumas",
    "Sharks",
    "Stormers",
  ];
  const foundTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      teamType: teams.teamType,
      shortName: teams.shortName,
    })
    .from(teams)
    .where(or(...teamHints.map((n) => ilike(teams.name, `%${n}%`))));
  for (const t of foundTeams) {
    console.log(JSON.stringify(t));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
