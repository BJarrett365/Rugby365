/** Match Wikipedia box-score scorer labels (often surname-only) to known players. */

export type ScorerCandidate = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

export function normalizeScorerKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isPenaltyTryLabel(name: string): boolean {
  return /^penalty\s*tr(?:y|ies)$/i.test(name.trim());
}

export function eventPayloadPlayerName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["playerName", "player_name", "player"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = (value as { name?: unknown }).name;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return null;
}

function candidateRank(row: ScorerCandidate): number {
  let score = 0;
  if (row.imageUrl) score += 100;
  if (row.name.includes("'") || row.name.includes("\u2019")) score += 10;
  score += Math.min(row.name.length, 40);
  return score;
}

/** Collapse duplicate person records (accent / apostrophe variants) to one row each. */
export function collapseScorerCandidates(candidates: ScorerCandidate[]): ScorerCandidate[] {
  const byKey = new Map<string, ScorerCandidate>();
  for (const row of candidates) {
    const key = normalizeScorerKey(row.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || candidateRank(row) > candidateRank(existing)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function matchScorerToCandidates(
  scorerName: string,
  candidates: ScorerCandidate[],
): ScorerCandidate | null {
  const raw = scorerName.trim();
  if (!raw || isPenaltyTryLabel(raw)) return null;

  const needle = normalizeScorerKey(raw);
  if (!needle) return null;

  const pool = collapseScorerCandidates(candidates);
  const exact = pool.filter((row) => normalizeScorerKey(row.name) === needle);
  if (exact.length === 1) return exact[0]!;

  const surnameHits = pool.filter((row) => {
    const key = normalizeScorerKey(row.name);
    return key === needle || key.endsWith(` ${needle}`);
  });
  if (surnameHits.length === 1) return surnameHits[0]!;

  const parts = needle.split(" ");
  const initial = parts[0];
  if (parts.length >= 2 && initial && initial.length === 1) {
    const surname = parts.slice(1).join(" ");
    const initialHits = pool.filter((row) => {
      const key = normalizeScorerKey(row.name);
      const tokens = key.split(" ");
      const first = tokens[0];
      return Boolean(first && key.endsWith(` ${surname}`) && first.startsWith(initial));
    });
    if (initialHits.length === 1) return initialHits[0]!;
  }

  return null;
}
