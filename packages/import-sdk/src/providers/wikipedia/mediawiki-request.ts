/**
 * Optional MediaWiki / Wikidata request overrides.
 * App code can pass CMS-resolved User-Agent, API base URL, and optional bearer token.
 * When omitted, env vars (WIKIPEDIA_* / WIKIDATA_*) then package defaults apply.
 */
export type MediaWikiRequestOptions = {
  userAgent?: string;
  apiBaseUrl?: string;
  accessToken?: string | null;
};

export function resolveMediaWikiUserAgent(
  options: MediaWikiRequestOptions | undefined,
  envKey: string,
  fallback: string,
): string {
  return options?.userAgent?.trim() || process.env[envKey]?.trim() || fallback;
}

export function resolveMediaWikiApiBaseUrl(
  options: MediaWikiRequestOptions | undefined,
  envKey: string,
  fallback: string,
): string {
  return (
    options?.apiBaseUrl?.trim() ||
    process.env[envKey]?.trim() ||
    fallback
  ).replace(/\/$/, "");
}

export function buildMediaWikiHeaders(
  userAgent: string,
  accessToken?: string | null,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    ...extra,
  };
  const token = accessToken?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
