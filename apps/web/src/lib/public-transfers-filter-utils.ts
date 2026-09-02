/**
 * Pure helpers for the public transfers filters (search, competitions, seasons, teams).
 */

export type NamedFilterOption = {
  id: string;
  name: string;
  slug?: string | null;
  transferCount?: number;
};

export type TransferSeasonFilterRow = {
  id: string;
  label: string;
  displayLabel?: string;
  year: number;
  competitionId: string;
  competitionName?: string | null;
};

const NATIONALITY_SEARCH_ALIASES: Array<{ match: RegExp; terms: string[] }> = [
  { match: /south\s*afric|springbok|\brsa\b|\bzaf\b/i, terms: ["South Africa", "RSA", "ZA", "ZAF", "Springboks"] },
  { match: /new\s*zealand|all\s*blacks?|\bnzl\b/i, terms: ["New Zealand", "NZL", "NZ", "All Blacks"] },
  { match: /\bengland\b|\beng\b/i, terms: ["England", "ENG"] },
  { match: /\bireland\b|\bire\b/i, terms: ["Ireland", "IRE"] },
  { match: /\bwales\b|\bwal\b/i, terms: ["Wales", "WAL"] },
  { match: /\bscotland\b|\bsco\b/i, terms: ["Scotland", "SCO"] },
  { match: /\bfrance\b|\bfra\b/i, terms: ["France", "FRA"] },
  { match: /\bargentina\b|pumas?|\barg\b/i, terms: ["Argentina", "ARG"] },
  { match: /\baustralia\b|wallab(?:y|ies)|\baus\b/i, terms: ["Australia", "AUS"] },
];

/** Extra nation/club phrases so "South African" still hits RSA players. */
export function expandTransferSearchTerms(raw: string): { phrases: string[]; codes: string[] } {
  const q = raw.trim();
  if (!q) return { phrases: [], codes: [] };
  const phrases = new Set<string>([q]);
  const codes = new Set<string>();
  for (const alias of NATIONALITY_SEARCH_ALIASES) {
    if (!alias.match.test(q)) continue;
    for (const term of alias.terms) {
      if (term.length <= 3) codes.add(term.toUpperCase());
      else phrases.add(term);
    }
  }
  return { phrases: [...phrases], codes: [...codes] };
}

export function competitionFilterKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(historic\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One season row per competition name + year (legacy clones collapse). */
export function dedupeSeasonsByCompetitionAndYear<
  T extends TransferSeasonFilterRow & { competitionSlug?: string | null },
>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const name = competitionFilterKey(row.competitionName || "");
    if (!name || row.year == null) continue;
    const key = `${name}:${row.year}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingLegacy = (existing.competitionSlug ?? "").includes("__legacy__");
    const rowLegacy = (row.competitionSlug ?? "").includes("__legacy__");
    if (existingLegacy && !rowLegacy) byKey.set(key, row);
  }
  return [...byKey.values()];
}

/**
 * One option per competition name. Prefers a preferred id, then higher transfer volume,
 * then a cleaner slug (no random suffix).
 */
export function dedupeCompetitionsByName<T extends NamedFilterOption>(
  rows: T[],
  preferredId?: string | null,
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = competitionFilterKey(row.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    if (preferredId && row.id === preferredId) {
      byKey.set(key, row);
      continue;
    }
    if (preferredId && existing.id === preferredId) continue;
    const rowCount = row.transferCount ?? 0;
    const existingCount = existing.transferCount ?? 0;
    if (rowCount !== existingCount) {
      if (rowCount > existingCount) byKey.set(key, row);
      continue;
    }
    const rowSlug = (row.slug ?? "").length;
    const existingSlug = (existing.slug ?? "").length;
    if (rowSlug && existingSlug && rowSlug < existingSlug) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (preferredId && a.id === preferredId) return -1;
    if (preferredId && b.id === preferredId) return 1;
    if (a.slug === "premiership") return -1;
    if (b.slug === "premiership") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function dedupeNamedOptionsByName<T extends { id: string; name: string }>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key || byKey.has(key)) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive substring match: "Bulls" keeps Vodacom Bulls, drops Stormers. */
export function filterNamedOptionsByQuery<T extends { name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

/**
 * Group seasons by competition, newest first within each group (2025–26 then 2024–25).
 * Competitions are A–Z so Challenge Cup, Premiership, URC sit as separate blocks.
 */
export function sortSeasonsGroupedByCompetition<T extends TransferSeasonFilterRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const nameA = (a.competitionName || "").trim();
    const nameB = (b.competitionName || "").trim();
    const byName = nameA.localeCompare(nameB);
    if (byName) return byName;
    if (a.year !== b.year) return b.year - a.year;
    return (a.label || "").localeCompare(b.label || "");
  });
}

export function groupSeasonsByCompetition<T extends TransferSeasonFilterRow>(
  rows: T[],
): Array<[string, T[]]> {
  const grouped = new Map<string, T[]>();
  for (const row of sortSeasonsGroupedByCompetition(rows)) {
    const name = row.competitionName?.trim() || "Other competitions";
    const list = grouped.get(name);
    if (list) list.push(row);
    else grouped.set(name, [row]);
  }
  return [...grouped.entries()];
}

export function filterTransferClubGroups<
  T extends {
    teamId: string;
    teamName: string;
    in?: Array<{ fromTeamId?: string | null; toTeamId?: string | null }>;
    out?: Array<{ fromTeamId?: string | null; toTeamId?: string | null }>;
  },
>(
  groups: T[],
  options?: { teamId?: string | null; teamQuery?: string | null; search?: string | null },
): T[] {
  let next = groups;
  const teamId = options?.teamId?.trim();
  if (teamId) {
    next = next.filter(
      (group) =>
        group.teamId === teamId ||
        group.in?.some((row) => row.toTeamId === teamId || row.fromTeamId === teamId) ||
        group.out?.some((row) => row.toTeamId === teamId || row.fromTeamId === teamId),
    );
  }

  const teamQuery = options?.teamQuery?.trim().toLowerCase();
  if (teamQuery) {
    next = next.filter((group) => group.teamName.toLowerCase().includes(teamQuery));
  }

  const search = options?.search?.trim().toLowerCase();
  if (search) {
    const nameHits = next.filter((group) => group.teamName.toLowerCase().includes(search));
    if (nameHits.length) next = nameHits;
  }
  return next;
}
