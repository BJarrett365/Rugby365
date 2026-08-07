/**
 * Load the canonical scrape/source URL catalog (docs/scraped/source-catalog.json).
 * Shared by ingest scripts for RWC and other competitions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ScrapeSourceUrl = {
  name: string;
  url: string;
  scope?: string[];
  year?: number;
  kind?: string;
};

export type ScrapeSourceGroup = {
  id: string;
  label: string;
  urls: ScrapeSourceUrl[];
};

export type ScrapeSourceCatalog = {
  version: number;
  updatedAt: string;
  purpose: string;
  groups: ScrapeSourceGroup[];
};

let cached: ScrapeSourceCatalog | null = null;

export function scrapeSourceCatalogPath(cwd = process.cwd()): string {
  return join(cwd, "docs/scraped/source-catalog.json");
}

export function loadScrapeSourceCatalog(cwd = process.cwd()): ScrapeSourceCatalog {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(scrapeSourceCatalogPath(cwd), "utf8")) as ScrapeSourceCatalog;
  return cached;
}

export function scrapeSourcesForScope(scope: string, cwd = process.cwd()): ScrapeSourceUrl[] {
  const catalog = loadScrapeSourceCatalog(cwd);
  const out: ScrapeSourceUrl[] = [];
  for (const group of catalog.groups) {
    for (const entry of group.urls) {
      if (entry.scope?.includes(scope)) out.push(entry);
    }
  }
  return out;
}

export function rugbyWorldCupWikipediaStatisticsUrls(
  cwd = process.cwd(),
): Array<{ year: number; url: string; name: string }> {
  return scrapeSourcesForScope("rugby-world-cup", cwd)
    .filter((e) => e.kind === "statistics" && e.year != null)
    .map((e) => ({ year: e.year!, url: e.url, name: e.name }))
    .sort((a, b) => a.year - b.year);
}

export function rugbyWorldCupWikipediaSeasonPageUrls(
  cwd = process.cwd(),
): Array<{ year: number; url: string; name: string }> {
  return scrapeSourcesForScope("rugby-world-cup", cwd)
    .filter((e) => e.kind === "season" && e.year != null)
    .map((e) => ({ year: e.year!, url: e.url, name: e.name }))
    .sort((a, b) => a.year - b.year);
}
