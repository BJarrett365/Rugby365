import { normalizeWikipediaTitle, parseWikipediaArticleUrl, wikipediaArticleUrl } from "../parse-url";
import type { WikipediaSeasonFetchResult } from "./types";

const USER_AGENT = "Rugby365SeasonImport/1.0 (historical rugby season data import)";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWikipediaSeasonPage(input: string): Promise<WikipediaSeasonFetchResult> {
  const title = normalizeWikipediaTitle(input);
  const project = input.includes("wikipedia.org")
    ? parseWikipediaArticleUrl(input).projectId
    : "enwiki";
  const lang = project.replace(/wiki$/, "") || "en";

  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "wikitext|revid|sections|displaytitle",
    format: "json",
    redirects: "1",
    formatversion: "2",
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(1500 * 2 ** (attempt - 1));
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Wikipedia API failed (${res.status}) for ${title}`);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Wikipedia API failed (${res.status}) for ${title}`);
    }

    const payload = (await res.json()) as {
      error?: { info?: string; code?: string };
      parse?: {
        title?: string;
        revid?: number;
        wikitext?: string | { "*": string };
        sections?: Array<{ index: string; line: string; toclevel: number }>;
      };
    };

    if (payload.error?.code === "ratelimited" || /rate/i.test(payload.error?.info ?? "")) {
      lastError = new Error(payload.error?.info ?? "rate limited");
      continue;
    }
    if (payload.error?.info) throw new Error(payload.error.info);
    if (!payload.parse) throw new Error(`No parse result for ${title}`);

    const pageTitle = payload.parse.title ?? title;
    const wikitextRaw = payload.parse.wikitext;
    const wikitext = typeof wikitextRaw === "string" ? wikitextRaw : (wikitextRaw?.["*"] ?? "");

    return {
      pageTitle,
      wikipediaUrl: wikipediaArticleUrl(pageTitle, lang),
      revisionId: payload.parse.revid ?? null,
      wikitext,
      sections: (payload.parse.sections ?? []).map((s) => ({
        index: s.index,
        line: s.line,
        level: s.toclevel,
      })),
    };
  }

  throw lastError ?? new Error(`Wikipedia API failed for ${title}`);
}

export async function fetchWikipediaSectionWikitext(
  input: string,
  sectionIndex: string,
): Promise<string> {
  const title = normalizeWikipediaTitle(input);
  const project = input.includes("wikipedia.org")
    ? parseWikipediaArticleUrl(input).projectId
    : "enwiki";
  const lang = project.replace(/wiki$/, "") || "en";

  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "wikitext",
    section: sectionIndex,
    format: "json",
    redirects: "1",
    formatversion: "2",
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(1500 * 2 ** (attempt - 1));
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Wikipedia section API failed (${res.status})`);
      continue;
    }
    if (!res.ok) throw new Error(`Wikipedia section API failed (${res.status})`);

    const payload = (await res.json()) as {
      error?: { info?: string; code?: string };
      parse?: { wikitext?: string | { "*": string } };
    };
    if (payload.error?.code === "ratelimited") {
      lastError = new Error(payload.error?.info ?? "rate limited");
      continue;
    }
    if (payload.error?.info) throw new Error(payload.error.info);
    const raw = payload.parse?.wikitext;
    return typeof raw === "string" ? raw : (raw?.["*"] ?? "");
  }

  throw lastError ?? new Error("Wikipedia section API failed");
}

export async function fetchWikipediaTeamsSection(
  page: WikipediaSeasonFetchResult,
): Promise<string> {
  const teamsIdx =
    page.sections.find((s) => /^teams$/i.test(s.line.trim()))?.index ??
    page.sections.find((s) => /participating teams/i.test(s.line))?.index ??
    page.sections.find((s) => /\bteams\b/i.test(s.line) && !/pre.?season/i.test(s.line))?.index;
  if (!teamsIdx) return "";

  let wikitext = await fetchWikipediaSectionWikitext(page.wikipediaUrl, teamsIdx);
  if (!/\{\|[\s\S]*?wikitable/i.test(wikitext)) {
    const stadiumIdx = page.sections.find((s) => /stadiums and locations/i.test(s.line))?.index;
    if (stadiumIdx) {
      const extra = await fetchWikipediaSectionWikitext(page.wikipediaUrl, stadiumIdx);
      wikitext = `${wikitext}\n${extra}`;
    }
  }
  return wikitext;
}
