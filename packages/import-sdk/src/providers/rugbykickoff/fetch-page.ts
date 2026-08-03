import {
  filterRugbyKickoffInternational,
  parseRugbyKickoffListingHtml,
} from "./parse-listing";
import type { RugbyKickoffListingPreview } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const RUGBYKICKOFF_UK_URL = "https://www.rugbykickoff.com/";

export async function fetchRugbyKickoffHtml(
  url: string = RUGBYKICKOFF_UK_URL,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
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
      throw new Error(`Rugby Kick Off HTTP ${res.status}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function previewRugbyKickoffUk(
  options: {
    html?: string;
    sourceUrl?: string;
    internationalOnly?: boolean;
  } = {},
): Promise<RugbyKickoffListingPreview> {
  const sourceUrl = options.sourceUrl?.trim() || RUGBYKICKOFF_UK_URL;
  const html = options.html?.trim()
    ? options.html
    : await fetchRugbyKickoffHtml(sourceUrl);
  const preview = parseRugbyKickoffListingHtml(html, sourceUrl);
  if (options.internationalOnly === false) return preview;
  return {
    ...preview,
    listings: filterRugbyKickoffInternational(preview.listings),
  };
}
