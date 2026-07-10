const WIKIPEDIA_HOSTS = new Set([
  "en.wikipedia.org",
  "www.en.wikipedia.org",
  "wikipedia.org",
  "www.wikipedia.org",
]);

export function isWikipediaArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!WIKIPEDIA_HOSTS.has(parsed.hostname.replace(/^www\./, "")) && !parsed.hostname.endsWith("wikipedia.org")) {
      return false;
    }
    if (parsed.pathname.startsWith("/wiki/Category:")) return false;
    return parsed.pathname.startsWith("/wiki/") && !parsed.pathname.startsWith("/wiki/Special:");
  } catch {
    return false;
  }
}

export function isWikipediaCategoryUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname.endsWith("wikipedia.org") && parsed.pathname.startsWith("/wiki/Category:");
  } catch {
    return false;
  }
}

export function parseWikipediaCategoryUrl(url: string): { categoryTitle: string; projectId: string } {
  const parsed = new URL(url.trim());
  const raw = decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, ""));
  const categoryTitle = raw.replace(/_/g, " ");
  const lang = parsed.hostname.split(".")[0] === "www" ? "en" : parsed.hostname.split(".")[0];
  const projectId = `${lang}wiki`;
  return { categoryTitle, projectId };
}

export function parseWikipediaArticleUrl(url: string): { articleTitle: string; projectId: string } {
  const parsed = new URL(url.trim());
  const raw = decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, ""));
  const articleTitle = raw.replace(/_/g, " ");
  const lang = parsed.hostname.split(".")[0] === "www" ? "en" : parsed.hostname.split(".")[0];
  const projectId = `${lang}wiki`;
  return { articleTitle, projectId };
}

export function normalizeWikipediaTitle(input: string): string {
  const trimmed = input.trim();
  if (isWikipediaArticleUrl(trimmed)) {
    return parseWikipediaArticleUrl(trimmed).articleTitle;
  }
  return trimmed.replace(/_/g, " ");
}

export function wikipediaArticleUrl(articleTitle: string, lang = "en"): string {
  const slug = articleTitle.trim().replace(/ /g, "_");
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
}
