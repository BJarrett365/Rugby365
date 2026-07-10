const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only; local dev)";

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

  return [...unique].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

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

/** Candidate Wikipedia article titles for a rugby player name (rugby union page first). */
export async function findWikipediaPlayerArticleTitles(playerName: string): Promise<string[]> {
  const name = playerName.trim();
  if (!name) return [];

  const candidates: string[] = [];
  const rugbyTitle = rugbyUnionPlayerTitle(name);

  if (await articleExists(rugbyTitle)) {
    candidates.push(rugbyTitle);
  }

  if (name !== rugbyTitle && (await articleExists(name))) {
    candidates.push(name);
  }

  try {
    const searches = await Promise.all([
      wikiSearch(`"${name}" "rugby union"`, 5),
      wikiSearch(`${name} rugby union`, 5),
      wikiSearch(`${name} rugby`, 5),
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
