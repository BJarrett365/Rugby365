export type CmsEntityLink = {
  id: string;
  slug: string;
  name: string;
  externalProviderId: string | null;
  /** Optional crest / headshot when loaded for display. */
  imageUrl?: string | null;
};

export type MatchEntityContext = {
  playersByExternalId: Record<string, CmsEntityLink>;
  playersByName: Record<string, CmsEntityLink>;
  teamsByExternalId: Record<string, CmsEntityLink>;
  homeTeam: CmsEntityLink | null;
  awayTeam: CmsEntityLink | null;
  squadPlayerIds: string[];
};

export function normalizeProviderPlayerName(name: string): string {
  return name
    .replace(/\(\d+'(?:,\s*\d+')*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * SDMS scoring detail packs multi-kick minutes into player_name
 * ("Moyo Simphiwe Vusi (5', 14', 41')") while `minute` is only the first.
 * Prefer minutes embedded in the name so Match Details matches Planet Rugby.
 */
export function extractProviderScorerMinutes(entry: {
  player_name?: string | null;
  minute?: number | null;
}): number[] {
  const fromName = [...String(entry.player_name ?? "").matchAll(/(\d+)'/g)]
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
  if (fromName.length > 0) return fromName;
  if (entry.minute != null && Number.isFinite(entry.minute)) return [Number(entry.minute)];
  return [];
}

export function formatProviderScorerMinutes(minutes: number[]): string {
  if (minutes.length === 0) return "";
  return ` (${minutes.map((m) => `${m}'`).join(", ")})`;
}

export function lookupPlayerLink(
  context: MatchEntityContext,
  input: { externalId?: string | null; name?: string | null },
): CmsEntityLink | null {
  if (input.externalId && context.playersByExternalId[input.externalId]) {
    return context.playersByExternalId[input.externalId];
  }
  const raw = input.name?.trim();
  if (!raw) return null;
  const normalized = normalizeProviderPlayerName(raw).toLowerCase();
  return context.playersByName[normalized] ?? context.playersByName[raw.toLowerCase()] ?? null;
}

export function lookupTeamLink(
  context: MatchEntityContext,
  input: { externalId?: string | null },
): CmsEntityLink | null {
  if (!input.externalId) return null;
  return context.teamsByExternalId[input.externalId] ?? null;
}
