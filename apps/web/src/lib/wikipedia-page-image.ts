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

async function wikiQuery(
  params: Record<string, string>,
  api = API,
): Promise<Record<string, unknown>> {
  const search = new URLSearchParams({ format: "json", formatversion: "2", redirects: "1", ...params });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(api, {
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

const PERSON_IMAGE_WIKIS = ["fr", "cy", "it", "es", "de", "ja", "ru", "nl"] as const;

export async function fetchWikipediaLanguageThumbnails(
  lang: string,
  titles: string[],
): Promise<Map<string, string>> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const map = new Map<string, string>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const payload = await wikiQuery(
      {
        action: "query",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "440",
        titles: chunk.join("|"),
      },
      api,
    );
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

export async function fetchLanguageWikipediaHeadshots(
  names: string[],
  langs: readonly string[] = PERSON_IMAGE_WIKIS,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const missing = names.filter((name) => name.trim());
  if (!missing.length) return result;
  for (const lang of langs) {
    const still = missing.filter((name) => !result.has(name));
    if (!still.length) break;
    const titles = still.flatMap((name) => [
      name,
      `${name} (rugby)`,
      `${name} (rugby union)`,
      `${name} (rugby à XV)`,
    ]);
    const thumbs = await fetchWikipediaLanguageThumbnails(lang, titles);
    for (const name of still) {
      const url =
        thumbs.get(name) ??
        thumbs.get(`${name} (rugby)`) ??
        thumbs.get(`${name} (rugby union)`) ??
        thumbs.get(`${name} (rugby à XV)`);
      if (url) result.set(name, url);
    }
  }
  return result;
}

export async function fetchCommonsPortraitForPerson(name: string): Promise<string | null> {
  const surname = name.trim().split(/\s+/).pop();
  if (!surname || surname.length < 3) return null;
  const payload = await wikiQuery(
    {
      action: "query",
      list: "search",
      srsearch: `"${name}" rugby`,
      srnamespace: "6",
      srlimit: "8",
    },
    "https://commons.wikimedia.org/w/api.php",
  );
  const query = payload.query as { search?: Array<{ title?: string }> } | undefined;
  const files = (query?.search ?? [])
    .map((row) => row.title)
    .filter((title): title is string => Boolean(title))
    .filter((title) => new RegExp(surname.replace(/'/g, "['’]?"), "i").test(title));
  if (!files.length) return null;
  const info = await wikiQuery(
    {
      action: "query",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "440",
      titles: files.slice(0, 3).join("|"),
    },
    "https://commons.wikimedia.org/w/api.php",
  );
  for (const page of pagesOf(info)) {
    const url =
      (page as { imageinfo?: Array<{ thumburl?: string; url?: string }> }).imageinfo?.[0]
        ?.thumburl ||
      (page as { imageinfo?: Array<{ url?: string }> }).imageinfo?.[0]?.url;
    if (url && !/logo|crest|flag|kit|map/i.test(url)) return url;
  }
  return null;
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

const REFEREE_WIKI_TITLE_ALIASES: Record<string, string[]> = {
  "owen doyle": ["Owen Doyle (rugby union)"],
  "andrew cole": ["Andrew Cole (rugby union)", "Andrew Cole (referee)"],
  "steve walsh": ["Steve Walsh (rugby referee)"],
  "paul williams": ["Paul Williams (rugby referee)"],
  "alan lewis": ["Alan Lewis (rugby union)", "Alan Lewis (referee)"],
  "chris white": ["Chris White (rugby union)", "Chris White (referee)"],
  "dave bishop": ["Dave Bishop (referee)"],
  "joel dume": ["Joël Dumé"],
  "paddy obrien": ["Paddy O'Brien (rugby union)", "Paddy O'Brien (referee)"],
  "jonathan kaplan": ["Jonathan Kaplan (rugby referee)", "Jonathan Kaplan (referee)"],
  "keith lawrence": ["Keith Lawrence (referee)"],
  "david burnett": ["David Burnett (referee)"],
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
    const aliases = PLAYER_WIKI_TITLE_ALIASES[foldRankingClubKey(trimmed)] ?? [];
    return [
      ...new Set([
        ...aliases,
        `${trimmed} (rugby union)`,
        `${trimmed} (rugby)`,
        ...(birthYear && birthYear > 1940
          ? [`${trimmed} (rugby union, born ${birthYear})`, `${trimmed} (rugby, born ${birthYear})`]
          : []),
        trimmed,
      ]),
    ];
  }
  if (kind === "coach") {
    titles.push(`${trimmed} (rugby union)`);
    titles.push(`${trimmed} (rugby coach)`);
    titles.push(`${trimmed} (coach)`);
  }
  if (kind === "referee") {
    const aliases = REFEREE_WIKI_TITLE_ALIASES[foldRankingClubKey(trimmed)] ?? [];
    return [
      ...new Set([
        ...aliases,
        `${trimmed} (rugby referee)`,
        `${trimmed} (rugby union)`,
        `${trimmed} (referee)`,
        trimmed,
      ]),
    ];
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
  if (/[|=]/.test(value) || /^→/.test(value)) return null;
  if (REFEREE_CLUB_COMPETITION_RE.test(value)) return null;
  return value;
}

export function isRugbyPersonExtract(extract: string | null | undefined): boolean {
  if (!extract) return false;
  const lead = extract.slice(0, 400).toLowerCase();
  if (/\b(footballer|soccer player|association football)\b/.test(lead) && !/\brugby\b/.test(lead)) {
    return false;
  }
  return /\brugby\b/.test(lead);
}

export function isRugbyRefereeExtract(extract: string | null | undefined): boolean {
  if (!isRugbyPersonExtract(extract)) return false;
  return /\breferee\b/.test(extract!.slice(0, 400).toLowerCase());
}

export function isRugbyRefereeWikitext(wikitext: string): boolean {
  const head = wikitext.slice(0, 8000);
  if (/infobox\s+(?:football(?:er)?(?: biography)?|soccer)/i.test(head)) return false;
  if (/infobox rugby/i.test(head)) return true;
  if (/rugby union referee|rugby referee|international rugby union referee/i.test(head)) return true;
  if (/\|caps\d+\s*=/.test(head) && /\|goals\d+\s*=/.test(head) && !/\brugby\b/i.test(head)) {
    return false;
  }
  return /\breferee\b/i.test(head) && /\brugby\b/i.test(head);
}

export function parseRefereeClubsFromWikitext(wikitext: string): {
  lastClub: string | null;
  clubs: string[];
} {
  if (!isRugbyRefereeWikitext(wikitext)) return { lastClub: null, clubs: [] };
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
      if (!text || !isRugbyRefereeWikitext(text)) continue;
      const parsed = parseRefereeClubsFromWikitext(text);
      if (parsed.clubs.length) {
        map.set(name, parsed);
        break;
      }
    }
  }
  return map;
}

export type WikipediaRefereeEnrichment = {
  imageUrl: string | null;
  country: string | null;
  clubs: { lastClub: string | null; clubs: string[] } | null;
  wikipediaTitle: string | null;
};

export async function fetchWikipediaRefereeEnrichment(
  names: string[],
): Promise<Map<string, WikipediaRefereeEnrichment>> {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const titles = [...new Set(uniqueNames.flatMap((name) => wikipediaTitleCandidates(name, "referee")))];
  const extractByTitle = new Map<string, string>();
  const imageByTitle = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const payload = await wikiQuery({
      action: "query",
      prop: "extracts|pageimages",
      exintro: "1",
      explaintext: "1",
      exchars: "280",
      piprop: "thumbnail",
      pithumbsize: "240",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      if (!page.title) continue;
      const extract = page.extract ?? "";
      const image = page.thumbnail?.source;
      const aliases = [page.title, redirectFrom.get(page.title)].filter(Boolean) as string[];
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) aliases.push(requested);
      }
      for (const key of aliases) {
        if (extract) extractByTitle.set(key, extract);
        if (image) imageByTitle.set(key, image);
      }
    }
  }

  const result = new Map<string, WikipediaRefereeEnrichment>();
  for (const name of uniqueNames) {
    const hit = wikipediaTitleCandidates(name, "referee").find((title) => {
      const extract =
        extractByTitle.get(title) ??
        [...extractByTitle.entries()].find(
          ([key]) => foldRankingClubKey(key) === foldRankingClubKey(title),
        )?.[1];
      return isRugbyRefereeExtract(extract);
    });
    if (!hit) {
      result.set(name, { imageUrl: null, country: null, clubs: null, wikipediaTitle: null });
      continue;
    }
    const extract =
      extractByTitle.get(hit) ??
      [...extractByTitle.entries()].find(
        ([key]) => foldRankingClubKey(key) === foldRankingClubKey(hit),
      )?.[1];
    const image =
      imageByTitle.get(hit) ??
      [...imageByTitle.entries()].find(
        ([key]) => foldRankingClubKey(key) === foldRankingClubKey(hit),
      )?.[1];
    result.set(name, {
      imageUrl: image ?? null,
      country: countryFromWikipediaExtract(extract) ?? null,
      clubs: null,
      wikipediaTitle: hit,
    });
  }

  const clubs = await fetchWikipediaRefereeClubs(uniqueNames);
  for (const [name, current] of result) {
    current.clubs = clubs.get(name) ?? null;
  }
  return result;
}

function rememberWikiPage(
  extractByTitle: Map<string, string>,
  imageByTitle: Map<string, string>,
  page: WikiPage,
  aliases: string[],
) {
  const extract = page.extract ?? "";
  const image = page.thumbnail?.source;
  for (const key of aliases) {
    if (extract) extractByTitle.set(key, extract);
    if (image) imageByTitle.set(key, image);
  }
}

async function loadWikiExtractsAndImages(titles: string[]) {
  const extractByTitle = new Map<string, string>();
  const imageByTitle = new Map<string, string>();
  const uniqueTitles = [...new Set(titles.map((title) => title.trim()).filter(Boolean))];
  for (let i = 0; i < uniqueTitles.length; i += 20) {
    const chunk = uniqueTitles.slice(i, i + 20);
    const payload = await wikiQuery({
      action: "query",
      prop: "extracts|pageimages",
      exintro: "1",
      explaintext: "1",
      exchars: "280",
      piprop: "thumbnail",
      pithumbsize: "240",
      titles: chunk.join("|"),
    });
    const redirectFrom = new Map(redirectsOf(payload).map((r) => [r.to, r.from]));
    for (const page of pagesOf(payload)) {
      if (!page.title) continue;
      const aliases = [page.title, redirectFrom.get(page.title)].filter(Boolean) as string[];
      for (const requested of chunk) {
        if (requested.toLowerCase() === page.title.toLowerCase()) aliases.push(requested);
      }
      rememberWikiPage(extractByTitle, imageByTitle, page, aliases);
    }
  }
  return { extractByTitle, imageByTitle };
}

function pickRugbyPlayerImage(
  name: string,
  birthYear: number | null | undefined,
  extractByTitle: Map<string, string>,
  imageByTitle: Map<string, string>,
): string | null {
  const folded = foldRankingClubKey(name);
  const candidates = wikipediaTitleCandidates(name, "player", birthYear);
  for (const title of candidates) {
    const extract =
      extractByTitle.get(title) ??
      [...extractByTitle.entries()].find(
        ([key]) => foldRankingClubKey(key) === foldRankingClubKey(title),
      )?.[1];
    const image =
      imageByTitle.get(title) ??
      [...imageByTitle.entries()].find(
        ([key]) => foldRankingClubKey(key) === foldRankingClubKey(title),
      )?.[1];
    if (image && (isRugbyPersonExtract(extract) || /rugby/i.test(title))) return image;
  }
  for (const [key, image] of imageByTitle) {
    const keyFold = foldRankingClubKey(key);
    if (!image) continue;
    if (!keyFold.startsWith(folded) && !keyFold.includes(folded)) continue;
    const extract = extractByTitle.get(key);
    if (isRugbyPersonExtract(extract) || /rugby/i.test(key)) return image;
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length || 1) }, () => worker()));
  return out;
}

