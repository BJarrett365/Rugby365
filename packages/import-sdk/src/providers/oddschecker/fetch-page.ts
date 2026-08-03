import { parseOddscheckerUrl } from "./parse-url";
import { parseOddscheckerListingHtml } from "./parse-listing";
import { parseOddscheckerMarketHtml } from "./parse-odds";
import type { OddscheckerPreview } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Fetch Oddschecker HTML.
 * Note: Cloudflare often returns 403 to datacenter/simple clients.
 * Prefer paste-HTML fallback in admin when fetch fails.
 */
export async function fetchOddscheckerHtml(url: string): Promise<string> {
  const parsed = parseOddscheckerUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(parsed.sourceUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Oddschecker HTTP ${res.status}. Cloudflare may be blocking automated fetch — paste page HTML instead.`,
      );
    }
    if (/attention required|cloudflare|cf-browser-verification/i.test(text) && text.length < 20_000) {
      throw new Error(
        "Oddschecker returned a Cloudflare challenge. Open the page in a browser and paste View Source HTML.",
      );
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function previewOddscheckerPage(
  sourceUrl: string,
  options: { html?: string } = {},
): Promise<OddscheckerPreview> {
  const parsed = parseOddscheckerUrl(sourceUrl);
  const html = options.html?.trim()
    ? options.html
    : await fetchOddscheckerHtml(parsed.sourceUrl);

  if (parsed.kind === "market") {
    return parseOddscheckerMarketHtml(html, parsed.sourceUrl);
  }
  return parseOddscheckerListingHtml(html, parsed.sourceUrl);
}
