/**
 * Fetch player bio + social properties from Wikidata (public EntityData API).
 * Used as fill-missing fallback when Wikipedia infobox fields are empty.
 *
 * P569 birth date · P19 place of birth · P2048 height · P2067 mass
 * P2002 Twitter/X · P2003 Instagram · P2013 Facebook · P856 website
 */

import {
  buildMediaWikiHeaders,
  resolveMediaWikiUserAgent,
  type MediaWikiRequestOptions,
} from "./mediawiki-request";

export type WikidataPlayerProfile = {
  birthDate?: string;
  birthPlace?: string;
  heightCm?: number;
  weightKg?: number;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
};

const DEFAULT_WD_UA = "Rugby365CMS/1.0 (player-profile-gap-fill; contact=local-dev)";

function claimSnaks(entity: unknown, property: string): Array<{ datavalue?: { value?: unknown; type?: string } }> {
  const claims = (entity as { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown; type?: string } } }>> })
    ?.claims?.[property];
  if (!claims?.length) return [];
  return claims.map((c) => c.mainsnak ?? {}).filter(Boolean);
}

function claimStringValue(entity: unknown, property: string): string | undefined {
  for (const snak of claimSnaks(entity, property)) {
    const value = snak.datavalue?.value;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
      return (value as { id: string }).id.trim();
    }
  }
  return undefined;
}

function claimTimeValue(entity: unknown, property: string): string | undefined {
  for (const snak of claimSnaks(entity, property)) {
    const value = snak.datavalue?.value;
    if (!value || typeof value !== "object") continue;
    const time = (value as { time?: string }).time;
    if (!time || typeof time !== "string") continue;
    // +1990-02-26T00:00:00Z
    const m = time.match(/([+-]?)(\d{4})-(\d{2})-(\d{2})/);
    if (!m) continue;
    const year = Number(m[2]);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) continue;
    return `${m[2]}-${m[3]}-${m[4]}`;
  }
  return undefined;
}

function claimQuantityToNumber(entity: unknown, property: string): number | undefined {
  for (const snak of claimSnaks(entity, property)) {
    const value = snak.datavalue?.value;
    if (!value || typeof value !== "object") continue;
    const amount = (value as { amount?: string }).amount;
    if (!amount) continue;
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = String((value as { unit?: string }).unit ?? "");
    // height often in metres (Q11573); mass in kg (Q11570) or g
    if (property === "P2048") {
      if (unit.includes("Q11573") || n < 3) return Math.round(n * 100); // metres → cm
      return Math.round(n); // already cm
    }
    if (property === "P2067") {
      if (unit.includes("Q41803") || n > 400) return Math.round(n / 1000); // g → kg
      return Math.round(n);
    }
    return Math.round(n);
  }
  return undefined;
}

function toTwitterUrl(handle: string): string {
  const cleaned = handle.replace(/^@/, "").trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://x.com/${cleaned}`;
}

function toInstagramUrl(handle: string): string {
  const cleaned = handle.replace(/^@/, "").trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://www.instagram.com/${cleaned}/`;
}

function toFacebookUrl(idOrUrl: string): string {
  const cleaned = idOrUrl.trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://www.facebook.com/${cleaned}`;
}

/** Normalize Q-ids (Q123) or bare numbers. */
export function normalizeWikidataId(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  const trimmed = id.trim();
  if (/^Q\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^\d+$/.test(trimmed)) return `Q${trimmed}`;
  return null;
}

async function fetchEntityLabel(
  qid: string,
  signal: AbortSignal,
  options?: MediaWikiRequestOptions,
): Promise<string | undefined> {
  try {
    const userAgent = resolveMediaWikiUserAgent(options, "WIKIDATA_USER_AGENT", DEFAULT_WD_UA);
    const accessToken = options?.accessToken ?? process.env.WIKIDATA_ACCESS_TOKEN ?? null;
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
    const res = await fetch(url, {
      headers: buildMediaWikiHeaders(userAgent, accessToken, { Accept: "application/json" }),
      signal,
    });
    if (!res.ok) return undefined;
    const payload = (await res.json()) as {
      entities?: Record<string, { labels?: Record<string, { value?: string }> }>;
    };
    const entity = payload.entities?.[qid] ?? Object.values(payload.entities ?? {})[0];
    return entity?.labels?.en?.value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch bio + social fields for a Wikidata entity. Safe no-op on network/API failure.
 */
export async function fetchWikidataPlayerProfile(
  wikidataId: string,
  options?: MediaWikiRequestOptions & { timeoutMs?: number },
): Promise<WikidataPlayerProfile> {
  const id = normalizeWikidataId(wikidataId);
  if (!id) return {};

  const timeoutMs = options?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const userAgent = resolveMediaWikiUserAgent(options, "WIKIDATA_USER_AGENT", DEFAULT_WD_UA);
  const accessToken = options?.accessToken ?? process.env.WIKIDATA_ACCESS_TOKEN ?? null;

  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
    const res = await fetch(url, {
      headers: buildMediaWikiHeaders(userAgent, accessToken, { Accept: "application/json" }),
      signal: controller.signal,
    });
    if (!res.ok) return {};
    const payload = (await res.json()) as { entities?: Record<string, unknown> };
    const entity = payload.entities?.[id] ?? Object.values(payload.entities ?? {})[0];
    if (!entity) return {};

    const out: WikidataPlayerProfile = {};
    const birthDate = claimTimeValue(entity, "P569");
    if (birthDate) out.birthDate = birthDate;

    const placeId = claimStringValue(entity, "P19");
    if (placeId && /^Q\d+$/i.test(placeId)) {
      const label = await fetchEntityLabel(placeId.toUpperCase(), controller.signal, options);
      if (label) out.birthPlace = label;
    }

    const heightCm = claimQuantityToNumber(entity, "P2048");
    if (heightCm != null) out.heightCm = heightCm;
    const weightKg = claimQuantityToNumber(entity, "P2067");
    if (weightKg != null) out.weightKg = weightKg;

    const twitter = claimStringValue(entity, "P2002");
    if (twitter) out.twitter = toTwitterUrl(twitter);
    const instagram = claimStringValue(entity, "P2003");
    if (instagram) out.instagram = toInstagramUrl(instagram);
    const facebook = claimStringValue(entity, "P2013");
    if (facebook) out.facebook = toFacebookUrl(facebook);
    const website = claimStringValue(entity, "P856");
    if (website && /^https?:\/\//i.test(website)) out.website = website;
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Prefer fetchWikidataPlayerProfile */
export async function fetchWikidataSocialAccounts(
  wikidataId: string,
  options?: MediaWikiRequestOptions & { timeoutMs?: number },
): Promise<Pick<WikidataPlayerProfile, "twitter" | "instagram" | "facebook" | "website">> {
  const profile = await fetchWikidataPlayerProfile(wikidataId, options);
  return {
    twitter: profile.twitter,
    instagram: profile.instagram,
    facebook: profile.facebook,
    website: profile.website,
  };
}
