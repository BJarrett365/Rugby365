export const TRANSFER_SOURCE_OPTIONS = [
  { key: "wikipedia", label: "Wikipedia", providers: ["wikipedia"] },
  {
    key: "premiership_rugby",
    label: "Premiership Rugby",
    providers: ["premiership", "premiership_rugby", "sdms"],
  },
  { key: "planet_rugby", label: "Planet Rugby", providers: ["planet_rugby", "planet-rugby"] },
  { key: "club_website", label: "Club website", providers: ["club", "club_website", "club-website"] },
  { key: "all_rugby", label: "All Rugby", providers: ["all_rugby", "all-rugby"] },
  { key: "rugbypass", label: "RugbyPass", providers: ["rugbypass", "rugby_pass"] },
  { key: "manual", label: "Manual", providers: ["manual"] },
] as const;

export type TransferSourceKey = (typeof TRANSFER_SOURCE_OPTIONS)[number]["key"];

export type TransferSourceConfidence = "high" | "medium" | "low";

const SOURCE_BY_PROVIDER = new Map<string, (typeof TRANSFER_SOURCE_OPTIONS)[number]>();
for (const option of TRANSFER_SOURCE_OPTIONS) {
  for (const provider of option.providers) {
    SOURCE_BY_PROVIDER.set(provider.toLowerCase(), option);
  }
}

export function normalizeTransferSourceProvider(provider: string | null | undefined): string {
  return (provider ?? "manual").trim().toLowerCase() || "manual";
}

export function resolveTransferSourceLabel(provider: string | null | undefined): string {
  const normalized = normalizeTransferSourceProvider(provider);
  return SOURCE_BY_PROVIDER.get(normalized)?.label ?? "Manual";
}

export function resolveTransferSourceKey(provider: string | null | undefined): TransferSourceKey {
  const normalized = normalizeTransferSourceProvider(provider);
  return SOURCE_BY_PROVIDER.get(normalized)?.key ?? "manual";
}

export function getProvidersForSourceKey(key: string): string[] {
  const option = TRANSFER_SOURCE_OPTIONS.find((row) => row.key === key);
  return option ? [...option.providers] : [];
}

export function resolveTransferSourceConfidence(input: {
  sourceProvider: string | null | undefined;
  sourceUrl: string | null | undefined;
  importKey?: string | null;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  effectiveDate?: Date | string | null;
}): TransferSourceConfidence {
  const provider = normalizeTransferSourceProvider(input.sourceProvider);
  const hasUrl = Boolean(input.sourceUrl?.trim());
  const hasClubs = Boolean(input.fromTeamId || input.toTeamId);
  const hasDate = Boolean(input.effectiveDate);

  if (provider === "wikipedia" && hasUrl && input.importKey) return "high";
  if (provider === "manual" && hasClubs && hasDate) return "high";
  if ((provider === "premiership" || provider === "premiership_rugby") && hasUrl) return "high";

  if (provider === "planet_rugby" || provider === "planet-rugby") return hasUrl ? "medium" : "low";
  if (provider === "rugbypass" || provider === "rugby_pass") return hasUrl ? "medium" : "low";
  if (provider === "club" || provider === "club_website") return hasUrl ? "medium" : "low";
  if (provider === "all_rugby" || provider === "all-rugby") return hasUrl ? "medium" : "low";
  if (provider === "wikipedia") return hasUrl ? "medium" : "low";

  if (!hasUrl && provider !== "manual") return "low";
  if (!hasClubs || !hasDate) return "medium";
  return "medium";
}

export function transferSourceConfidenceLabel(confidence: TransferSourceConfidence): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}