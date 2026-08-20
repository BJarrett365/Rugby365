import { ilike, or, eq } from "drizzle-orm";
import { teams, coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

const TEAM_QS = [
  "Bath",
  "Bristol",
  "Exeter",
  "Gloucester",
  "Harlequins",
  "Leicester",
  "Newcastle",
  "Northampton",
  "Sale",
  "Saracens",
];

const COACH_QS = [
  "Johann van Graan",
  "Pat Lam",
  "Rob Baxter",
  "George Skivington",
  "Jason Gilmore",
  "Geoff Parling",
  "Steve Diamond",
  "Phil Dowson",
  "Sam Vesty",
  "Alex Sanderson",
  "Brendan Venter",
  "Mark McCall",
];

async function main() {
  const db = getDb();
  console.log("=== TEAMS ===");
  for (const n of TEAM_QS) {
    const rows = await db
      .select({ id: teams.id, name: teams.name, slug: teams.slug })
      .from(teams)
      .where(or(ilike(teams.name, `%${n}%`), ilike(teams.slug, `%${n}%`)))
      .limit(8);
    console.log(n + ":", rows.map((r) => `${r.name} [${r.slug}] ${r.id}`).join(" | ") || "NONE");
  }
  console.log("\n=== COACHES ===");
  for (const n of COACH_QS) {
    const last = n.split(" ").slice(-1)[0]!;
    const rows = await db
      .select({ id: coaches.id, name: coaches.name, slug: coaches.slug })
      .from(coaches)
      .where(ilike(coaches.name, `%${last}%`))
      .limit(6);
    console.log(n + ":", rows.map((r) => `${r.name} [${r.slug}]`).join(" | ") || "NONE");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
