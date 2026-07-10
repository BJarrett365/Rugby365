export type CmsEntityLink = {
  id: string;
  slug: string;
  name: string;
  externalProviderId: string | null;
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
