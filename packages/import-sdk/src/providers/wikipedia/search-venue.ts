const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only; local dev)";

type WikiSearchHit = { title: string };

async function wikiSearch(query: string, limit = 5): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { query?: { search?: WikiSearchHit[] } };
  return (data.query?.search ?? []).map((hit) => hit.title);
}

async function articleExists(title: string): Promise<boolean> {
  const slug = title.trim().replace(/ /g, "_");
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
    {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    },
  );
  return res.ok;
}

/** Candidate Wikipedia article titles for a stadium / venue name. */
export async function findWikipediaVenueArticleTitles(venueName: string): Promise<string[]> {
  const name = venueName.trim();
  if (!name) return [];

  const candidates: string[] = [];
  if (await articleExists(name)) candidates.push(name);

  const searches = await Promise.all([
    wikiSearch(`"${name}" stadium`, 5),
    wikiSearch(`"${name}" rugby stadium`, 5),
    wikiSearch(`${name} stadium`, 5),
  ]);

  for (const titles of searches) {
    for (const title of titles) {
      if (!candidates.includes(title)) candidates.push(title);
    }
  }

  return candidates;
}
