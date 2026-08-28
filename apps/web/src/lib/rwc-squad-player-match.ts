import { normalizePlayerName } from "./entity-normalize";
import { foldRankingClubKey } from "./player-ranking-engine";

const FIRST_NAME_ALIASES: Record<string, string[]> = {
  franco: ["francois", "françois", "frans"],
  francois: ["franco", "frans"],
  frans: ["franco", "francois"],
  maxime: ["max"],
  max: ["maxime"],
  joe: ["joseph"],
  joseph: ["joe"],
  will: ["william", "bill"],
  william: ["will", "bill"],
  bill: ["william", "will"],
  johnny: ["john", "jonathan"],
  john: ["johnny", "jonathan"],
  jonathan: ["johnny", "john"],
  dan: ["daniel"],
  daniel: ["dan"],
  tom: ["thomas"],
  thomas: ["tom"],
  chris: ["christopher"],
  christopher: ["chris"],
  alex: ["alexander", "alexandre"],
  alexander: ["alex"],
  alexandre: ["alex"],
  jean: ["jeanne"],
};

export function foldPlayerMatchKey(name: string): string {
  return foldRankingClubKey(normalizePlayerName(name));
}

export function rwcSquadPlayerMatchKeys(name: string): string[] {
  const folded = foldPlayerMatchKey(name);
  if (!folded) return [];
  const parts = folded.split(" ").filter(Boolean);
  const keys = new Set<string>([`exact:${folded}`]);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const last = parts[parts.length - 1]!;
    keys.add(`last:${last}`);
    keys.add(`init:${first[0]}:${last}`);
    for (const alias of FIRST_NAME_ALIASES[first] ?? []) {
      keys.add(`exact:${[alias, ...parts.slice(1)].join(" ")}`);
      keys.add(`init:${alias[0]}:${last}`);
    }
  }
  return [...keys];
}

export function indexSquadPlayerNames(rows: Array<{ id: string; name: string }>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const row of rows) {
    for (const key of rwcSquadPlayerMatchKeys(row.name)) {
      const list = index.get(key) ?? [];
      if (!list.includes(row.id)) list.push(row.id);
      index.set(key, list);
    }
  }
  return index;
}

export function matchSquadPlayerIds(wikiName: string, index: Map<string, string[]>): string[] {
  const keys = rwcSquadPlayerMatchKeys(wikiName);
  const exact = keys.filter((k) => k.startsWith("exact:"));
  for (const key of exact) {
    const hits = index.get(key) ?? [];
    if (hits.length) return hits;
  }
  const init = keys.filter((k) => k.startsWith("init:"));
  for (const key of init) {
    const hits = index.get(key) ?? [];
    if (hits.length === 1) return hits;
  }
  const last = keys.filter((k) => k.startsWith("last:"));
  for (const key of last) {
    const hits = index.get(key) ?? [];
    if (hits.length === 1) return hits;
  }
  return [];
}
