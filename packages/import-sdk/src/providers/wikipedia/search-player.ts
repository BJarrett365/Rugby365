import {
  buildMediaWikiHeaders,
  resolveMediaWikiApiBaseUrl,
  resolveMediaWikiUserAgent,
  type MediaWikiRequestOptions,
} from "./mediawiki-request";

const DEFAULT_WIKI_API = "https://en.wikipedia.org/w/api.php";
const DEFAULT_USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only; local dev)";

type WikiSearchHit = { title: string };

/** Standard Wikipedia disambiguation suffix for rugby players. */
export function rugbyUnionPlayerTitle(playerName: string): string {
  return `${playerName.trim()} (rugby union)`;
}

export function isRugbyUnionPlayerTitle(title: string): boolean {
  return /\(\s*rugby union\s*\)\s*$/i.test(title.trim());
}

/** Prefer exact rugby union pages, then exact name, then other rugby union hits. */
export function prioritizePlayerArticleTitles(candidates: string[], playerName: string): string[] {
  const name = playerName.trim();
  const rugbyExact = rugbyUnionPlayerTitle(name);
  const seen = new Set<string>();
  const unique = candidates.filter((title) => {
    const key = title.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const score = (title: string): number => {
    const t = title.trim();
    if (t === rugbyExact) return 100;
    if (t === name) return 80;
    if (isRugbyUnionPlayerTitle(t) && t.toLowerCase().startsWith(name.toLowerCase())) return 60;
    if (isRugbyUnionPlayerTitle(t)) return 40;
    if (t.toLowerCase().includes(name.toLowerCase())) return 20;
    return 0;
  };

  return [...unique]
    .filter((title) => score(title) > 0)
    .sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

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

/** Candidate Wikipedia article titles for a rugby player name (rugby union page first). */
export async function findWikipediaPlayerArticleTitles(
  playerName: string,
  options?: MediaWikiRequestOptions,
): Promise<string[]> {
  const name = playerName.trim();
  if (!name) return [];

  const candidates: string[] = [];
  const rugbyTitle = rugbyUnionPlayerTitle(name);

  if (await articleExists(rugbyTitle, options)) {
    candidates.push(rugbyTitle);
  }

  if (name !== rugbyTitle && (await articleExists(name, options))) {
    candidates.push(name);
  }

  // Exact rugby / name hits are enough — extra search queries burn the Wikipedia 429 budget.
  if (candidates.length > 0) {
    return prioritizePlayerArticleTitles(candidates, name);
  }

  try {
    const searches = await Promise.all([
      wikiSearch(`"${name}" "rugby union"`, 5, options),
      wikiSearch(`${name} rugby union`, 5, options),
      wikiSearch(`${name} rugby`, 5, options),
    ]);

    for (const titles of searches) {
      for (const title of titles) {
        if (!candidates.includes(title)) candidates.push(title);
      }
    }
  } catch {
    /* Search is best-effort when rate-limited */
  }

  return prioritizePlayerArticleTitles(candidates, name);
}
