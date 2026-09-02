import { buildMediaWikiHeaders } from "@rugby365/import-sdk";
import { foldRankingClubKey } from "./player-ranking-engine";

const API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only archive enrichment)";

type WikiPage = {
  title?: string;
  missing?: boolean;
  thumbnail?: { source?: string };
  images?: Array<{ title?: string }>;
  extract?: string;
};

function headers() {
  return buildMediaWikiHeaders(USER_AGENT, process.env.WIKIPEDIA_ACCESS_TOKEN ?? null);
}

async function wikiQuery(params: Record<string, string>): Promise<Record<string, unknown>> {
  const search = new URLSearchParams({ format: "json", formatversion: "2", redirects: "1", ...params });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/x-www-form-urlencoded" },
        body: search,
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return {};
      return (await res.json()) as Record<string, unknown>;
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return {};
}

function pagesOf(payload: Record<string, unknown>): WikiPage[] {
  const query = payload.query as { pages?: unknown } | undefined;
  const pages = query?.pages;
  if (Array.isArray(pages)) return pages as WikiPage[];
  if (pages && typeof pages === "object") return Object.values(pages as Record<string, WikiPage>);
  return [];
}

function redirectsOf(payload: Record<string, unknown>): Array<{ from: string; to: string }> {
  const query = payload.query as { redirects?: Array<{ from: string; to: string }> } | undefined;
  return query?.redirects ?? [];
}

export async function fetchWikipediaThumbnails(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const payload = await wikiQuery({
      action: "query",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "240",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      const url = page.thumbnail?.source;
      if (!page.title || !url) continue;
      map.set(page.title, url);
      const from = redirectFrom.get(page.title);
      if (from) map.set(from, url);
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) map.set(requested, url);
      }
    }
  }
  return map;
}

export async function fetchWikipediaOriginalImages(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    process.stdout.write(`wiki originals ${Math.min(i + 40, unique.length)}/${unique.length}\r`);
    const payload = await wikiQuery({
      action: "query",
      prop: "pageimages",
      piprop: "original|thumbnail",
      pithumbsize: "440",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      const url =
        (page as { original?: { source?: string } }).original?.source || page.thumbnail?.source;
      if (!page.title || !url) continue;
      map.set(page.title, url);
      const from = redirectFrom.get(page.title);
      if (from) map.set(from, url);
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) map.set(requested, url);
      }
    }
    if (i + 40 < unique.length) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (unique.length) process.stdout.write("\n");
  return map;
}

export async function fetchWikipediaClubLogos(titles: string[]): Promise<Map<string, string>> {
  const logoByPage = new Map<string, string>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  const fileForPage = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const payload = await wikiQuery({
      action: "query",
      prop: "images",
      imlimit: "40",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      const files = (page.images ?? [])
        .map((img) => img.title ?? "")
        .filter((title) => /logo|crest|badge|shield|emblem/i.test(title))
        .filter((title) => !/kit |flag of|ambox|icon|pictogram|commons-logo|wikimedia|wikipedia/i.test(title));
      const file = files[0];
      if (!page.title || !file) continue;
      fileForPage.set(page.title, file);
      const from = redirectFrom.get(page.title);
      if (from) fileForPage.set(from, file);
    }
  }
  const files = [...new Set(fileForPage.values())];
  const urlByFile = new Map<string, string>();
  for (let i = 0; i < files.length; i += 40) {
    const chunk = files.slice(i, i + 40);
    const payload = await wikiQuery({
      action: "query",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "240",
      titles: chunk.join("|"),
    });
    for (const page of pagesOf(payload)) {
      const info = (page as { imageinfo?: Array<{ thumburl?: string; url?: string }> }).imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!page.title || !url) continue;
      urlByFile.set(page.title, url);
    }
  }
  for (const [pageTitle, file] of fileForPage) {
    const url = urlByFile.get(file);
    if (url) logoByPage.set(pageTitle, url);
  }
  return logoByPage;
}

const PLAYER_WIKI_TITLE_ALIASES: Record<string, string[]> = {
  "gabin villiere": ["Gabin Villière", "Gabin Villière (rugby union)"],
  "gareth thomas": ["Gareth Thomas (rugby union, born 1993)", "Gareth Thomas (rugby union, born 1994)"],
  "tomas francis": ["Tomas Francis", "Tomas Francis (rugby union)"],
  "peato mauvaka": ["Peato Mauvaka"],
  "jonathan danty": ["Jonathan Danty"],
  "yoram moefana": ["Yoram Moefana"],
  "cyril baille": ["Cyril Baille"],
  "cameron woki": ["Cameron Woki"],
  "tommy reffell": ["Tommy Reffell"],
  "nick tompkins": ["Nick Tompkins"],
  "will rowlands": ["Will Rowlands"],
};

