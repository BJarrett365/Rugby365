import {
  buildMediaWikiHeaders,
  resolveMediaWikiApiBaseUrl,
  resolveMediaWikiUserAgent,
  type MediaWikiRequestOptions,
} from "./mediawiki-request";
import { parseWikipediaWorldRankingsHtml } from "./parse-world-rankings";
import {
  wikipediaWorldRankingsPageTitle,
  wikipediaWorldRankingsPageUrl,
} from "./parse-world-rankings";
import type { WikipediaWorldRankingsParseResult } from "./world-rankings-types";
import type { WorldRugbyRankingCategory } from "../world-rugby/rankings-types";

export type FetchWikipediaWorldRankingsOptions = MediaWikiRequestOptions & {
  category?: WorldRugbyRankingCategory;
};

/**
 * Fetch + parse the Wikipedia World Rugby Rankings page (rendered HTML).
 */
export async function fetchWikipediaWorldRankings(
  options: FetchWikipediaWorldRankingsOptions = {},
): Promise<WikipediaWorldRankingsParseResult> {
  const category = options.category ?? "mru";
  const title = wikipediaWorldRankingsPageTitle(category);
  const apiBase = resolveMediaWikiApiBaseUrl(
    options,
    "WIKIPEDIA_API_BASE_URL",
    "https://en.wikipedia.org/w/api.php",
  );
  const userAgent = resolveMediaWikiUserAgent(
    options,
    "WIKIPEDIA_USER_AGENT",
    "Rugby365WorldRankings/1.0 (historical rankings enrichment; contact: ops@rugby365.com)",
  );

  const url = new URL(apiBase.includes("api.php") ? apiBase : `${apiBase}/api.php`);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");

  const res = await fetch(url.toString(), {
    headers: buildMediaWikiHeaders(userAgent, options.accessToken, {
      Accept: "application/json",
    }),
  });

  if (!res.ok) {
    throw new Error(`Wikipedia World Rankings fetch failed (${res.status})`);
  }

  const payload = (await res.json()) as {
    error?: { info?: string };
    parse?: { title?: string; text?: string };
  };

  if (payload.error?.info) {
    throw new Error(`Wikipedia World Rankings parse error: ${payload.error.info}`);
  }

  const html = payload.parse?.text;
  if (!html) {
    throw new Error(`Wikipedia World Rankings page returned no HTML: ${title}`);
  }

  return parseWikipediaWorldRankingsHtml(html, {
    category,
    pageTitle: payload.parse?.title ?? title,
    sourceUrl: wikipediaWorldRankingsPageUrl(category),
  });
}
