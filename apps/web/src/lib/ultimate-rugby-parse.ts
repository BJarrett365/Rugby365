/**
 * Ultimate Rugby HTML scrape + parse helpers.
 * Squad cards: https://www.ultimaterugby.com/{team}/squad
 * Player bio:  https://www.ultimaterugby.com/{slug}
 */

export const ULTIMATE_RUGBY_ORIGIN = "https://www.ultimaterugby.com";
export const ULTIMATE_RUGBY_PROVIDER = "ultimate_rugby";

export type UltimateRugbySquadCard = {
  name: string;
  position: string;
  path: string;
  imagePath: string | null;
  birthDateText: string | null;
  heightM: number | null;
  weightKg: number | null;
  isCoach: boolean;
};

export type UltimateRugbyPlayerProfile = {
  name: string;
  path: string;
  url: string;
  ultimateRugbyPlayerId: string | null;
  externalProviderId: string | null;
  positionName: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  imageUrl: string | null;
  bioSummary: string | null;
  careerStints: UltimateRugbyCareerStint[];
  internationalCaps: number | null;
  internationalTries: number | null;
  internationalPoints: number | null;
};

export type UltimateRugbyCareerStint = {
  teamName: string;
  teamPath: string | null;
  positionName: string | null;
  yearsLabel: string;
  startYear: number | null;
  endYear: number | null;
  careerType: "club" | "international";
  sortOrder: number;
};

export type UltimateRugbyNewsItem = {
  title: string;
  path: string;
  url: string;
  publishedLabel: string | null;
  viewCount: number | null;
  importKey: string;
};

const COACH_ROLE_RE = /\b(head\s+coach|assistant\s+coach|coach|forwards\s+coach|backs\s+coach|defence\s+coach|attack\s+coach|skills\s+coach|kicking\s+coach)\b/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith("//")) return `https:${pathOrUrl}`;
  if (pathOrUrl.startsWith("/")) return `${ULTIMATE_RUGBY_ORIGIN}${pathOrUrl}`;
  return `${ULTIMATE_RUGBY_ORIGIN}/${pathOrUrl}`;
}

export function isCoachRole(position: string): boolean {
  return COACH_ROLE_RE.test(position.trim());
}

export function parseHeightMetresToCm(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (!m) return null;
  const metres = Number(m[1]);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return Math.round(metres * 100);
}

export function parseWeightKg(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (!m) return null;
  const kg = Number(m[1]);
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return Math.round(kg);
}

/** Parse dates like "May 6, 1999" or "6th May 1999" → YYYY-MM-DD (UTC calendar day). */
export function parseUltimateRugbyBirthDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").trim();
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  // 6 May 1999 | May 6, 1999 | 06 May 1999
  const dmy = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  const mdy = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  if (dmy) {
    day = Number(dmy[1]);
    month = months[dmy[2]!.toLowerCase()] ?? null;
    year = Number(dmy[3]);
  } else if (mdy) {
    month = months[mdy[1]!.toLowerCase()] ?? null;
    day = Number(mdy[2]);
    year = Number(mdy[3]);
  }
  if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function ultimateRugbyExternalId(playerId: string): string {
  return `ultimate_rugby:${playerId}`;
}

export function isJunkUltimateRugbyBio(bio: string | null | undefined): boolean {
  const text = bio?.trim() ?? "";
  if (!text) return true;
  if (/^Ultimate Rugby Players/i.test(text)) return true;
  if (/Live Results/i.test(text) && text.length < 120) return true;
  return false;
}

export function slugifyUltimateRugbyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Name → likely Ultimate Rugby profile path candidates. */
export function ultimateRugbySlugCandidates(name: string): string[] {
  const base = slugifyUltimateRugbyName(name);
  if (!base) return [];
  const parts = base.split("-").filter(Boolean);
  const out = new Set<string>([base]);
  if (parts.length >= 3) {
    // "pieter-steph-du-toit" already; also try dropping middle particles carefully
    out.add(`${parts[0]}-${parts.at(-1)}`);
  }
  // Known Springbok / squad slug aliases where UR differs from common name.
  const aliases: Record<string, string[]> = {
    "lood-de-jager": ["lodewyk-de-jager"],
    "siya-kolisi": ["siyamthanda-kolisi"],
    "manie-libbok": ["immanuel-libbok"],
    "andre-esterhuizen": ["andre-esterhuizen"],
    "handre-pollard": ["handre-pollard"],
    "ox-nche": ["ox-nche", "retshegofaditswe-nche"],
    "faf-de-klerk": ["francois-de-klerk"],
    "franco-mostert": ["franco-mostert", "francois-mostert"],
  };
  for (const alt of aliases[base] ?? []) out.add(alt);
  return [...out];
}

