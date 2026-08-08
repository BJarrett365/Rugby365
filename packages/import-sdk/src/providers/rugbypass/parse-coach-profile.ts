export type RugbyPassCoachProfile = {
  slug: string;
  sourceUrl: string;
  displayName: string;
  bioSummary: string | null;
  roleTitle: string | null;
  currentTeam: string | null;
  nationalityHint: string | null;
  imageUrl: string | null;
};

const RUGBYPASS_COACH_URL_RE =
  /(?:https?:\/\/(?:www\.)?rugbypass\.com)?\/coaches\/([a-z0-9-]+)\/?/i;

export function parseRugbyPassCoachSlug(urlOrSlug: string): string | null {
  const trimmed = urlOrSlug.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(RUGBYPASS_COACH_URL_RE)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function rugbyPassCoachUrl(slug: string): string {
  return `https://www.rugbypass.com/coaches/${slug}/`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtmlEntities(m2[1]) : null;
}

function parseDisplayName(html: string, slug: string): string | null {
  const ogTitle = metaContent(html, "og:title");
  if (ogTitle) {
    const beforePipe = ogTitle.split("|")[0]?.trim();
    if (beforePipe) return beforePipe;
  }
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1];
  if (h1) {
    const text = stripTags(h1).replace(/\s+Bio$/i, "").trim();
    if (text) return text;
  }
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function parseBioSummary(html: string): string | null {
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  if (!h1Match || h1Match.index == null) return null;
  const after = html.slice(h1Match.index + h1Match[0].length);
  const section = after.match(/^([\s\S]*?)(?=<h2\b|<section\b|<div[^>]+class="[^"]*related)/i)?.[1] ?? after.slice(0, 6000);
  const paragraphs = [...section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1] ?? ""))
    .filter((p) => p.length > 40);
  if (!paragraphs.length) return null;
  const combined = paragraphs.slice(0, 3).join(" ").replace(/\s+/g, " ").trim();
  return combined.slice(0, 2000) || null;
}

function parseRoleAndTeam(description: string | null): {
  roleTitle: string | null;
  currentTeam: string | null;
  nationalityHint: string | null;
} {
  if (!description) return { roleTitle: null, currentTeam: null, nationalityHint: null };

  const roleMatch = description.match(
    /\b(?:is|as)\s+(?:the\s+)?((?:Director of Rugby|Head Coach|Assistant Coach|Attack Coach|Defence Coach|Forwards Coach|Backs Coach|Interim Head Coach)[^.]{0,80}?)\s+of\s+(?:the\s+)?([^,.]+)/i,
  );
  if (roleMatch) {
    const roleTitle = roleMatch[1]?.trim() || null;
    const currentTeam = roleMatch[2]?.trim().replace(/\s+national team$/i, "").trim() || null;
    const nationalityHint = currentTeam?.includes("South African")
      ? "South Africa"
      : currentTeam;
    return { roleTitle, currentTeam, nationalityHint };
  }

  const ofMatch = description.match(
    /\b((?:Director of Rugby|Head Coach)[^.]{0,60}?)\s+of\s+(?:the\s+)?([^,.]+)/i,
  );
  if (ofMatch) {
    return {
      roleTitle: ofMatch[1]?.trim() || null,
      currentTeam: ofMatch[2]?.trim() || null,
      nationalityHint: null,
    };
  }

  return { roleTitle: null, currentTeam: null, nationalityHint: null };
}

function parsePortraitImage(html: string): string | null {
  const og = metaContent(html, "og:image");
  if (og && !/\/og\/meta\//i.test(og) && !/rp-logo/i.test(og)) {
    return og;
  }

  const candidates = [
    ...html.matchAll(
      /https:\/\/eu-cdn\.rugbypass\.com\/[^"'\s>]+\.(?:jpg|jpeg|png|webp)/gi,
    ),
  ].map((m) => m[0]);

  for (const url of candidates) {
    if (/\/(?:team-images|competitions|mega-menu|og\/meta|players\/head)\//i.test(url)) continue;
    if (/wp-content\/uploads/i.test(url) && /erasmus|coach/i.test(url)) return url.split("?")[0]!;
  }
  return null;
}

export function parseRugbyPassCoachProfile(
  html: string,
  sourceUrl?: string,
): RugbyPassCoachProfile | null {
  const slugFromUrl = sourceUrl ? parseRugbyPassCoachSlug(sourceUrl) : null;
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  const slug =
    slugFromUrl ?? (canonical ? parseRugbyPassCoachSlug(canonical) : null) ?? null;
  if (!slug) return null;

  const displayName = parseDisplayName(html, slug);
  if (!displayName) return null;

  const description = metaContent(html, "og:description") ?? metaContent(html, "description");
  const { roleTitle, currentTeam, nationalityHint } = parseRoleAndTeam(description);
  const bioSummary = parseBioSummary(html);
  const resolvedUrl =
    sourceUrl?.trim() ||
    (canonical ? decodeHtmlEntities(canonical) : rugbyPassCoachUrl(slug));

  return {
    slug,
    sourceUrl: resolvedUrl,
    displayName,
    bioSummary,
    roleTitle,
    currentTeam,
    nationalityHint,
    imageUrl: parsePortraitImage(html),
  };
}
