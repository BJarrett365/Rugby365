import {
  buildMediaWikiHeaders,
  resolveMediaWikiApiBaseUrl,
  resolveMediaWikiUserAgent,
  type MediaWikiRequestOptions,
} from "./mediawiki-request";

const DEFAULT_WIKI_API = "https://en.wikipedia.org/w/api.php";
const DEFAULT_USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only; local dev)";

type WikiSearchHit = { title: string };

function wikiConfig(options?: MediaWikiRequestOptions) {
  return {
    apiBaseUrl: resolveMediaWikiApiBaseUrl(options, "WIKIPEDIA_API_BASE_URL", DEFAULT_WIKI_API),
    userAgent: resolveMediaWikiUserAgent(options, "WIKIPEDIA_USER_AGENT", DEFAULT_USER_AGENT),
    accessToken: options?.accessToken ?? process.env.WIKIPEDIA_ACCESS_TOKEN ?? null,
  };
}

async function wikiSearch(
  query: string,
  limit = 5,
  options?: MediaWikiRequestOptions,
): Promise<string[]> {
  const { apiBaseUrl, userAgent, accessToken } = wikiConfig(options);
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBaseUrl}?${params}`, {
    headers: buildMediaWikiHeaders(userAgent, accessToken),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { query?: { search?: WikiSearchHit[] } };
  return (data.query?.search ?? []).map((hit) => hit.title);
}

async function articleExists(title: string, options?: MediaWikiRequestOptions): Promise<boolean> {
  const { userAgent, accessToken } = wikiConfig(options);
  const slug = title.trim().replace(/ /g, "_");
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
    {
      headers: buildMediaWikiHeaders(userAgent, accessToken, { Accept: "application/json" }),
    },
  );
  return res.ok;
}

/** Candidate Wikipedia article titles for a stadium / venue name. */
export async function findWikipediaVenueArticleTitles(
  venueName: string,
  options?: MediaWikiRequestOptions,
): Promise<string[]> {
  const name = venueName.trim();
  if (!name) return [];

  const candidates: string[] = [];
  if (await articleExists(name, options)) candidates.push(name);

  const searches = await Promise.all([
    wikiSearch(`"${name}" stadium`, 5, options),
    wikiSearch(`"${name}" rugby stadium`, 5, options),
    wikiSearch(`${name} stadium`, 5, options),
  ]);

  for (const titles of searches) {
    for (const title of titles) {
      if (!candidates.includes(title)) candidates.push(title);
    }
  }

  return candidates;
}
