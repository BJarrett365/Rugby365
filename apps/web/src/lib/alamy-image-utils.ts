/**
 * Alamy CDN / page URL helpers for licensed editorial player images.
 */

const ALAMY_ZOOM_RE =
  /^https?:\/\/c\d+\.alamy\.com\/zooms\/\d+\/([a-f0-9]+)\/[^/?#]+\.jpe?g$/i;
const ALAMY_HOST_RE = /^https?:\/\/(?:[\w-]+\.)*alamy\.com\//i;

export function isAllowedAlamyImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/\.alamy\.com$/i.test(u.hostname)) return false;
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // Prefer zoom/comp assets; reject logos and chrome.
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".svg") || path.includes("/logos/")) return false;
    return /\/zooms\//.test(path) || /\/comp\//.test(path) || /\.jpe?g$/i.test(path);
  } catch {
    return false;
  }
}

export function isAlamyPageUrl(url: string): boolean {
  return ALAMY_HOST_RE.test(url);
}

/** Stable id from zoom URL path segment (Alamy image UUID without dashes). */
export function alamyImageIdFromUrl(url: string): string | null {
  const m = url.match(ALAMY_ZOOM_RE);
  return m?.[1]?.toLowerCase() ?? null;
}

export function canonicalizeAlamyImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    // Normalize host casing and prefer https.
    u.protocol = "https:";
    const id = alamyImageIdFromUrl(u.toString());
    if (id) {
      // Keep path but strip size-variant filename noise by using id as key.
      return `alamy:${id}`;
    }
    return u.toString().toLowerCase();
  } catch {
    return url;
  }
}

export function alamySearchSlug(query: string): string {
  return query
    .trim()
    .replace(/\+/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function alamyStockPhotoSearchUrl(query: string): string {
  return `https://www.alamy.com/stock-photo/${alamySearchSlug(query)}.html?sortBy=relevant`;
}
