import {
  fetchRugbyDataCountryLeagues,
  fetchRugbyDataNewsLeagues,
} from "./rugby-data-api-client";
import {
  bumpIntegrationJobCounters,
  completeIntegrationJob,
  createIntegrationJob,
  failIntegrationJob,
  startIntegrationJob,
  updateIntegrationJobProgress,
} from "./data-integration-job-service";
import {
  type RugbyDataLeagueCatalogEntry,
  throttleRugbyDataImport,
} from "./rugby-data-import-utils";

function catalogKey(id: number): string {
  return String(id);
}

function mergeCatalogEntry(
  map: Map<string, RugbyDataLeagueCatalogEntry>,
  entry: RugbyDataLeagueCatalogEntry,
): void {
  const key = catalogKey(entry.id);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entry);
    return;
  }
  map.set(key, {
    ...existing,
    name: existing.name || entry.name,
    slug: existing.slug ?? entry.slug,
    season: existing.season ?? entry.season,
    country: existing.country ?? entry.country,
    categoryId: existing.categoryId ?? entry.categoryId,
    source: existing.source === entry.source ? existing.source : existing.source,
  });
}

function parseCountryLeagues(data: unknown): RugbyDataLeagueCatalogEntry[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataLeagueCatalogEntry[] = [];
  for (const country of data) {
    if (!country || typeof country !== "object") continue;
    const c = country as {
      nm?: string;
      name?: string | null;
      cid?: number;
      tournaments?: Array<{
        id?: number;
        name?: string;
        nm?: string;
        sl?: string;
        sea?: string;
        category_id?: number;
      }>;
    };
    const countryName = c.nm ?? c.name ?? null;
    for (const tournament of c.tournaments ?? []) {
      if (tournament?.id == null) continue;
      out.push({
        id: tournament.id,
        name: tournament.name ?? tournament.nm ?? `League ${tournament.id}`,
        slug: tournament.sl ?? null,
        season: tournament.sea ?? null,
        country: countryName,
        categoryId: tournament.category_id ?? c.cid ?? null,
        source: "country_leagues",
      });
    }
  }
  return out;
}

function parseNewsLeagues(data: unknown): RugbyDataLeagueCatalogEntry[] {
  if (!Array.isArray(data)) return [];
  const out: RugbyDataLeagueCatalogEntry[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as {
      id?: number;
      league_id?: number;
      name?: string;
      category_id?: number;
      rugbyCategory?: { nm?: string };
    };
    const leagueId = r.league_id ?? r.id;
    if (leagueId == null) continue;
    out.push({
      id: leagueId,
      name: r.name ?? `League ${leagueId}`,
      country: r.rugbyCategory?.nm ?? null,
      categoryId: r.category_id ?? null,
      source: "news_leagues",
    });
  }
  return out;
}

export async function discoverRugbyDataLeagues(options: {
  jobId?: string;
  startedBy?: string;
} = {}): Promise<{
  jobId: string;
  leagues: RugbyDataLeagueCatalogEntry[];
  countryCount: number;
  newsCount: number;
}> {
  const job =
    options.jobId != null
      ? { id: options.jobId }
      : await createIntegrationJob({
          name: "Discover Rugby Data leagues",
          jobType: "rugby_data_discover",
          startedBy: options.startedBy ?? "system",
        });

  await startIntegrationJob(job.id);

  try {
    const catalog = new Map<string, RugbyDataLeagueCatalogEntry>();

    await throttleRugbyDataImport();
    const countryRes = await fetchRugbyDataCountryLeagues("");
    if (!countryRes.ok) {
      throw new Error(countryRes.errorMessage ?? "Failed to fetch country leagues");
    }
    const countryEntries = parseCountryLeagues(countryRes.data);
    for (const entry of countryEntries) mergeCatalogEntry(catalog, entry);

    await throttleRugbyDataImport();
    const newsRes = await fetchRugbyDataNewsLeagues();
    if (!newsRes.ok) {
      throw new Error(newsRes.errorMessage ?? "Failed to fetch news leagues");
    }
    const newsEntries = parseNewsLeagues(newsRes.data);
    for (const entry of newsEntries) mergeCatalogEntry(catalog, entry);

    const leagues = [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name));

    await updateIntegrationJobProgress(job.id, {
      recordsFound: leagues.length,
      preview: {
        leagueCatalog: leagues,
        discoveredAt: new Date().toISOString(),
        countryLeagues: countryEntries.length,
        newsLeagues: newsEntries.length,
      },
    });

    await completeIntegrationJob(job.id, {
      leagueCount: leagues.length,
      countryLeagues: countryEntries.length,
      newsLeagues: newsEntries.length,
    });

    return {
      jobId: job.id,
      leagues,
      countryCount: countryEntries.length,
      newsCount: newsEntries.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failIntegrationJob(job.id, message);
    await bumpIntegrationJobCounters(job.id, { errors: 1 });
    throw error;
  }
}

export function loadLeagueCatalogFromJobPreview(preview: unknown): RugbyDataLeagueCatalogEntry[] {
  if (!preview || typeof preview !== "object") return [];
  const catalog = (preview as { leagueCatalog?: unknown }).leagueCatalog;
  if (!Array.isArray(catalog)) return [];
  return catalog.filter(
    (row): row is RugbyDataLeagueCatalogEntry =>
      !!row &&
      typeof row === "object" &&
      typeof (row as RugbyDataLeagueCatalogEntry).id === "number" &&
      typeof (row as RugbyDataLeagueCatalogEntry).name === "string",
  );
}

export async function getLatestLeagueCatalog(): Promise<RugbyDataLeagueCatalogEntry[]> {
  const { listIntegrationJobs } = await import("./data-integration-job-service");
  const jobs = await listIntegrationJobs({ jobType: "rugby_data_discover", limit: 5 });
  for (const job of jobs) {
    const catalog = loadLeagueCatalogFromJobPreview(job.preview);
    if (catalog.length) return catalog;
  }
  return [];
}
