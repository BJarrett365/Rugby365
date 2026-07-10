import { normalizeWikipediaTitle } from "./parse-url";

export type WikipediaCategoryMember = {
  title: string;
  pageId: number;
};

export function isWikipediaCategoryTitle(title: string): boolean {
  const normalized = title.trim().replace(/_/g, " ");
  return normalized.toLowerCase().startsWith("category:");
}

export function normalizeWikipediaCategoryTitle(input: string): string {
  const title = normalizeWikipediaTitle(input);
  if (isWikipediaCategoryTitle(title)) return title;
  return `Category:${title}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWikipediaCategoryMembers(input: {
  categoryTitleOrUrl: string;
  lang?: string;
  limit?: number;
}): Promise<WikipediaCategoryMember[]> {
  return fetchWikipediaCategoryEntries({
    ...input,
    memberType: "page",
  });
}

export async function fetchWikipediaCategorySubcategories(input: {
  categoryTitleOrUrl: string;
  lang?: string;
  limit?: number;
}): Promise<WikipediaCategoryMember[]> {
  return fetchWikipediaCategoryEntries({
    ...input,
    memberType: "subcat",
  });
}

async function fetchWikipediaCategoryEntries(input: {
  categoryTitleOrUrl: string;
  lang?: string;
  limit?: number;
  memberType: "page" | "subcat";
}): Promise<WikipediaCategoryMember[]> {
  const categoryTitle = normalizeWikipediaCategoryTitle(input.categoryTitleOrUrl);
  const lang = input.lang ?? "en";
  const limit = input.limit ?? 500;
  const members: WikipediaCategoryMember[] = [];
  let continueToken: string | undefined;

  while (members.length < limit) {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmlimit: String(Math.min(50, limit - members.length)),
      cmtype: input.memberType,
      format: "json",
      origin: "*",
    });
    if (continueToken) params.set("cmcontinue", continueToken);

    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
      headers: {
        "User-Agent": "Rugby365CoachImport/1.0 (read-only category import)",
        Accept: "application/json",
      },
    });

    if (res.status === 429) {
      await sleep(2000);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Wikipedia category fetch failed (${res.status}): ${categoryTitle}`);
    }

    const payload = (await res.json()) as {
      query?: { categorymembers?: Array<{ pageid: number; title: string; ns?: number }> };
      continue?: { cmcontinue?: string };
    };

    const batch = payload.query?.categorymembers ?? [];
    for (const row of batch) {
      if (input.memberType === "page" && row.ns !== undefined && row.ns !== 0) continue;
      if (input.memberType === "subcat" && row.ns !== undefined && row.ns !== 14) continue;
      members.push({ title: row.title, pageId: row.pageid });
      if (members.length >= limit) break;
    }

    continueToken = payload.continue?.cmcontinue;
    if (!continueToken || members.length >= limit) break;
    await sleep(300);
  }

  return members.sort((a, b) => a.title.localeCompare(b.title));
}