export function parseYearsLabel(label: string): {
  yearsLabel: string;
  startYear: number | null;
  endYear: number | null;
} {
  const cleaned = label.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { yearsLabel: "unknown", startYear: null, endYear: null };
  }
  const range = cleaned.match(/^(\d{4})\s*[-–—]\s*(present|\d{4})$/i);
  if (range) {
    const startYear = Number(range[1]);
    const endRaw = range[2]!.toLowerCase();
    const endYear = endRaw === "present" ? null : Number(endRaw);
    return { yearsLabel: cleaned, startYear, endYear };
  }
  const single = cleaned.match(/^(\d{4})$/);
  if (single) {
    const year = Number(single[1]);
    return { yearsLabel: cleaned, startYear: year, endYear: year };
  }
  return { yearsLabel: cleaned, startYear: null, endYear: null };
}

function classifyCareerType(teamName: string, teamPath: string | null): "club" | "international" {
  const name = teamName.toLowerCase();
  const path = (teamPath ?? "").toLowerCase();
  if (
    path.includes("south-africa") ||
    /\bspringboks?\b/.test(name) ||
    /^south africa/.test(name) ||
    /\b7['’]?s\b/.test(name) ||
    /\bsevens\b/.test(name)
  ) {
    return "international";
  }
  return "club";
}

export function parseUltimateRugbyCareerHtml(html: string): UltimateRugbyCareerStint[] {
  const section = html.match(/<h4>\s*Career\s*<\/h4>([\s\S]*?)<\/table>/i)?.[1] ?? "";
  if (!section) return [];
  const rows = [...section.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  const stints: UltimateRugbyCareerStint[] = [];
  let sortOrder = 0;
  for (const rowMatch of rows) {
    const row = rowMatch[1] ?? "";
    const teamPath = row.match(/<a[^>]+href="(\/[^"]+)"/i)?.[1] ?? null;
    const teamName = decodeHtml(row.match(/<b>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/b>/i)?.[1] ?? "");
    if (!teamName) continue;
    const positionName = decodeHtml(row.match(/text-muted">([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;
    const yearCell = decodeHtml(
      [...row.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((m) => m[1] ?? "").at(-1) ?? "",
    );
    const years = parseYearsLabel(yearCell);
    stints.push({
      teamName,
      teamPath,
      positionName,
      yearsLabel: years.yearsLabel,
      startYear: years.startYear,
      endYear: years.endYear,
      careerType: classifyCareerType(teamName, teamPath),
      sortOrder: sortOrder++,
    });
  }
  return stints;
}

/** Pull Springbok caps / tries / points from free-text bio when UR has no structured stats. */
export function parseInternationalTotalsFromBio(bio: string | null | undefined): {
  caps: number | null;
  tries: number | null;
  points: number | null;
} {
  const text = bio ?? "";
  if (!text) return { caps: null, tries: null, points: null };

  const capsMatch =
    text.match(
      /(\d{1,3})\s*(?:test\s+)?caps?(?:\s+for\s+(?:the\s+)?(?:springboks?|south africa))?/i,
    ) || text.match(/amassed\s+(\d{1,3})\s+test\s+caps/i);
  const triesMatch =
    text.match(/scoring\s+(\d{1,3})\s+tries/i) ||
    text.match(/(\d{1,3})\s+tries\s*\(/i) ||
    text.match(/scored\s+(\d{1,3})\s+tries/i);
  const pointsMatch = text.match(/(\d{1,4})\s+points/i);

  const caps = capsMatch ? Number(capsMatch[1]) : null;
  const tries = triesMatch ? Number(triesMatch[1]) : null;
  const points = pointsMatch ? Number(pointsMatch[1]) : null;
  return {
    caps: caps != null && caps > 0 && caps < 200 ? caps : null,
    tries: tries != null && tries > 0 && tries < 200 ? tries : null,
    points: points != null && points > 0 && points < 2000 ? points : null,
  };
}

export function parseUltimateRugbyNewsHtml(html: string, playerPath: string): UltimateRugbyNewsItem[] {
  const main =
    html.match(/<div class="col-md-8">([\s\S]*?)(?:<div class="col-md-4">|<aside)/i)?.[1] ?? html;
  const items: UltimateRugbyNewsItem[] = [];
  const seen = new Set<string>();

  for (const block of main.matchAll(/<div class="media">([\s\S]*?)<\/div>\s*<\/div>/gi)) {
    const chunk = block[1] ?? "";
    const href =
      chunk.match(/href="((?:\/app\/public\/index\.php)?\/news\/[^"]+)"/i)?.[1] ??
      chunk.match(/href="(\/news\/[^"]+)"/i)?.[1] ??
      null;
    if (!href) continue;
    const title = decodeHtml(chunk.match(/media-heading">\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    if (!title || title.length < 8) continue;
    const publishedLabel =
      decodeHtml(chunk.match(/detail text-muted">\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;
    const viewsRaw = chunk.match(/fa-eye"><\/i>\s*(\d+)/i)?.[1];
    const viewCount = viewsRaw ? Number(viewsRaw) : null;
    const path = href.replace(/^\/app\/public\/index\.php/, "");
    const idMatch = path.match(/\/(\d+)\s*$/);
    const importKey = `ultimate_rugby:news:${idMatch?.[1] ?? slugifyUltimateRugbyName(title)}`;
    if (seen.has(importKey)) continue;
    seen.add(importKey);
    items.push({
      title,
      path,
      url: absoluteUrl(path)!,
      publishedLabel,
      viewCount: Number.isFinite(viewCount) ? viewCount : null,
      importKey,
    });
  }

  // Fallback: heading links only
  if (!items.length) {
    for (const m of main.matchAll(/href="((?:\/app\/public\/index\.php)?\/news\/[^"]+)"[^>]*>\s*([^<]{8,140})/gi)) {
      const href = m[1]!.replace(/^\/app\/public\/index\.php/, "");
      const title = decodeHtml(m[2] ?? "");
      const idMatch = href.match(/\/(\d+)\s*$/);
      const importKey = `ultimate_rugby:news:${idMatch?.[1] ?? slugifyUltimateRugbyName(title)}`;
      if (seen.has(importKey) || !title) continue;
      seen.add(importKey);
      items.push({
        title,
        path: href,
        url: absoluteUrl(href)!,
        publishedLabel: null,
        viewCount: null,
        importKey,
      });
    }
  }

  void playerPath;
  return items.slice(0, 40);
}

export function isUltimateRugbyPlayerHtml(html: string): boolean {
  if (/ultimaterugby:\/\/player\/\d+/i.test(html)) return true;
  if (/data-toggle="favourtes"[^>]*data-type="1"/i.test(html)) return true;
  if (/class="profile-detail"/i.test(html) && /itemprop="name"/i.test(html)) return true;
  return false;
}

export function parseUltimateRugbySquadHtml(html: string): UltimateRugbySquadCard[] {
  const blocks = html.match(/<div class="flip-container">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) ?? [];
  const cards: UltimateRugbySquadCard[] = [];

  for (const block of blocks) {
    const nameMatch = block.match(/<h4>([\s\S]*?)<\/h4>/i);
    if (!nameMatch) continue;
    const name = decodeHtml(nameMatch[1]!.replace(/<br\s*\/?>/gi, " "));
    if (!name) continue;

    const position = decodeHtml(block.match(/<b>([\s\S]*?)<\/b>/i)?.[1] ?? "");
    const path = block.match(/href="(\/[^"]+)"/i)?.[1] ?? null;
    if (!path) continue;
    const imagePath = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
    const facts = [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => decodeHtml(m[1] ?? ""));

    let birthDateText: string | null = null;
    let heightM: number | null = null;
    let weightKg: number | null = null;
    for (const fact of facts) {
      if (/\d{4}/.test(fact) && /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(fact)) {
        birthDateText = fact;
      } else if (/\dm\b/i.test(fact)) {
        heightM = Number(fact.match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN);
        if (!Number.isFinite(heightM)) heightM = null;
      } else if (/kg\b/i.test(fact)) {
        weightKg = parseWeightKg(fact);
      }
    }

    cards.push({
      name,
      position,
      path,
      imagePath,
      birthDateText,
      heightM,
      weightKg,
      isCoach: isCoachRole(position),
    });
  }

  return cards;
}

export function parseUltimateRugbyPlayerHtml(html: string, path: string): UltimateRugbyPlayerProfile {
  const url = absoluteUrl(path)!;
  const h1Raw = html.match(/itemprop="name">([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const title =
    decodeHtml(html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ?? "") ||
    decodeHtml(h1Raw.replace(/<span[\s\S]*$/i, "")) ||
    decodeHtml(path.replace(/^\//, "").replace(/-/g, " "));

  const detailBlock =
    html.match(/class="profile-detail"[\s\S]*?<div class="detail">([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<div class="detail">([\s\S]*?)<\/div>/i)?.[1] ??
    "";
  const detailSpans = [...detailBlock.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) =>
    decodeHtml(m[1] ?? ""),
  );

  let birthDate: string | null = null;
  let heightCm: number | null = null;
  let weightKg: number | null = null;
  let positionName: string | null = null;

  for (const span of detailSpans) {
    if (/\d{4}/.test(span) && /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(span)) {
      birthDate = parseUltimateRugbyBirthDate(span) ?? birthDate;
    } else if (/\d+(?:\.\d+)?m\s*\/\s*\d+/i.test(span)) {
      heightCm = parseHeightMetresToCm(span) ?? heightCm;
      weightKg = parseWeightKg(span) ?? weightKg;
    } else if (/itemprop="title"/i.test(detailBlock) && span) {
      // Prefer the title span when present; otherwise last non-metric span wins below.
      positionName = span;
    } else if (span && !/share|facebook|twitter/i.test(span) && !positionName) {
      positionName = span;
    }
  }
  const titledPosition = decodeHtml(
    detailBlock.match(/itemprop="title">([\s\S]*?)<\/span>/i)?.[1] ?? "",
  );
  if (titledPosition) positionName = titledPosition;

  const ogImage = absoluteUrl(html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ?? null);
  const profileImage = absoluteUrl(
    html.match(/itemprop="image"[^>]+src="([^"]+)"/i)?.[1] ??
      html.match(/class="profile-photo"[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ??
      null,
  );

  const playerId =
    html.match(/ultimaterugby:\/\/player\/(\d+)/i)?.[1] ??
    html.match(/data-toggle="favourtes"[^>]*data-id="(\d+)"/i)?.[1] ??
    html.match(/data-id="(\d+)"/i)?.[1] ??
    null;

  const ogDesc = decodeHtml(html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ?? "");
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeHtml((m[1] ?? "").replace(/<br\s*\/?>/gi, "\n")))
    .map((p) => p.replace(/\n{3,}/g, "\n\n").trim())
    .filter((p) => p.length > 80);
  const nameLower = title.toLowerCase();
  const nameToken = title.split(/\s+/)[0]?.toLowerCase() ?? "";
  const bioCandidates = paragraphs.filter(
    (p) =>
      p.toLowerCase().includes(nameLower) ||
      (nameToken.length > 2 && p.toLowerCase().includes(nameToken) && /born|rugby|springbok/i.test(p)),
  );
  const bioFromParagraph =
    bioCandidates.sort((a, b) => b.length - a.length)[0] ??
    paragraphs.find((p) => /born on|is a .+ rugby/i.test(p)) ??
    null;
  const bioSummaryRaw =
    bioFromParagraph ||
    (ogDesc && !/[…\u2026]$/.test(ogDesc) ? ogDesc : null) ||
    (ogDesc || null);
  const bioSummary = isJunkUltimateRugbyBio(bioSummaryRaw) ? bioFromParagraph : bioSummaryRaw;
  const cleanBio = isJunkUltimateRugbyBio(bioSummary) ? null : bioSummary;

  const careerStints = parseUltimateRugbyCareerHtml(html);
  const totals = parseInternationalTotalsFromBio(cleanBio);

  return {
    name: title,
    path,
    url,
    ultimateRugbyPlayerId: playerId,
    externalProviderId: playerId ? ultimateRugbyExternalId(playerId) : null,
    positionName,
    birthDate,
    heightCm,
    weightKg,
    imageUrl: profileImage ?? ogImage,
    bioSummary: cleanBio,
    careerStints,
    internationalCaps: totals.caps,
    internationalTries: totals.tries,
    internationalPoints: totals.points,
  };
}

export async function fetchUltimateRugbyHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (+https://rugby365.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Ultimate Rugby fetch failed (${res.status}) for ${url}`);
  return res.text();
}

export function squadCardToSeedProfile(card: UltimateRugbySquadCard): UltimateRugbyPlayerProfile {
  return {
    name: card.name,
    path: card.path,
    url: absoluteUrl(card.path)!,
    ultimateRugbyPlayerId: null,
    externalProviderId: null,
    positionName: card.position || null,
    birthDate: parseUltimateRugbyBirthDate(card.birthDateText),
    heightCm: card.heightM != null ? Math.round(card.heightM * 100) : null,
    weightKg: card.weightKg,
    imageUrl: absoluteUrl(card.imagePath),
    bioSummary: null,
    careerStints: [],
    internationalCaps: null,
    internationalTries: null,
    internationalPoints: null,
  };
}

export async function fetchUltimateRugbyPlayerByName(
  name: string,
): Promise<UltimateRugbyPlayerProfile | null> {
  for (const slug of ultimateRugbySlugCandidates(name)) {
    const path = `/${slug}`;
    try {
      const html = await fetchUltimateRugbyHtml(absoluteUrl(path)!);
      if (!isUltimateRugbyPlayerHtml(html)) continue;
      const profile = parseUltimateRugbyPlayerHtml(html, path);
      if (!profile.ultimateRugbyPlayerId && !profile.careerStints.length && !profile.bioSummary) {
        continue;
      }
      // Reject soft-404 style pages titled "Ultimate Rugby"
      if (/^ultimate rugby$/i.test(profile.name.trim())) continue;
      return profile;
    } catch {
      // try next slug
    }
  }
  return null;
}
