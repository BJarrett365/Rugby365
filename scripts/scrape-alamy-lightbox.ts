/**
 * Login to Alamy with ALAMY_EMAIL / ALAMY_PASSWORD from .env and export
 * lightbox image comps to a JSON dump for import-alamy-lightbox-images.ts
 * or import-alamy-player-search-hits.ts.
 *
 *   set -a && source .env && set +a
 *   npx tsx scripts/scrape-alamy-lightbox.ts
 *   npx tsx scripts/scrape-alamy-lightbox.ts --lbId=edb9e9d2-cc0b-4128-a260-cd2e635c7c6b
 */
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const email = process.env.ALAMY_EMAIL || "";
const password = process.env.ALAMY_PASSWORD || "";
const args = process.argv.slice(2);
const lbId =
  args.find((a) => a.startsWith("--lbId="))?.split("=")[1] ||
  process.env.ALAMY_LIGHTBOX_ID ||
  "661de578-d179-4d84-aa3c-4ca115cf6a1d";
const outFile =
  args.find((a) => a.startsWith("--out="))?.split("=")[1] ||
  `/tmp/alamy-lightbox-${lbId}.json`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!email || !password) {
    console.error("Set ALAMY_EMAIL and ALAMY_PASSWORD in .env");
    process.exit(1);
  }

  const lightboxUrl = `https://www.alamy.com/lightbox/details.aspx?lbId=${lbId}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );

  console.log("Signing in…");
  await page.goto(
    `https://www.alamy.com/log-in/?returnUrl=${encodeURIComponent(lightboxUrl)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await sleep(800);
  await page.evaluate(`(() => {
    const input = document.querySelector('input[type="email"], input[type="text"], input:not([type])');
    if (input) { input.focus(); input.value = ${JSON.stringify(email)}; input.dispatchEvent(new Event('input', { bubbles: true })); }
  })()`);
  // Prefer typing via keyboard API for React fields
  const emailBox = await page.$('input[type="email"], input[type="text"]');
  if (emailBox) {
    await emailBox.click({ clickCount: 3 });
    await page.keyboard.type(email, { delay: 10 });
  }
  await page.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /continue/i.test(b.textContent||''));
    btn && btn.click();
  })()`);
  await sleep(2500);

  // Classic password page
  await page.waitForSelector('input[type="password"]', { timeout: 20_000 });
  const pw = await page.$('input[type="password"]');
  if (!pw) throw new Error("Password field not found");
  await pw.click({ clickCount: 3 });
  await page.keyboard.type(password, { delay: 15 });
  await page.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /sign in/i.test(b.textContent||''));
    btn && btn.click();
  })()`);
  await page.waitForFunction(
    `!/log-in/i.test(location.href)`,
    { timeout: 30_000 },
  ).catch(() => undefined);
  await sleep(1500);

  console.log("Opening lightbox…", lightboxUrl);
  await page.goto(lightboxUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(1500);
  for (let i = 0; i < 10; i++) {
    await page.evaluate(`window.scrollBy(0, 1400)`);
    await sleep(350);
  }

  const dump = await page.evaluate(`(() => {
    function pickUrl(img) {
      return img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
    }
    const imgs = Array.from(document.querySelectorAll('img')).map((img) => {
      const a = img.closest('a');
      return {
        imageUrl: pickUrl(img),
        altText: (img.alt || '').trim(),
        sourcePageUrl: a && a.href ? a.href : location.href,
      };
    }).filter((x) => /c\\d+\\.alamy\\.com\\/(zooms|comp|thumbs)\\//i.test(x.imageUrl) || /\\/zooms\\//i.test(x.imageUrl));
    const seen = new Set();
    const unique = [];
    for (const x of imgs) {
      if (seen.has(x.imageUrl)) continue;
      seen.add(x.imageUrl);
      unique.push(x);
    }
    const heading = (document.querySelector('h1') && document.querySelector('h1').innerText) || '';
    return {
      lightboxId: ${JSON.stringify(lbId)},
      url: location.href,
      title: document.title,
      heading,
      extractedAt: new Date().toISOString(),
      images: unique,
    };
  })()`);

  await browser.close();
  writeFileSync(outFile, JSON.stringify(dump, null, 2));
  console.log(
    `Wrote ${(dump as { images: unknown[] }).images.length} images → ${outFile} (${(dump as { heading?: string }).heading || ""})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
