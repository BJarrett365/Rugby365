import { parseBmbetsUrl } from "./parse-url";
import { parseBmbetsListingHtml, parseBmbetsMatchHtml } from "./parse-listing";
import type { BmbetsPreview } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function fetchBmbetsHtml(url: string): Promise<string> {
  const parsed = parseBmbetsUrl(url);
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
      throw new Error(`BMbets HTTP ${res.status}. Paste page HTML in admin if fetch is blocked.`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function previewBmbetsPage(
  sourceUrl: string,
  options: { html?: string } = {},
): Promise<BmbetsPreview> {
  const parsed = parseBmbetsUrl(sourceUrl);
  const html = options.html?.trim() ? options.html : await fetchBmbetsHtml(parsed.sourceUrl);

  if (parsed.kind === "match") {
    return parseBmbetsMatchHtml(html, parsed.sourceUrl);
  }
  return parseBmbetsListingHtml(html, parsed.sourceUrl);
}