async function searchWikipediaRugbyPlayerTitle(name: string): Promise<string | null> {
  const payload = await wikiQuery({
    action: "query",
    list: "search",
    srsearch: `${name} rugby union`,
    srlimit: "8",
    srnamespace: "0",
  });
  const hits =
    ((payload.query as { search?: Array<{ title?: string; snippet?: string }> } | undefined)?.search ?? []).filter(
      (hit) => hit.title,
    );
  const folded = foldRankingClubKey(name);
  const rugbyHits = hits.filter((hit) => {
    const title = (hit.title ?? "").toLowerCase();
    const snippet = (hit.snippet ?? "").toLowerCase();
    if (/\b(footballer|soccer player|association football)\b/.test(snippet) && !/\brugby\b/.test(`${title} ${snippet}`)) {
      return false;
    }
    return /\brugby\b/.test(`${title} ${snippet}`);
  });
  const named =
    rugbyHits.find((hit) => {
      const key = foldRankingClubKey(hit.title ?? "");
      return key === folded || key.startsWith(`${folded} `) || key.includes(folded);
    }) ?? rugbyHits[0];
  return named?.title ?? null;
}

export async function fetchWikipediaPlayerHeadshots(
  people: Array<{ name: string; birthYear?: number | null }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [
    ...new Map(
      people
        .map((row) => ({ name: row.name.trim(), birthYear: row.birthYear ?? null }))
        .filter((row) => row.name)
        .map((row) => [row.name.toLowerCase(), row] as const),
    ).values(),
  ];
  const titles = unique.flatMap((row) => wikipediaTitleCandidates(row.name, "player", row.birthYear));
  let { extractByTitle, imageByTitle } = await loadWikiExtractsAndImages(titles);
  for (const row of unique) {
    const image = pickRugbyPlayerImage(row.name, row.birthYear, extractByTitle, imageByTitle);
    if (image) result.set(row.name, image);
  }

  const missing = unique.filter((row) => !result.has(row.name));
  const searchTitles: string[] = [];
  const searchOwner = new Map<string, string>();
  const searchHits = await mapPool(missing, 6, async (row) => ({
    name: row.name,
    title: await searchWikipediaRugbyPlayerTitle(row.name),
  }));
  for (const hit of searchHits) {
    if (!hit.title) continue;
    searchTitles.push(hit.title);
    searchOwner.set(hit.title.toLowerCase(), hit.name);
  }
  if (searchTitles.length) {
    const extra = await loadWikiExtractsAndImages(searchTitles);
    for (const [key, value] of extra.extractByTitle) extractByTitle.set(key, value);
    for (const [key, value] of extra.imageByTitle) imageByTitle.set(key, value);
    for (const title of searchTitles) {
      const name = searchOwner.get(title.toLowerCase());
      if (!name || result.has(name)) continue;
      const image = extra.imageByTitle.get(title) ?? extra.imageByTitle.get(title.toLowerCase());
      const extract = extra.extractByTitle.get(title);
      if (image && (isRugbyPersonExtract(extract) || /rugby/i.test(title))) {
        result.set(name, image);
      }
    }
    for (const row of unique) {
      if (result.has(row.name)) continue;
      const image = pickRugbyPlayerImage(row.name, row.birthYear, extractByTitle, imageByTitle);
      if (image) result.set(row.name, image);
    }
  }
  return result;
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

export async function fetchWikidataLogo(title: string): Promise<string | null> {
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
      { claims?: { P154?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }
    >;
  };
  const entity = Object.values(payload.entities ?? {}).find((item) => item && "claims" in item);
  const file = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
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
