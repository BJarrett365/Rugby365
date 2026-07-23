/**
 * Public-facing transfer list: collapse duplicate from→to moves across seasons.
 * Keep this module free of server-only / DB imports so CMS client components can use it.
 */

function normalizeClubKey(value: string | null | undefined): string {
  const cleaned = (value ?? "").toLowerCase().trim();
  return cleaned.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "none";
}

export type PublicTransferCandidate = {
  id: string;
  effectiveDate: Date | string | null;
  fromClub: string | null;
  toClub: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  movementType: string;
  seasonId: string | null;
  seasonLabel?: string | null;
  competitionName?: string | null;
  sourceProvider?: string | null;
};

export type PublicTransferRow = {
  date: string | null;
  fromLabel: string;
  toLabel: string;
  movementType: string;
  seasonLabel: string | null;
  competitionName: string | null;
  duplicateCollapsed: number;
};

/** Key ignores season so Premiership 2025-26 / 2026-27 duplicates collapse. */
export function publicTransferCollapseKey(t: PublicTransferCandidate): string {
  return [
    t.movementType,
    t.fromTeamId ?? normalizeClubKey(t.fromClub),
    t.toTeamId ?? normalizeClubKey(t.toClub),
  ].join("|");
}

export function dedupeTransfersForPublic(
  rows: PublicTransferCandidate[],
): PublicTransferRow[] {
  const buckets = new Map<string, PublicTransferCandidate[]>();
  for (const row of rows) {
    const key = publicTransferCollapseKey(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const picked: PublicTransferRow[] = [];
  for (const group of buckets.values()) {
    group.sort((a, b) => {
      const da = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
      const db = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
      return db - da;
    });
    const best = group[0]!;
    const date = best.effectiveDate ? new Date(best.effectiveDate).toISOString() : null;
    picked.push({
      date,
      fromLabel: best.fromClub?.trim() || "Unknown",
      toLabel: best.toClub?.trim() || "Unknown",
      movementType: best.movementType,
      seasonLabel: best.seasonLabel ?? null,
      competitionName: best.competitionName ?? null,
      duplicateCollapsed: group.length - 1,
    });
  }

  return picked.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

export function findTransferConflicts(rows: PublicTransferCandidate[]): Array<{
  key: string;
  count: number;
  fromLabel: string;
  toLabel: string;
  movementType: string;
}> {
  const buckets = new Map<string, PublicTransferCandidate[]>();
  for (const row of rows) {
    const key = publicTransferCollapseKey(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([key, g]) => ({
      key,
      count: g.length,
      fromLabel: g[0]!.fromClub ?? "Unknown",
      toLabel: g[0]!.toClub ?? "Unknown",
      movementType: g[0]!.movementType,
    }));
}
