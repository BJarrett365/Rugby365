import {
  canonicalPlayerDisplayName,
  fixReversedTwoWordPlayerName,
  normalizePlayerName,
  normalizedEntityKey,
} from "./entity-normalize";

export type PlayerIdentityIssue =
  | "duplicate_normalized_key"
  | "reversed_name_tokens"
  | "nickname_variant"
  | "display_name_mismatch";

export type PlayerIdentityRow = {
  id: string;
  name: string;
};

export type PlayerDuplicateGroup = {
  key: string;
  issue: PlayerIdentityIssue;
  canonicalName: string;
  players: Array<{ id: string; name: string; suggestedCanonicalName: string }>;
};

const NICKNAME_EQUIVALENTS: Record<string, string> = {
  will: "william",
  william: "william",
  tom: "thomas",
  thomas: "thomas",
  sam: "samuel",
  samuel: "samuel",
  joe: "joseph",
  joseph: "joseph",
  ben: "benjamin",
  benjamin: "benjamin",
  dan: "daniel",
  daniel: "daniel",
  alex: "alexander",
  alexander: "alexander",
  matt: "matthew",
  matthew: "matthew",
  mike: "michael",
  michael: "michael",
  jim: "james",
  james: "james",
};

/** Sorted token key — catches "Ewan Richards" vs "Richards Ewan". */
export function playerTokenSortKey(name: string): string {
  const canonical = canonicalPlayerDisplayName(name).toLowerCase();
  return canonical
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function playerNormalizedKey(name: string): string {
  return normalizedEntityKey(canonicalPlayerDisplayName(name), "player");
}

export function playerNicknameKey(name: string): string {
  const parts = canonicalPlayerDisplayName(name).toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join(" ");
  const [first, ...rest] = parts;
  const normalizedFirst = NICKNAME_EQUIVALENTS[first] ?? first;
  return [normalizedFirst, ...rest].join(" ");
}

export function isReversedNameImport(name: string): boolean {
  const normalized = normalizePlayerName(name);
  return fixReversedTwoWordPlayerName(normalized) !== normalized;
}

export function suggestedCanonicalName(name: string): string {
  return canonicalPlayerDisplayName(name);
}

export function areLikelySamePlayer(a: string, b: string): boolean {
  if (playerNormalizedKey(a) === playerNormalizedKey(b)) return true;
  if (playerTokenSortKey(a) === playerTokenSortKey(b)) return true;
  if (playerNicknameKey(a) === playerNicknameKey(b)) return true;
  return false;
}

/** Group players on a squad list by likely duplicate identity. */
export function findPlayerDuplicateGroups(rows: PlayerIdentityRow[]): PlayerDuplicateGroup[] {
  const groups = new Map<string, PlayerIdentityRow[]>();

  for (const row of rows) {
    const keys = [
      playerNormalizedKey(row.name),
      playerTokenSortKey(row.name),
      playerNicknameKey(row.name),
    ];
    for (const key of keys) {
      const bucket = groups.get(key) ?? [];
      if (!bucket.some((entry) => entry.id === row.id)) bucket.push(row);
      groups.set(key, bucket);
    }
  }

  const seen = new Set<string>();
  const result: PlayerDuplicateGroup[] = [];

  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const ids = [...members.map((m) => m.id)].sort().join("|");
    if (seen.has(ids)) continue;
    seen.add(ids);

    const canonicalName = members
      .map((m) => suggestedCanonicalName(m.name))
      .sort((a, b) => b.length - a.length)[0]!;

    let issue: PlayerIdentityIssue = "duplicate_normalized_key";
    if (members.some((m) => isReversedNameImport(m.name))) {
      issue = "reversed_name_tokens";
    } else if (
      new Set(members.map((m) => playerNicknameKey(m.name))).size === 1 &&
      new Set(members.map((m) => playerNormalizedKey(m.name))).size > 1
    ) {
      issue = "nickname_variant";
    }

    result.push({
      key,
      issue,
      canonicalName,
      players: members.map((m) => ({
        id: m.id,
        name: m.name,
        suggestedCanonicalName: suggestedCanonicalName(m.name),
      })),
    });
  }

  return result.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

export function findReversedNameRows(rows: PlayerIdentityRow[]): Array<{
  id: string;
  name: string;
  suggestedName: string;
}> {
  return rows
    .filter((row) => isReversedNameImport(row.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      suggestedName: suggestedCanonicalName(row.name),
    }));
}