export function wikipediaTitleCandidates(
  name: string,
  kind: "player" | "club" | "referee" | "coach",
  birthYear?: number | null,
): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const titles = [trimmed];
  if (kind === "player") {
    titles.push(`${trimmed} (rugby union)`);
    titles.push(`${trimmed} (rugby)`);
    if (birthYear && birthYear > 1940) {
      titles.push(`${trimmed} (rugby union, born ${birthYear})`);
      titles.push(`${trimmed} (rugby, born ${birthYear})`);
    }
    const aliases = PLAYER_WIKI_TITLE_ALIASES[foldRankingClubKey(trimmed)];
    if (aliases) titles.push(...aliases);
  }
  if (kind === "coach") {
    titles.push(`${trimmed} (rugby union)`);
    titles.push(`${trimmed} (rugby coach)`);
    titles.push(`${trimmed} (coach)`);
  }
  if (kind === "referee") {
    titles.push(`${trimmed} (rugby union)`);
    titles.push(`${trimmed} (rugby referee)`);
    titles.push(`${trimmed} (referee)`);
  }
  if (kind === "club") {
    titles.push(`${trimmed} (rugby union)`);
    titles.push(`${trimmed} rugby`);
    const words = trimmed.split(/\s+/);
    if (words.length >= 3) {
      titles.push([...words.slice(0, -2), `${words.at(-2)}-${words.at(-1)}`].join(" "));
    }
    if (words.length >= 4) {
      titles.push(words.slice(0, 2).join(" "));
      titles.push(`${words.slice(0, 2).join(" ")} (rugby union)`);
    }
  }
  return [...new Set(titles)];
}

export function thumbnailForName(
  map: Map<string, string>,
  name: string,
  kind: "player" | "club" | "referee" | "coach",
): string | null {
  for (const title of wikipediaTitleCandidates(name, kind)) {
    const hit = map.get(title);
    if (hit) return hit;
  }
  const folded = foldRankingClubKey(name);
  for (const [key, url] of map) {
    if (foldRankingClubKey(key) === folded) return url;
  }
  return null;
}

const WIKI_NATIONALITY_TO_COUNTRY: Array<[RegExp, string]> = [
  [/\bnew zealand\b/i, "New Zealand"],
  [/\bsouth african\b/i, "South Africa"],
  [/\benglish\b/i, "England"],
  [/\birish\b/i, "Ireland"],
  [/\bwelsh\b/i, "Wales"],
  [/\bscottish\b/i, "Scotland"],
  [/\bfrench\b/i, "France"],
  [/\baustralian\b/i, "Australia"],
  [/\bargentine|\bargentinian\b/i, "Argentina"],
  [/\bgeorgian\b/i, "Georgia"],
  [/\bitalian\b/i, "Italy"],
  [/\bjapanese\b/i, "Japan"],
  [/\bsamoan\b/i, "Samoa"],
  [/\bfijian\b/i, "Fiji"],
  [/\bnamibian\b/i, "Namibia"],
  [/\buruguayan\b/i, "Uruguay"],
  [/\bcanadian\b/i, "Canada"],
  [/\bamerican\b/i, "United States"],
];

export function countryFromWikipediaExtract(extract: string | null | undefined): string | null {
  if (!extract) return null;
  const lead = extract.slice(0, 280);
  for (const [pattern, country] of WIKI_NATIONALITY_TO_COUNTRY) {
    if (pattern.test(lead)) return country;
  }
  return null;
}

export async function fetchWikipediaPersonCountries(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 20) {
    const chunk = unique.slice(i, i + 20);
    const payload = await wikiQuery({
      action: "query",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exchars: "280",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      const country = countryFromWikipediaExtract(page.extract);
      if (!page.title || !country) continue;
      map.set(page.title, country);
      const from = redirectFrom.get(page.title);
      if (from) map.set(from, country);
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) map.set(requested, country);
      }
    }
  }
  return map;
}

const REFEREE_CLUB_COMPETITION_RE =
  /world cup|six nations|the rugby championship|premiership|top 14|super rugby|pro14|united rugby|european rugby|champions cup|challenge cup|test match|international|championship|nations cup|pacific nations/i;

