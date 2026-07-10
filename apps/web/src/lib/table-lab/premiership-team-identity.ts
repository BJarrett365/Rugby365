import { normalizedEntityKey, normalizeTeamName } from "../entity-normalize";
import { canonicalPremiershipTeamName, PREMIERSHIP_TEAM_ALIASES } from "../transfer-match-service";

export type PremiershipCanonicalIdentity = {
  canonicalKey: string;
  canonicalName: string;
  uncertain: boolean;
  sourceTeamId: string;
  sourceTeamName: string;
};

const KNOWN_CANONICAL_NAMES = new Set(
  Object.values(PREMIERSHIP_TEAM_ALIASES).map((name) => name.toLowerCase()),
);

/** Clubs that must never be auto-merged even if names look similar. */
const EXPLICIT_SEPARATE_CLUB_KEYS = new Set([
  "london-irish",
  "london-scottish",
  "london-welsh",
  "wasps",
  "worcester-warriors",
  "bedford-blues",
]);

export function canonicalKeyFromName(name: string): string {
  return canonicalPremiershipTeamName(normalizeTeamName(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolvePremiershipCanonicalIdentity(input: {
  teamId: string;
  teamName: string;
  teamSlug?: string | null;
}): PremiershipCanonicalIdentity {
  const canonicalName = canonicalPremiershipTeamName(input.teamName);
  const canonicalKey = canonicalKeyFromName(canonicalName);
  const normalizedSlug = input.teamSlug?.trim().toLowerCase() ?? "";
  const aliasHit =
    PREMIERSHIP_TEAM_ALIASES[normalizedSlug] != null ||
    PREMIERSHIP_TEAM_ALIASES[normalizedEntityKey(input.teamName, "team")] != null;
  const knownCanonical = KNOWN_CANONICAL_NAMES.has(canonicalName.toLowerCase());
  const uncertain = !aliasHit && !knownCanonical && !EXPLICIT_SEPARATE_CLUB_KEYS.has(canonicalKey);

  return {
    canonicalKey,
    canonicalName,
    uncertain,
    sourceTeamId: input.teamId,
    sourceTeamName: input.teamName,
  };
}

export function mergeIdentityWarnings(identities: PremiershipCanonicalIdentity[]): string[] {
  const uncertain = new Map<string, string>();
  for (const identity of identities) {
    if (!identity.uncertain) continue;
    if (!uncertain.has(identity.canonicalKey)) {
      uncertain.set(identity.canonicalKey, identity.sourceTeamName);
    }
  }
  return [...uncertain.entries()].map(
    ([key, name]) =>
      `Team identity "${name}" (${key}) is not mapped to a known Premiership alias — review canonical club mapping.`,
  );
}
