import { ilike, or } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(coaches)
    .where(
      or(
        ilike(coaches.name, "%Erasmus%"),
        ilike(coaches.slug, "%rassie%"),
        ilike(coaches.name, "%Borthwick%"),
        ilike(coaches.name, "%Galthi%"),
        ilike(coaches.name, "%Farrell%"),
        ilike(coaches.name, "%Townsend%"),
        ilike(coaches.name, "%Tandy%"),
        ilike(coaches.name, "%Quesada%"),
        ilike(coaches.name, "%Rennie%"),
        ilike(coaches.name, "%Kiss%"),
        ilike(coaches.name, "%Contepomi%"),
        ilike(coaches.name, "%Eddie Jones%"),
        ilike(coaches.slug, "%eddie-jones%"),
        ilike(coaches.name, "%Seruvakula%"),
      ),
    );

  for (const r of rows) {
    console.log(
      JSON.stringify({
        id: r.id,
        name: r.name,
        slug: r.slug,
        fullName: r.fullName,
        knownAs: r.knownAs,
        birthDate: r.birthDate,
        birthPlace: (r as { birthPlace?: string | null }).birthPlace ?? null,
        nationality: r.nationality,
        heightCm: r.heightCm,
        appointedOn: r.appointedOn,
        contractExpiresOn: r.contractExpiresOn,
        preferredSystem: r.preferredSystem,
        coachingStyle: r.coachingStyle,
        preferredSystemProvenance: r.preferredSystemProvenance,
        coachingStyleProvenance: r.coachingStyleProvenance,
        keys: Object.keys(r).sort(),
      }),
    );
  }
  console.log("count", rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
