/**
 * Fill transfer-list players missing photos or nationality.
 * Sources: Wikipedia, Planet Rugby discovery, OpenAI (gaps), Alamy stock search.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-transfer-players.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-transfer-players.ts --write --alamy --limit=80
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";
import { playerTransfers, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";
import { isPlaceholderNationCode, isPlaceholderNationLabel } from "../apps/web/src/lib/nation-code-utils";
import { researchPlayerNationality } from "../apps/web/src/lib/player-nationality-research";
import { findPlanetRugbyImagesForPlayer, copyApprovedHeadshotFromNameTwin, registerWikipediaHeadshotIfMissing } from "../apps/web/src/lib/player-image-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchWikipediaOriginalImages,
  wikipediaTitleCandidates,
} from "../apps/web/src/lib/wikipedia-page-image";

const args = process.argv.slice(2);
const write = args.includes("--write");
const doAlamy = args.includes("--alamy");
const doPlanet = args.includes("--planet");
const imagesOnly = args.includes("--images-only");
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 120);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.slice(8) ?? 450);
const playerFilter = args.find((a) => a.startsWith("--player="))?.slice(9)?.toLowerCase() ?? null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function needsNation(row: { nationCode: string | null; countryName: string | null }): boolean {
  return isPlaceholderNationCode(row.nationCode) && isPlaceholderNationLabel(row.countryName);
}

function needsImage(imageUrl: string | null): boolean {
  return !imageUrl?.trim();
}

async function main() {
  const db = getDb();
  const recent = await db
    .select({
      playerId: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      nationCode: players.nationCode,
      countryName: players.countryName,
      clubName: players.clubName,
      birthPlace: players.birthPlace,
      effectiveDate: playerTransfers.effectiveDate,
    })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .orderBy(desc(playerTransfers.effectiveDate))
    .limit(Math.max(limit * 6, 800));

  const byId = new Map<string, (typeof recent)[number]>();
  for (const row of recent) {
    if (playerFilter && !row.name.toLowerCase().includes(playerFilter) && row.slug !== playerFilter) {
      continue;
    }
    if (!byId.has(row.playerId)) byId.set(row.playerId, row);
  }

  const named = [...byId.values()].filter(
    (row) =>
      /^(sam crean|sacha mngomezulu)$/i.test(row.name) || needsImage(row.imageUrl) || needsNation(row),
  );
  const batch = named.slice(0, limit);
  console.log(
    `${write ? "WRITE" : "DRY"} · ${batch.length} transfer players to enrich (images and/or nation)`,
  );

  let wikiOk = 0;
  let nationOk = 0;
  let planetHits = 0;
  const alamyPlan: Array<{ playerId: string; playerName: string; searchUrl: string }> = [];

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]!;
    process.stdout.write(`[${i + 1}/${batch.length}] ${row.name}… `);
    if (write && !imagesOnly) {
      try {
        const wiki = await enrichPlayerFromWikipedia(row.playerId, row.name, {
          fillMissingOnly: true,
        });
        if (wiki.enriched) wikiOk += 1;
      } catch (err) {
        console.log("wiki-err", err instanceof Error ? err.message : err);
      }
    }

    const [fresh] = await db
      .select({
        imageUrl: players.imageUrl,
        nationCode: players.nationCode,
        countryName: players.countryName,
        clubName: players.clubName,
        birthPlace: players.birthPlace,
      })
      .from(players)
      .where(eq(players.id, row.playerId))
      .limit(1);

    if (write && !imagesOnly && needsNation({ nationCode: fresh?.nationCode ?? row.nationCode, countryName: fresh?.countryName ?? row.countryName })) {
      try {
        const found = await researchPlayerNationality({
          name: row.name,
          clubName: fresh?.clubName ?? row.clubName,
          birthPlace: fresh?.birthPlace ?? row.birthPlace,
          countryName: fresh?.countryName ?? row.countryName,
          nationCode: fresh?.nationCode ?? row.nationCode,
        });
        if (found) {
          await db
            .update(players)
            .set({
              countryName: found.countryName,
              nationCode: found.nationCode,
              updatedAt: new Date(),
            })
            .where(eq(players.id, row.playerId));
          nationOk += 1;
          process.stdout.write(`nation=${found.countryName} `);
        }
      } catch (err) {
        process.stdout.write(`openai-skip `);
        if (err instanceof Error && !/OpenAI API key is not configured/i.test(err.message)) {
          process.stdout.write(`(${err.message.slice(0, 80)}) `);
        }
      }
    }

    const stillNoImage = needsImage(fresh?.imageUrl ?? row.imageUrl);
    if (write && stillNoImage) {
      try {
        if (await copyApprovedHeadshotFromNameTwin(row.playerId)) {
          process.stdout.write("twin-photo ");
        } else {
          const titles = wikipediaTitleCandidates(row.name, "player");
          const originals = await fetchWikipediaOriginalImages(titles);
          const wikiPhoto = [...originals.values()][0];
          if (wikiPhoto && (await registerWikipediaHeadshotIfMissing(row.playerId, wikiPhoto, row.name))) {
            process.stdout.write("wiki-photo ");
          }
        }
      } catch {
        /* image fill is best-effort */
      }
    }

    if (write && doPlanet && needsImage(fresh?.imageUrl ?? row.imageUrl)) {
      try {
        const planet = await findPlanetRugbyImagesForPlayer(row.playerId);
        if (planet.savedCount > 0) planetHits += 1;
      } catch {
        /* discovery is best-effort */
      }
    }

    const [after] = stillNoImage
      ? await db
          .select({ imageUrl: players.imageUrl })
          .from(players)
          .where(eq(players.id, row.playerId))
          .limit(1)
      : [fresh];
    if (needsImage(after?.imageUrl ?? null)) {
      alamyPlan.push({
        playerId: row.playerId,
        playerName: row.name,
        searchUrl: alamyStockPhotoSearchUrl(row.name),
      });
    }
    console.log(needsImage(after?.imageUrl ?? null) ? "needs-photo" : "ok");
    await sleep(delayMs);
  }

  const planPath = "/tmp/alamy-transfer-search-plan.json";
  writeFileSync(planPath, JSON.stringify(alamyPlan, null, 2));
  console.log(
    `\nWikipedia enriched: ${wikiOk} · OpenAI nations: ${nationOk} · Planet Rugby candidates: ${planetHits} · Alamy plan: ${alamyPlan.length} → ${planPath}`,
  );

  if (doAlamy && write && alamyPlan.length) {
    const hitsPath = "/tmp/alamy-transfer-hits.json";
    const scrape = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/scrape-alamy-player-searches.ts",
        `--batch=${planPath}`,
        `--out=${hitsPath}`,
        `--limit=${alamyPlan.length}`,
      ],
      { stdio: "inherit", cwd: process.cwd() },
    );
    if (scrape.status === 0) {
      spawnSync(
        "npx",
        [
          "tsx",
          "--require",
          "./scripts/stub-server-only.cjs",
          "scripts/import-alamy-player-search-hits.ts",
          `--file=${hitsPath}`,
        ],
        { stdio: "inherit", cwd: process.cwd() },
      );
    }
  } else if (alamyPlan.length) {
    console.log(
      `Next: npx tsx scripts/scrape-alamy-player-searches.ts --batch=${planPath} --out=/tmp/alamy-transfer-hits.json --limit=${alamyPlan.length}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
