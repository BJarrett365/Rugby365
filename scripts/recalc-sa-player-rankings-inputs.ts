/**
 * Recalculate SA player rating inputs used by public rankings boards:
 * form_score, season_rating, last_five_match_ratings; promote gallery images;
 * mark catalog/legend greats as career_status=legend.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/recalc-sa-player-rankings-inputs.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/recalc-sa-player-rankings-inputs.ts --write --limit=40
 */
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { playerImages, playerRatings, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { recalculatePlayerIntelligenceProfile } from "../apps/web/src/lib/player-intelligence-recalc-service";
import { mergeLegendCatalogByName } from "../apps/web/src/lib/legends-catalog";

const SA_ID = "b0000000-0000-4000-8000-000000000001";

const RETIRED_GREATS = [
  "Bryan Habana",
  "Victor Matfield",
  "Fourie Du Preez",
  "Bakkies Botha",
  "Tendai Mtawarira",
  "Jean de Villiers",
  "Schalk Burger",
  "Joost van der Westhuizen",
  "Francois Pienaar",
  "Naas Botha",
  "Frik du Preez",
  "John Smit",
  "Percy Montgomery",
  "Os du Randt",
  "Danie Rossouw",
  "Juan Smith",
  "Morné Steyn",
  "Morne Steyn",
  "JP Pietersen",
  "Bismarck du Plessis",
  "Jannie Du Plessis",
  "Gurthro Steenkamp",
  "Butch James",
  "Chester Williams",
  "James Small",
];

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function promotePrimaryImage(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db
    .select({ imageUrl: players.imageUrl })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (player?.imageUrl) return false;

  const [img] = await db
    .select({ imageUrl: playerImages.imageUrl })
    .from(playerImages)
    .where(
      and(
        eq(playerImages.playerId, playerId),
        sql`${playerImages.archivedAt} is null`,
        sql`${playerImages.status} in ('approved', 'candidate')`,
      ),
    )
    .orderBy(
      sql`case when ${playerImages.role} = 'primary' then 0 when ${playerImages.role} = 'legend' then 1 else 2 end`,
      sql`${playerImages.confidenceScore} desc`,
    )
    .limit(1);

  if (!img?.imageUrl) return false;
  await db
    .update(players)
    .set({ imageUrl: img.imageUrl })
    .where(eq(players.id, playerId));
  return true;
}

async function main() {
  const write = hasFlag("--write");
  const limit = Number(argValue("--limit") ?? "0") || 0;
  const db = getDb();

  const saPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      careerStatus: players.careerStatus,
      imageUrl: players.imageUrl,
      formScore: playerRatings.formScore,
      seasonRating: playerRatings.seasonRating,
      playerRating: playerRatings.playerRating,
      lastFive: playerRatings.lastFiveMatchRatings,
      dataPoints: playerRatings.dataPoints,
    })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        or(
          ilike(players.countryName, "%south africa%"),
          eq(players.internationalTeamId, SA_ID),
        ),
      ),
    );

  const needsRecalc = saPlayers.filter((p) => {
    const lastFiveLen = Array.isArray(p.lastFive) ? p.lastFive.length : 0;
    return (
      p.playerRating == null ||
      p.formScore == null ||
      p.seasonRating == null ||
      lastFiveLen === 0 ||
      (p.dataPoints != null && p.dataPoints <= 1 && p.playerRating === 85)
    );
  });

  const batch = limit > 0 ? needsRecalc.slice(0, limit) : needsRecalc;

  console.log(
    `SA published: ${saPlayers.length}; need rating/form recalc: ${needsRecalc.length}; batch: ${batch.length}; write=${write}`,
  );

  let recalced = 0;
  let failed = 0;
  let imagesPromoted = 0;
  let careerUpdated = 0;

  for (const p of batch) {
    if (!write) {
      console.log(`  dry-run recalc ${p.name} (${p.slug})`);
      continue;
    }
    try {
      const result = await recalculatePlayerIntelligenceProfile(p.id);
      recalced += 1;
      console.log(
        `  recalc ${p.name}: ovr=${result.overall} samples=${result.samples} history=${result.historyPoints}`,
      );
    } catch (err) {
      failed += 1;
      console.warn(`  fail ${p.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // Promote images for all SA without primary image_url
  const missingImg = saPlayers.filter((p) => !p.imageUrl);
  for (const p of missingImg) {
    if (!write) continue;
    try {
      if (await promotePrimaryImage(p.id)) {
        imagesPromoted += 1;
        console.log(`  image ← gallery ${p.name}`);
      }
    } catch {
      // best-effort
    }
  }

  // Mark catalog + known greats as legend so they leave Current boards
  const catalogSa = mergeLegendCatalogByName()
    .filter((e) => (e.countryName ?? "").toLowerCase().includes("south africa"))
    .map((e) => e.name.toLowerCase());
  const legendNames = new Set([
    ...catalogSa,
    ...RETIRED_GREATS.map((n) => n.toLowerCase()),
  ]);

  for (const p of saPlayers) {
    const nameKey = p.name.toLowerCase();
    const shouldBeLegend =
      legendNames.has(nameKey) ||
      [...legendNames].some((n) => nameKey.includes(n) || n.includes(nameKey));
    if (!shouldBeLegend) continue;
    if ((p.careerStatus ?? "").toLowerCase() === "legend") continue;
    if (!write) {
      console.log(`  dry-run career→legend ${p.name}`);
      continue;
    }
    await db
      .update(players)
      .set({ careerStatus: "legend" })
      .where(eq(players.id, p.id));
    careerUpdated += 1;
    console.log(`  career_status=legend ${p.name}`);
  }

  // Also mark anyone already in player_legends
  if (write) {
    await db.execute(sql`
      UPDATE players p
      SET career_status = 'legend'
      WHERE p.id IN (
        SELECT DISTINCT player_id FROM player_legends WHERE legend_status = 'active'
      )
      AND lower(coalesce(p.career_status, '')) <> 'legend'
      AND (
        lower(coalesce(p.country_name, '')) like '%south africa%'
        OR p.international_team_id = ${SA_ID}::uuid
      )
    `);
  }

  console.log(
    JSON.stringify(
      {
        write,
        saPlayers: saPlayers.length,
        needsRecalc: needsRecalc.length,
        recalced,
        failed,
        imagesPromoted,
        careerUpdated,
        dryRunSkipped: !write,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
