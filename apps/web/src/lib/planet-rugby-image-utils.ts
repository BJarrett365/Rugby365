/**
 * Planet Rugby image host allow-list and URL normalisation.
 * Only Planet Sport / Planet Rugby owned media may be reused.
 */

export const PLANET_RUGBY_IMAGE_HOSTS = [
  "images.ps-aws.com",
  "d3gbf3ykm8gp5c.cloudfront.net",
  "www.planetrugby.com",
  "planetrugby.com",
] as const;

const SIZE_SUFFIX = /-\d{2,4}x\d{2,4}(\.(jpe?g|png|webp))$/i;

export function isPlanetRugbyImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return PLANET_RUGBY_IMAGE_HOSTS.some((allowed) => {
    const a = allowed.replace(/^www\./, "");
    return host === a || host.endsWith(`.${a}`);
  });
}

/** Unwrap images.ps-aws.com/c?url=… to the underlying CDN URL when possible. */
export function unwrapPlanetRugbyImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname === "images.ps-aws.com" && url.pathname === "/c") {
      const nested = url.searchParams.get("url");
      if (nested) return unwrapPlanetRugbyImageUrl(nested);
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function isAllowedPlanetRugbyImageUrl(raw: string): boolean {
  try {
    const unwrapped = unwrapPlanetRugbyImageUrl(raw);
    const url = new URL(unwrapped);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!isPlanetRugbyImageHost(url.hostname)) return false;
    const path = url.pathname.toLowerCase();
    // Content uploads only for planetrugby.com host (exclude theme chrome).
    if (
      (url.hostname.replace(/^www\./, "") === "planetrugby.com") &&
      !path.includes("/content/uploads/")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Prefer full-size upload URL (drop responsive -WxH suffix). */
export function canonicalizePlanetRugbyImageUrl(raw: string): string {
  const unwrapped = unwrapPlanetRugbyImageUrl(raw);
  try {
    const url = new URL(unwrapped);
    url.hash = "";
    url.search = "";
    const path = url.pathname.replace(SIZE_SUFFIX, "$1");
    url.pathname = path;
    return url.toString();
  } catch {
    return unwrapped;
  }
}

export function filenameFromImageUrl(raw: string): string {
  try {
    const url = new URL(canonicalizePlanetRugbyImageUrl(raw));
    const base = url.pathname.split("/").pop() ?? "";
    return decodeURIComponent(base).replace(SIZE_SUFFIX, "$1");
  } catch {
    return "";
  }
}

export function slugifyPlayerNameForTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
