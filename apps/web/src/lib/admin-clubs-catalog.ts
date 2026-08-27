import { isJunkTeamName, isJunkTeamSlug, teamDedupKey } from "./entity-normalize";
import { isJunkTeamPickerName, sanitizeTeamDisplayName } from "./transfer-display";
import {
  canonicalStandingsTeamName,
  publicTeamDisplayName,
  stripImportedDateSuffix,
} from "./table-lab/standings-fixture-dedupe";

export type AdminClubCatalogRow = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  teamType: string | null;
  sourceProvider: string;
};

function isWikiDebrisSlug(slug: string): boolean {
  return (
    slug.startsWith("flagicon-") ||
    slug.includes("ref-cite") ||
    slug.includes("ref-name") ||
    slug.includes("url-https") ||
    slug.includes("access-date") ||
    slug.startsWith("orphan-") ||
    slug.length > 80
  );
}

function catalogScore(row: AdminClubCatalogRow, displayName: string): number {
  let score = 0;
  if (!row.slug.includes("__legacy__")) score += 24;
  if (!isJunkTeamSlug(row.slug) && !isWikiDebrisSlug(row.slug)) score += 16;
  if (!/-\d{4}-\d{2}-\d{2}/.test(row.slug) && !/\d{4}\s+\d{2}\s+\d{2}/.test(row.name)) score += 10;
  if (row.name.trim() === displayName) score += 6;
  if ((row.shortName ?? "").trim()) score += 2;
  if (row.slug.length < 40) score += 3;
  if (row.slug.length < 24) score += 2;
  return score;
}

function catalogDisplayName(name: string): string | null {
  const sanitized = sanitizeTeamDisplayName(name) ?? name.trim();
  let display = publicTeamDisplayName(sanitized);
  if (!display || isJunkTeamPickerName(display) || isJunkTeamName(display)) return null;
  display = canonicalStandingsTeamName(display);
  const aliased = CATALOG_NAME_ALIASES[display.toLowerCase()];
  if (aliased) display = aliased;
  display = display.replace(/^the\s+/i, "").trim();
  return display || null;
}

const CATALOG_NAME_ALIASES: Record<string, string> = {
  benetton: "Benetton Treviso",
  "benetton treviso": "Benetton Treviso",
};

/** Collapse import clones so Clubs shows one card per real club. */
export function collapseAdminClubCatalog<T extends AdminClubCatalogRow>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (isWikiDebrisSlug(row.slug)) continue;
    const display = catalogDisplayName(row.name);
    if (!display) continue;
    const key = teamDedupKey(display);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push({ ...row, name: display });
    groups.set(key, bucket);
  }

  return [...groups.values()]
    .map((candidates) => {
      const sorted = [...candidates].sort((a, b) => {
        const diff = catalogScore(b, b.name) - catalogScore(a, a.name);
        if (diff !== 0) return diff;
        return a.slug.localeCompare(b.slug);
      });
      const winner = sorted[0]!;
      return { ...winner, name: stripImportedDateSuffix(winner.name) || winner.name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
