/**
 * Follow-up SA rankings polish: copy images onto duplicate profiles, Frik wiki image,
 * Northern Transvaal crest alias, rebuild boards.
 */
import { eq, ilike, sql } from "drizzle-orm";
import { players, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { enrichPlayerFromWikipediaAndWait } from "../apps/web/src/lib/player-wikipedia-enrich";
import { getPublicPlayerRankingsBoard } from "../apps/web/src/lib/public-player-rankings-product-service";

async function main() {
  const db = getDb();

  const copies: Array<[string, string]> = [
    ["John Smit retired", "John Smit"],
    ["Schalk Burger released", "Schalk Burger"],
  ];
  for (const [destName, srcName] of copies) {
    const [src] = await db
      .select({ imageUrl: players.imageUrl })
      .from(players)
      .where(ilike(players.name, srcName))
      .limit(1);
    if (!src?.imageUrl) {
      console.log("no src image", srcName);
      continue;
    }
    await db
      .update(players)
      .set({ imageUrl: src.imageUrl })
      .where(
        sql`${players.name} ilike ${destName} and (${players.imageUrl} is null or ${players.imageUrl} = '')`,
      );
    console.log("copied image", srcName, "→", destName);
  }

  const [frik] = await db
    .select({ id: players.id, imageUrl: players.imageUrl })
    .from(players)
    .where(ilike(players.name, "Frik du Preez"))
    .limit(1);
  if (frik && !frik.imageUrl) {
    await enrichPlayerFromWikipediaAndWait(frik.id, "Frik du Preez", {
      fillMissingOnly: true,
      sourceUrl: "https://en.wikipedia.org/wiki/Frik_du_Preez",
    });
    const [after] = await db
      .select({ imageUrl: players.imageUrl })
      .from(players)
      .where(eq(players.id, frik.id))
      .limit(1);
    console.log("frik image", Boolean(after?.imageUrl), after?.imageUrl?.slice(0, 80));
  }

  const [bulls] = await db
    .select({ imageUrl: teams.imageUrl })
    .from(teams)
    .where(sql`lower(${teams.name}) = 'bulls' and ${teams.imageUrl} is not null and ${teams.slug} not like '%__legacy__%'`)
    .limit(1);
  if (bulls?.imageUrl) {
    await db
      .update(teams)
      .set({ imageUrl: bulls.imageUrl })
      .where(
        sql`lower(${teams.name}) in ('northern transvaal', 'blue bulls') and (${teams.imageUrl} is null or ${teams.imageUrl} = '')`,
      );
    console.log("aliased Northern Transvaal/Blue Bulls crest from Bulls");
  }

  const sa = await getPublicPlayerRankingsBoard({
    mode: "alltime",
    nation: "South Africa",
    top: 50,
    forceRebuild: true,
  });
  await getPublicPlayerRankingsBoard({
    mode: "current",
    nation: "South Africa",
    top: 50,
    forceRebuild: true,
  });

  console.log(
    JSON.stringify(
      {
        missingImg: sa.rows.filter((r) => !r.imageUrl).map((r) => r.name),
        missingCrest: sa.rows
          .filter((r) => r.teamName && !r.teamImageUrl)
          .map((r) => `${r.name}:${r.teamName}`),
        missingMove: sa.rows.filter((r) => r.movementDelta == null).length,
        jean: sa.rows.find((r) => /jean de villiers/i.test(r.name)),
        sampleMoves: sa.rows.slice(0, 10).map((r) => ({
          name: r.name,
          move: r.movementDelta,
          crest: Boolean(r.teamImageUrl),
          img: Boolean(r.imageUrl),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
