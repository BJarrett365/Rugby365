#!/usr/bin/env npx tsx
import { getCompetitionBySlug, reportDuplicateCompetitionSeasons } from "../apps/web/src/lib/competition-admin-service.ts";

async function main() {
  const slug = process.argv[2] ?? "premiership";
  const competition = await getCompetitionBySlug(slug);
  if (!competition) {
    console.error(`Competition not found: ${slug}`);
    process.exit(1);
  }

  const duplicates = await reportDuplicateCompetitionSeasons(competition.id);
  if (duplicates.length === 0) {
    console.log(`No duplicate seasons for ${competition.name}`);
    return;
  }

  console.log(JSON.stringify({ competition: competition.name, duplicates }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
