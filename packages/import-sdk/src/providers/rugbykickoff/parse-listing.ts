import type { RugbyKickoffListing, RugbyKickoffListingPreview, RugbyKickoffProvider } from "./types";

const BASE = "https://www.rugbykickoff.com";

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function absoluteUrl(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  const h = href.trim();
  if (h.startsWith("http://") || h.startsWith("https://")) return h;
  return `${BASE}${h.startsWith("/") ? "" : "/"}${h}`;
}

/** Split "Competition - Venue" location line. */
export function parseRugbyKickoffLocation(raw: string): {
  competition: string;
  venue: string | null;
} {
  const text = stripTags(raw);
  if (!text) return { competition: "", venue: null };
  const parts = text.split(/\s+-\s+/);
  if (parts.length < 2) return { competition: text, venue: null };
  const venue = parts[parts.length - 1]!.trim();
  const competition = parts.slice(0, -1).join(" - ").trim();
  return {
    competition: competition || text,
    venue: venue && venue.toUpperCase() !== "TBA" ? venue : null,
  };
}

/**
 * Title is "Home v Away" (home listed first). Strips the visual <span>v</span>.
 */
export function parseRugbyKickoffTitle(titleHtml: string): {
  homeName: string;
  awayName: string;
} | null {
  const text = stripTags(titleHtml.replace(/<span[^>]*>\s*v\s*<\/span>/gi, " v "));
  const m = text.match(/^(.+?)\s+v\s+(.+)$/i);
  if (!m) return null;
  const homeName = m[1]!.trim();
  const awayName = m[2]!.trim();
  if (!homeName || !awayName) return null;
  return { homeName, awayName };
}

/** Extract YYYY-MM-DD + slug from /game/australia_england_2026-11-08/ */
export function parseRugbyKickoffGamePath(href: string): {
  externalId: string;
  kickoffDate: string;
} | null {
  const m = href.match(/\/game\/([a-z0-9_]+_(\d{4}-\d{2}-\d{2}))\/?/i);
  if (!m) return null;
  return { externalId: m[1]!.toLowerCase(), kickoffDate: m[2]! };
}

function parseProviders(block: string): RugbyKickoffProvider[] {
  const pills = [...block.matchAll(/<div class="provider-pill">([\s\S]*?)<\/div>/gi)];
  const out: RugbyKickoffProvider[] = [];
  const seen = new Set<string>();

  for (const pill of pills) {
    const body = pill[1] ?? "";
    const href = body.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? null;
    const alt = body.match(/<img[^>]+alt="([^"]*)"/i)?.[1] ?? null;
    const name = stripTags(alt ?? "") || stripTags(body);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      url: absoluteUrl(href),
      imageAlt: alt ? decodeHtml(alt) : null,
    });
  }
  return out;
}

/**
 * Parse the United Kingdom (default) rugbykickoff.com homepage fixture cards.
 */
export function parseRugbyKickoffListingHtml(
  html: string,
  sourceUrl = `${BASE}/`,
): RugbyKickoffListingPreview {
  const cards = [...html.matchAll(/<article class="fixture-card">([\s\S]*?)<\/article>/gi)];
  const listings: RugbyKickoffListing[] = [];
  const seen = new Set<string>();

  for (const cardMatch of cards) {
    const card = cardMatch[1] ?? "";
    const link = card.match(
      /<a class="fixture-card__link[^"]*"\s+href="(\/game\/[^"]+)"/i,
    );
    if (!link) continue;
    const path = link[1]!;
    const game = parseRugbyKickoffGamePath(path);
    if (!game) continue;

    const titleHtml =
      card.match(/<h3 class="fixture-card__title">([\s\S]*?)<\/h3>/i)?.[1] ?? "";
    const sides = parseRugbyKickoffTitle(titleHtml);
    if (!sides) continue;

    const locationRaw =
      card.match(/<p class="fixture-card__location[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const { competition, venue } = parseRugbyKickoffLocation(locationRaw);
    const kickoffLocalTime =
      card.match(/fixture-card__time-value">\s*([^<]+?)\s*</i)?.[1]?.trim() || null;

    const providersBlock =
      card.match(/<div class="fixture-card__providers">([\s\S]*)$/i)?.[1] ?? "";
    const providers = parseProviders(providersBlock);

    if (seen.has(game.externalId)) continue;
    seen.add(game.externalId);

    listings.push({
      externalId: game.externalId,
      sourceUrl: absoluteUrl(path) ?? `${BASE}${path}`,
      kickoffDate: game.kickoffDate,
      kickoffLocalTime,
      homeName: sides.homeName,
      awayName: sides.awayName,
      competition,
      venue,
      providers,
    });
  }

  return {
    kind: "listing",
    sourceUrl,
    country: "UK",
    listings,
  };
}

/** Heuristic: keep international / national-team competitions for UK TV sync. */
export function isRugbyKickoffInternationalCompetition(competition: string): boolean {
  const c = competition.toLowerCase();
  if (!c.trim()) return false;
  const needles = [
    "6 nations",
    "six nations",
    "nations championship",
    "autumn nations",
    "rugby championship",
    "pacific nations",
    "international",
    "lions",
    "world cup",
    "womens 6",
    "women's 6",
    "women's internationals",
    "womens internationals",
    "summer internationals",
    "autumn internationals",
    "end of year",
  ];
  return needles.some((n) => c.includes(n));
}

export function filterRugbyKickoffInternational(
  listings: RugbyKickoffListing[],
): RugbyKickoffListing[] {
  return listings.filter((row) => isRugbyKickoffInternationalCompetition(row.competition));
}
