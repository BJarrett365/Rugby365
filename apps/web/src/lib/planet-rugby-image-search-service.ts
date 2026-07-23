/**
 * Discover Planet Rugby-hosted player images from PR article/tag pages.
 * Google/DuckDuckGo used only as a discovery aid for planetrugby.com URLs.
 */

import {
  canonicalizePlanetRugbyImageUrl,
  isAllowedPlanetRugbyImageUrl,
  slugifyPlayerNameForTag,
  unwrapPlanetRugbyImageUrl,
} from "./planet-rugby-image-utils";
import {
  scorePlanetRugbyImageMatch,
  type PlayerImageMatchContext,
  type PlanetRugbyImageMatchScore,
} from "./planet-rugby-image-match";
import type { ApprovedImageLearningRule } from "./player-image-rejection-learning";

export type DiscoveredPlanetRugbyImage = {
  imageUrl: string;
  canonicalUrl: string;
  sourcePageUrl: string | null;
  sourceArticleTitle: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  match: PlanetRugbyImageMatchScore;
};

const USER_AGENT =
  "Rugby365CMS/1.0 (+https://rugby365; Planet Rugby image enrichment; editorial tool)";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const m = html.match(re) ?? html.match(re2);
  return m?.[1] ? decodeHtml(m[1]) : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtml(m[1]).trim() : null;
}

function extractBodySnippet(html: string): string {
  const article =
    html.match(/<div[^>]*class="[^"]*ciam-article[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    "";
  return decodeHtml(article.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 2500);
}

type ParsedImage = {
  imageUrl: string;
  altText: string | null;
  caption: string | null;
};

function isThemeOrChromeAsset(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("/content/themes/") ||
    lower.includes("/img/png/logo") ||
    lower.includes("/img/svg/") ||
    lower.includes("favicon") ||
    lower.endsWith(".svg")
  );
}

function extractImagesFromArticleHtml(html: string): ParsedImage[] {
  const out: ParsedImage[] = [];
  const seen = new Set<string>();

  const og = extractMeta(html, "og:image");
  if (og && isAllowedPlanetRugbyImageUrl(og) && !isThemeOrChromeAsset(og)) {
    const canonical = canonicalizePlanetRugbyImageUrl(og);
    seen.add(canonical);
    out.push({ imageUrl: unwrapPlanetRugbyImageUrl(og), altText: null, caption: null });
  }

  const imgRe = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(html))) {
    const tag = match[0];
    const src =
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ??
      null;
    if (!src || !isAllowedPlanetRugbyImageUrl(src) || isThemeOrChromeAsset(src)) continue;
    // Skip tiny theme assets / related-story thumbs under 400px wide when sized in filename
    if (/-\d{2,3}x\d{2,3}\.(jpe?g|png|webp)$/i.test(src) && !/1320x|1200x|1600x/i.test(src)) {
      // keep if it's the only hit for this canonical later
    }
    const canonical = canonicalizePlanetRugbyImageUrl(src);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? null;
    out.push({
      imageUrl: unwrapPlanetRugbyImageUrl(src),
      altText: alt ? decodeHtml(alt) : null,
      caption: null,
    });
  }

  // figcaption near images (best-effort)
  const figRe =
    /<figure[\s\S]*?<img\b[^>]*src=["']([^"']+)["'][^>]*>([\s\S]*?)<\/figure>/gi;
  let fig: RegExpExecArray | null;
  while ((fig = figRe.exec(html))) {
    const src = fig[1]!;
    if (!isAllowedPlanetRugbyImageUrl(src)) continue;
    const block = fig[2] ?? "";
    const caption =
      block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ??
      block.match(/credit[^<]*>([\s\S]*?)</i)?.[1] ??
      null;
    const canonical = canonicalizePlanetRugbyImageUrl(src);
    const existing = out.find((row) => canonicalizePlanetRugbyImageUrl(row.imageUrl) === canonical);
    if (existing && caption) {
      existing.caption = decodeHtml(caption.replace(/<[^>]+>/g, " ")).trim();
    }
  }

  return out;
}

function extractPlanetRugbyLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /https?:\/\/(?:www\.)?planetrugby\.com\/(?:news|tag|player|matches)\/[a-z0-9\-/%]+/gi;
  for (const m of html.matchAll(re)) {
    const url = m[0]!.replace(/\/$/, "").split("#")[0]!;
    if (!url.includes("/tag/") && !url.includes("/news/") && !url.includes("/player/") && !url.includes("/matches/")) {
      continue;
    }
    links.add(url);
  }
  // relative
  for (const m of html.matchAll(/href=["'](\/(?:news|tag|player|matches)\/[^"'#?]+)/gi)) {
    links.add(`https://www.planetrugby.com${m[1]}`);
  }
  return [...links];
}

async function discoverArticleUrls(playerName: string): Promise<string[]> {
  const urls = new Set<string>();
  const tagSlug = slugifyPlayerNameForTag(playerName);
  if (tagSlug) {
    urls.add(`https://www.planetrugby.com/tag/${tagSlug}`);
  }

  const query = encodeURIComponent(`site:planetrugby.com "${playerName}"`);
  const ddg = await fetchHtml(`https://html.duckduckgo.com/html/?q=${query}`);
  if (ddg) {
    for (const m of ddg.matchAll(/uddg=([^&"]+)/g)) {
      try {
        const decoded = decodeURIComponent(m[1]!);
        if (decoded.includes("planetrugby.com")) {
          const clean = decoded.split("&")[0]!.split("#")[0]!;
          if (/planetrugby\.com\/(news|tag|player|matches)\//i.test(clean)) {
            urls.add(clean);
          }
        }
      } catch {
        /* ignore */
      }
    }
    for (const link of extractPlanetRugbyLinks(ddg)) {
      urls.add(link);
    }
  }

  return [...urls].slice(0, 12);
}

export async function searchPlanetRugbyPlayerImages(input: {
  playerName: string;
  aliases?: string[];
  clubName?: string | null;
  internationalTeamName?: string | null;
  previousClubs?: string[];
  maxArticles?: number;
  playerId?: string | null;
  learningRules?: ApprovedImageLearningRule[];
}): Promise<{
  candidates: DiscoveredPlanetRugbyImage[];
  searchedPages: string[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const searchedPages: string[] = [];
  const ctx: PlayerImageMatchContext = {
    playerName: input.playerName,
    aliases: input.aliases,
    clubName: input.clubName,
    internationalTeamName: input.internationalTeamName,
    previousClubs: input.previousClubs,
  };

  const articleUrls = await discoverArticleUrls(input.playerName);
  if (!articleUrls.length) {
    warnings.push("No Planet Rugby article or tag pages discovered for this player name.");
  }

  const byCanonical = new Map<string, DiscoveredPlanetRugbyImage>();
  const maxArticles = input.maxArticles ?? 8;
  let parsed = 0;

  for (const pageUrl of articleUrls) {
    if (parsed >= maxArticles) break;
    const html = await fetchHtml(pageUrl);
    searchedPages.push(pageUrl);
    if (!html) {
      warnings.push(`Could not fetch ${pageUrl}`);
      continue;
    }

    // Tag/listing pages: collect deeper news links first
    if (pageUrl.includes("/tag/")) {
      for (const link of extractPlanetRugbyLinks(html).filter((u) => u.includes("/news/"))) {
        if (!articleUrls.includes(link)) articleUrls.push(link);
      }
      parsed += 1;
      continue;
    }

    parsed += 1;
    const title = extractTitle(html);
    const body = extractBodySnippet(html);
    const images = extractImagesFromArticleHtml(html);

    for (const image of images) {
      if (!isAllowedPlanetRugbyImageUrl(image.imageUrl)) continue;
      const canonicalUrl = canonicalizePlanetRugbyImageUrl(image.imageUrl);
      const match = scorePlanetRugbyImageMatch(
        {
          imageUrl: image.imageUrl,
          altText: image.altText,
          caption: image.caption,
          articleTitle: title,
          articleBodySnippet: body,
          sourcePageUrl: pageUrl,
        },
        ctx,
        { playerId: input.playerId, learningRules: input.learningRules },
      );

      // Drop unrelated sidebar images with no name signal at all
      if (match.score < 15 && !match.nameInAltOrCaption) continue;

      const existing = byCanonical.get(canonicalUrl);
      if (!existing || match.score > existing.match.score) {
        byCanonical.set(canonicalUrl, {
          imageUrl: image.imageUrl,
          canonicalUrl,
          sourcePageUrl: pageUrl,
          sourceArticleTitle: title,
          altText: image.altText,
          caption: image.caption,
          credit: image.caption,
          match,
        });
      }
    }
  }

  const candidates = [...byCanonical.values()].sort(
    (a, b) => b.match.score - a.match.score || a.match.level.localeCompare(b.match.level),
  );

  if (!candidates.length && articleUrls.length) {
    warnings.push(
      "Planet Rugby pages were found, but no strongly attributable player images were extracted.",
    );
  }

  return { candidates, searchedPages, warnings };
}
