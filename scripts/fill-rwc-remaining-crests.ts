/**
 * Fill remaining RWC club rows that have a team record but no usable crest.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fill-rwc-remaining-crests.ts
 */
import { eq } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  foldRankingClubKey,
  looksLikeCrestAssetUrl,
  usableRankingClubImageUrl,
} from "../apps/web/src/lib/player-ranking-engine";
import {
  fetchWikipediaClubLogos,
  fetchWikidataLogo,
  thumbnailForName,
} from "../apps/web/src/lib/wikipedia-page-image";

const EXTRA_TITLES: Record<string, string[]> = {
  "Aberavon RFC": ["Aberavon RFC"],
  "Border Bulldogs": ["Border Bulldogs"],
  "CA Brive": ["CA Brive", "Club athlétique Brive Corrèze Limousin"],
  "CS Bourgoin-Jallieu": ["CS Bourgoin-Jallieu", "Bourgoin-Jallieu rugby"],
  "Eastern Province Elephants": ["Eastern Province Elephants", "Eastern Province (rugby team)"],
  "FC Grenoble": ["FC Grenoble Rugby", "Football Club de Grenoble Rugby"],
  "FC Lourdes": ["FC Lourdes"],
  "Honda Heat": ["Mie Honda Heat", "Honda Heat"],
  "London Irish": ["London Irish"],
  "London Welsh": ["London Welsh RFC", "London Welsh"],
  "Newbridge RFC": ["Newbridge RFC"],
  "Pontypool RFC": ["Pontypool RFC"],
  "RC Narbonne": ["Racing Club Narbonne Méditerranée", "RC Narbonne"],
  "RC Nîmes": ["RC Nîmes"],
  "Sporting Club Graulhetois": ["SC Graulhet", "Sporting Club Graulhetois"],
  "Stade Montois": ["Stade Montois Rugby"],
  "SU Agen Lot-et-Garonne": ["SU Agen", "Sporting Union Agen Lot-et-Garonne"],
  "SWD Eagles": ["SWD Eagles"],
  "Tarbes Pyrénées Rugby": ["Tarbes Pyrénées Rugby"],
  "US Colomiers": ["Colomiers Rugby", "US Colomiers"],
  "US Dax": ["US Dax"],
  "Welwitschias": ["Welwitschias"],
  "Yorkshire Carnegie": ["Yorkshire Carnegie", "Leeds Tykes"],
};

function usableCrest(url: string | null | undefined): string | null {
  if (!url) return null;
  if (looksLikeCrestAssetUrl(url) || usableRankingClubImageUrl(url)) return url;
  return null;
}

async function main() {
  const db = getDb();
  const catalog = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
    .from(teams);
  let updated = 0;
  for (const [club, titles] of Object.entries(EXTRA_TITLES)) {
    const logos = await fetchWikipediaClubLogos(titles);
    let url: string | null = null;
    for (const title of titles) {
      url = usableCrest(thumbnailForName(logos, title, "club")) ?? usableCrest(await fetchWikidataLogo(title));
      if (url) break;
    }
    console.log(`${club}: ${url ?? "NO LOGO"}`);
    if (!url) continue;
    const folded = foldRankingClubKey(club);
    for (const team of catalog) {
      if (usableRankingClubImageUrl(team.imageUrl)) continue;
      const nameFold = foldRankingClubKey(team.name);
      if (nameFold !== folded && !titles.some((title) => foldRankingClubKey(title) === nameFold)) {
        continue;
      }
      await db.update(teams).set({ imageUrl: url }).where(eq(teams.id, team.id));
      team.imageUrl = url;
      updated += 1;
    }
  }
  console.log(`updated team crests=${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