function stripWikiClubLabel(raw: string): string | null {
  let value = raw.split("\n")[0] ?? raw;
  value = value
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^/]*\/>/gi, "")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<!--.*?-->/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || /^(n\/a|-|—|none|tbc)$/i.test(value)) return null;
  if (REFEREE_CLUB_COMPETITION_RE.test(value)) return null;
  return value;
}

export function parseRefereeClubsFromWikitext(wikitext: string): {
  lastClub: string | null;
  clubs: string[];
} {
  const cut = wikitext.search(/\n==[^=]/);
  const infobox = wikitext.slice(0, cut === -1 ? 12_000 : cut);
  const playing: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined, into: string[]) => {
    const name = raw ? stripWikiClubLabel(raw) : null;
    if (!name) return;
    const key = foldRankingClubKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    into.push(name);
  };

  for (const match of infobox.matchAll(
    /\|\s*(?:ru_)?(?:amateur|pro)?(?:clubs?|teams?)\d*\s*=\s*(.+)/gi,
  )) {
    push(match[1], playing);
  }
  const current = infobox.match(/\|\s*currentclub\s*=\s*(.+)/i);
  if (current) push(current[1], playing);
  const union = infobox.match(/\|\s*union\s*=\s*(.+)/i);
  const unionName = union?.[1] ? stripWikiClubLabel(union[1]) : null;
  const lastClub = playing.at(-1) ?? unionName ?? null;
  const clubs = [...playing];
  if (unionName) {
    const key = foldRankingClubKey(unionName);
    if (key && !seen.has(key)) clubs.push(unionName);
  }
  return { lastClub, clubs };
}

export async function fetchWikipediaWikitext(title: string): Promise<string | null> {
  const payload = await wikiQuery({
    action: "parse",
    page: title,
    prop: "wikitext",
  });
  const parsed = payload.parse as { wikitext?: string | { "*": string } } | undefined;
  const raw = parsed?.wikitext;
  const text = typeof raw === "string" ? raw : raw?.["*"];
  return text?.trim() ? text : null;
}

export async function fetchWikipediaRefereeClubs(
  names: string[],
): Promise<Map<string, { lastClub: string | null; clubs: string[] }>> {
  const map = new Map<string, { lastClub: string | null; clubs: string[] }>();
  const titles = [...new Set(names.flatMap((name) => wikipediaTitleCandidates(name, "referee")))];
  const wikitextByTitle = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 15) {
    const chunk = titles.slice(i, i + 15);
    const payload = await wikiQuery({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      const revision = (
        page as {
          revisions?: Array<{ slots?: { main?: { content?: string } }; content?: string }>;
        }
      ).revisions?.[0];
      const text = revision?.slots?.main?.content ?? revision?.content;
      if (!page.title || !text) continue;
      wikitextByTitle.set(page.title, text);
      const from = redirectFrom.get(page.title);
      if (from) wikitextByTitle.set(from, text);
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) wikitextByTitle.set(requested, text);
      }
    }
  }
  for (const name of names) {
    for (const title of wikipediaTitleCandidates(name, "referee")) {
      const text =
        wikitextByTitle.get(title) ??
        [...wikitextByTitle.entries()].find(
          ([key]) => foldRankingClubKey(key) === foldRankingClubKey(title),
        )?.[1];
      if (!text) continue;
      const parsed = parseRefereeClubsFromWikitext(text);
      if (parsed.clubs.length) {
        map.set(name, parsed);
        break;
      }
    }
  }
  return map;
}

export async function fetchWikidataThumbnail(title: string): Promise<string | null> {
  const search = new URLSearchParams({
    action: "wbgetentities",
    sites: "enwiki",
    titles: title,
    props: "claims",
    format: "json",
  });
  const res = await fetch(`https://www.wikidata.org/w/api.php?${search}`, { headers: headers() });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    entities?: Record<
      string,
      { claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }
    >;
  };
  const entity = Object.values(payload.entities ?? {}).find((item) => item && "claims" in item);
  const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!file) return null;
  const info = await wikiQuery({
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "240",
    titles: `File:${file}`,
  });
  for (const page of pagesOf(info)) {
    const url = (page as { imageinfo?: Array<{ thumburl?: string; url?: string }> }).imageinfo?.[0]
      ?.thumburl;
    if (url) return url;
  }
  return null;
}
