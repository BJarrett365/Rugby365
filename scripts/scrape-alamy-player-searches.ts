/**
 * Batch-search Alamy public stock pages via local Chrome (puppeteer-core).
 *
 *   npx tsx scripts/scrape-alamy-player-searches.ts --batch=/tmp/alamy-search-batch2.json
 *   npx tsx scripts/scrape-alamy-player-searches.ts --batch=/tmp/alamy-search-batch2.json --limit=20
 *
 * Note: page.evaluate callbacks are stringified — avoid TypeScript helpers
 * (__name) by using string forms where needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const args = process.argv.slice(2);
const batchFile =
  args.find((a) => a.startsWith("--batch="))?.split("=")[1] ??
  "/tmp/alamy-search-batch2.json";
const outFile =
  args.find((a) => a.startsWith("--out="))?.split("=")[1] ??
  "/tmp/alamy-player-image-hits.json";
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 40);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 900);

type Plan = { playerId: string; playerName: string; searchUrl: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function nameNeedles(playerName: string): string[] {
  const norm = playerName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = norm.split(" ").filter(Boolean);
  const out = new Set<string>();
  if (norm) out.add(norm);
  if (parts.length >= 2) {
    out.add(`${parts[0]} ${parts[parts.length - 1]}`);
    const last = parts[parts.length - 1]!;
    if (last.length >= 6) out.add(last);
  }
  return [...out];
}

const EXTRACT_IMAGES_FN = `function(ns) {
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^a-z0-9\\s'-]/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
  }
  return Array.from(document.querySelectorAll("img"))
    .map(function(img) {
      return {
        imageUrl: img.currentSrc || img.src || "",
        altText: (img.alt || "").trim(),
        sourcePageUrl: location.href
      };
    })
    .filter(function(x) {
      if (!/\\/zooms\\//i.test(x.imageUrl)) return false;
      var alt = norm(x.altText);
      return ns.some(function(n) { return alt.indexOf(n) !== -1; });
    })
    .slice(0, 3);
}`;

async function main() {
  const plan = (JSON.parse(readFileSync(batchFile, "utf8")) as Plan[]).slice(0, limit);
  console.log(`Searching Alamy for ${plan.length} players…`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  let page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1400, height: 1000 });

  const hits: Array<{
    playerId: string;
    playerName: string;
    searchUrl: string;
    images: Array<{ imageUrl: string; altText: string; sourcePageUrl: string }>;
  }> = [];

  for (let i = 0; i < plan.length; i++) {
    // Fresh tab every 8 players — Alamy search pages degrade / soft-block over long sessions
    if (i > 0 && i % 8 === 0) {
      await page.close().catch(() => undefined);
      page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );
      await page.setViewport({ width: 1400, height: 1000 });
    }

    const p = plan[i]!;
    const needles = nameNeedles(p.playerName);
    process.stdout.write(`[${i + 1}/${plan.length}] ${p.playerName}… `);
    try {
      await page.goto(p.searchUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const accept = buttons.find((b) => /accept/i.test(b.textContent || ""));
        if (accept) accept.click();
      })()`).catch(() => undefined);
      await sleep(900);
      await page.evaluate(`window.scrollBy(0, 1400)`).catch(() => undefined);
      await sleep(500);
      try {
        await page.waitForSelector('img[src*="/zooms/"]', { timeout: 8000 });
      } catch {
        /* no zooms */
      }

      const imgs = (await page.evaluate(`(${EXTRACT_IMAGES_FN})(${JSON.stringify(needles)})`)) as Array<{
        imageUrl: string;
        altText: string;
        sourcePageUrl: string;
      }>;

      if (imgs.length) {
        hits.push({
          playerId: p.playerId,
          playerName: p.playerName,
          searchUrl: p.searchUrl,
          images: imgs,
        });
        console.log(`hit ${imgs.length}`);
      } else {
        console.log("miss");
      }
    } catch (err) {
      console.log("err", err instanceof Error ? err.message : err);
    }
    await sleep(delayMs);
  }

  await page.close().catch(() => undefined);
  await browser.close();
  writeFileSync(outFile, JSON.stringify(hits, null, 2));
  console.log(`\nWrote ${hits.length} players with images → ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
