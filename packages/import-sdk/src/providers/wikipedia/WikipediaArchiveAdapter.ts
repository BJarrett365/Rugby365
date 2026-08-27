import { parseWikipediaArchiveFromHtml } from "./parse-infobox";
import { normalizeWikipediaTitle, wikipediaArticleUrl } from "./parse-url";
import type {
  WikipediaArticleFetchResult,
  WikipediaEntityType,
  WikipediaParseResult,
} from "./types";

export type FetchWikipediaArticleOptions = {
  articleTitle: string;
  projectId?: string;
  accessToken?: string;
};

async function fetchFromWikimediaEnterprise(
  articleTitle: string,
  projectId: string,
  accessToken: string,
): Promise<WikipediaArticleFetchResult> {
  const encoded = encodeURIComponent(articleTitle.replace(/ /g, "_"));
  const res = await fetch(`https://api.enterprise.wikimedia.com/v2/articles/${encoded}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filters: [{ field: "is_part_of.identifier", value: projectId }],
      limit: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wikimedia Enterprise article fetch failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const payload = (await res.json()) as Array<{
    name?: string;
    url?: string;
    abstract?: string;
    article_body?: { html?: string; wikitext?: string };
    main_entity?: { identifier?: string };
    image?: { content_url?: string; thumbnail?: { contentUrl?: string } };
  }>;

  const article = payload[0];
  if (!article) {
    throw new Error(`Article not found: ${articleTitle}`);
  }

  const title = article.name ?? articleTitle;
  return {
    articleTitle: title,
    wikipediaUrl: article.url ?? wikipediaArticleUrl(title),
    wikidataId: article.main_entity?.identifier,
    abstract: article.abstract,
    html: article.article_body?.html,
    wikitext: article.article_body?.wikitext,
    imageUrl: article.image?.thumbnail?.contentUrl ?? article.image?.content_url,
    source: "wikimedia_enterprise",
    fetchedAt: new Date().toISOString(),
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFromPublicWikipedia(
  articleTitle: string,
  lang = "en",
  attempt = 0,
): Promise<WikipediaArticleFetchResult> {
  const slug = articleTitle.trim().replace(/ /g, "_");
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(slug)}`, {
    headers: {
      "User-Agent": "Rugby365ArchiveImport/1.0 (read-only archive enrichment)",
      Accept: "text/html",
    },
  });

  if (res.status === 429 && attempt < 3) {
    await sleep(2000 * (attempt + 1));
    return fetchFromPublicWikipedia(articleTitle, lang, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Wikipedia article not found: ${articleTitle} (${res.status})`);
  }

  const html = await res.text();
  const summaryRes = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
    {
      headers: {
        "User-Agent": "Rugby365ArchiveImport/1.0 (read-only archive enrichment)",
        Accept: "application/json",
      },
    },
  );

  let abstract: string | undefined;
  let imageUrl: string | undefined;
  let wikidataId: string | undefined;
  if (summaryRes.ok) {
    const summary = (await summaryRes.json()) as {
      extract?: string;
      thumbnail?: { source?: string };
      wikibase_item?: string;
    };
    abstract = summary.extract;
    imageUrl = summary.thumbnail?.source;
    wikidataId = summary.wikibase_item;
  }

  let wikitext: string | undefined;
  try {
    const wtRes = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: "parse",
        page: articleTitle.replace(/_/g, " "),
        prop: "wikitext",
        format: "json",
        formatversion: "2",
        redirects: "1",
      }).toString()}`,
      {
        headers: {
          "User-Agent": "Rugby365ArchiveImport/1.0 (read-only archive enrichment)",
          Accept: "application/json",
        },
      },
    );
    if (wtRes.ok) {
      const payload = (await wtRes.json()) as {
        parse?: { wikitext?: string | { "*": string } };
      };
      const raw = payload.parse?.wikitext;
      wikitext = typeof raw === "string" ? raw : raw?.["*"];
    }
  } catch {
    /* optional — HTML honours fallback still works */
  }

  return {
    articleTitle: articleTitle.replace(/_/g, " "),
    wikipediaUrl: wikipediaArticleUrl(articleTitle, lang),
    wikidataId,
    abstract,
    html,
    wikitext,
    source: "wikipedia_public",
    imageUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchWikipediaArticle(
  options: FetchWikipediaArticleOptions,
): Promise<WikipediaArticleFetchResult> {
  const articleTitle = normalizeWikipediaTitle(options.articleTitle);
  const projectId = options.projectId ?? "enwiki";
  const lang = projectId.replace(/wiki$/, "") || "en";

  if (options.accessToken) {
    try {
      return await fetchFromWikimediaEnterprise(articleTitle, projectId, options.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("(429)") ||
        message.includes("(403)") ||
        message.includes("(502)") ||
        message.includes("(503)");
      if (!retryable) throw error;
    }
  }

  return fetchFromPublicWikipedia(articleTitle, lang);
}

export async function parseWikipediaArchive(input: {
  articleTitleOrUrl: string;
  entityType?: WikipediaEntityType;
  accessToken?: string;
  projectId?: string;
}): Promise<WikipediaParseResult> {
  const articleTitle = normalizeWikipediaTitle(input.articleTitleOrUrl);
  const projectId = input.projectId ?? "enwiki";
  const lang = projectId.replace(/wiki$/, "") || "en";

  const fetched = await fetchWikipediaArticle({
    articleTitle,
    projectId,
    accessToken: input.accessToken,
  });

  if (!fetched.html) {
    throw new Error("Article HTML missing from Wikipedia response.");
  }

  const archive = parseWikipediaArchiveFromHtml({
    html: fetched.html,
    articleTitle: fetched.articleTitle,
    wikipediaUrl: fetched.wikipediaUrl,
    wikidataId: fetched.wikidataId,
    abstract: fetched.abstract,
    imageUrl: fetched.imageUrl,
    entityType: input.entityType,
    wikitext: fetched.wikitext,
  });

  return {
    ...archive,
    provider: "wikipedia",
    source: fetched.source,
    fetchedAt: fetched.fetchedAt,
  };
}
