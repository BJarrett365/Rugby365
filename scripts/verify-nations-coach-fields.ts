import { inArray } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const rows = await db
    .select({
      name: coaches.name,
      slug: coaches.slug,
      fullName: coaches.fullName,
      knownAs: coaches.knownAs,
      birthDate: coaches.birthDate,
      placeOfBirth: coaches.placeOfBirth,
      heightCm: coaches.heightCm,
      appointedOn: coaches.appointedOn,
      contractExpiresOn: coaches.contractExpiresOn,
      preferredSystem: coaches.preferredSystem,
      coachingStyle: coaches.coachingStyle,
      formerPlayingPositions: coaches.formerPlayingPositions,
      coachingCareerStartYear: coaches.coachingCareerStartYear,
    })
    .from(coaches)
    .where(
      inArray(coaches.slug, [
        "rassie-erasmus",
        "steve-borthwick-coach519",
        "fabien-galthie-coach162",
        "andy-farrell-coach160",
        "gregor-townsend-coach161",
        "steve-tandy",
        "gonzalo-quesada",
        "dave-rennie",
        "les-kiss",
        "felipe-contepomi",
        "eddie-jones",
        "senirusi-seruvakula",
      ]),
    );
  for (const r of rows) {
    const missing = Object.entries(r)
      .filter(([, v]) => v == null || v === "")
      .map(([k]) => k);
    console.log(`${r.name}: missing=[${missing.join(", ") || "none"}]`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
