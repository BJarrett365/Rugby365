/**
 * Pure helpers to cross-reference RugbyPass appearances against stored CMS fixtures.
 * Prefer linking existing fixtures — never invent duplicate match rows.
 */
import {
  normalizeTeamName,
  stripTeamSponsorAndSeasonLabels,
} from "./entity-normalize";
import { canonicalPremiershipTeamName } from "./transfer-match-service";

/** Common RugbyPass ↔ CMS club label aliases (Currie Cup / URC / Premiership). */
const TEAM_ALIAS_GROUPS: string[][] = [
  ["kavaliers", "boland cavaliers", "boland", "cavaliers"],
  ["griffons", "toyota griffons", "free state griffons"],
  ["pumas", "airlink pumas", "mpumalanga pumas"],
  ["lions", "golden lions", "emirates lions"],
  ["bulls", "blue bulls", "vodacom bulls"],
  ["sharks", "cell c sharks", "hollywood sharks", "hollywood red bulls sharks"],
  ["stormers", "dhl stormers", "western province"],
  ["cheetahs", "toyota cheetahs", "free state cheetahs"],
  ["zebra", "zebras", "border"],
  ["hawkes bay", "hawke s bay", "hawkesbay"],
];

function aliasLookup(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const group of TEAM_ALIAS_GROUPS) {
    const set = new Set(group);
    for (const key of group) map.set(key, set);
  }
  return map;
}

const ALIAS_LOOKUP = aliasLookup();

export function fixtureTeamMatchKey(name: string): string {
  const stripped = stripTeamSponsorAndSeasonLabels(name);
  const canonical = canonicalPremiershipTeamName(normalizeTeamName(stripped));
  return canonical.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Expand a team label into comparable tokens (base name + aliases + significant words). */
export function fixtureTeamMatchTokens(name: string): Set<string> {
  const key = fixtureTeamMatchKey(name);
  const tokens = new Set<string>();
  if (!key) return tokens;
  tokens.add(key);
  for (const part of key.split(/\s+/).filter((p) => p.length >= 3)) {
    tokens.add(part);
  }
  const aliasGroup = ALIAS_LOOKUP.get(key);
  if (aliasGroup) {
    for (const alias of aliasGroup) {
      tokens.add(alias);
      for (const part of alias.split(/\s+/).filter((p) => p.length >= 3)) {
        tokens.add(part);
      }
    }
  }
  // Also check if any alias group contains a token we already have
  for (const [aliasKey, group] of ALIAS_LOOKUP) {
    if (tokens.has(aliasKey) || [...tokens].some((t) => group.has(t))) {
      for (const alias of group) {
        tokens.add(alias);
        for (const part of alias.split(/\s+/).filter((p) => p.length >= 3)) {
          tokens.add(part);
        }
      }
    }
  }
  return tokens;
}

export function fixtureTeamsLikelyMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left?.trim() || !right?.trim()) return false;
  const a = fixtureTeamMatchTokens(left);
  const b = fixtureTeamMatchTokens(right);
  if (!a.size || !b.size) return false;

  // Exact / contains on normalized keys
  const aKey = fixtureTeamMatchKey(left);
  const bKey = fixtureTeamMatchKey(right);
  if (aKey === bKey) return true;
  if (aKey.includes(bKey) || bKey.includes(aKey)) return true;

  // Shared significant token (cavaliers, stormers, lions, …)
  for (const token of a) {
    if (token.length < 4) continue;
    if (b.has(token)) return true;
  }
  return false;
}

export type FixtureMatchCandidate = {
  id: string;
  kickoffAt: Date | string | null;
  slug?: string | null;
  competitionName?: string | null;
  homeName: string | null;
  awayName: string | null;
};

export type RugbyPassMatchLinkInput = {
  kickoffAt: Date;
  teamName: string;
  opponentName: string;
  competitionName?: string | null;
  matchTitle?: string | null;
};

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function daysApartUtc(a: Date, b: Date): number {
  const ms = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const ns = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(Math.round((ms - ns) / 86_400_000));
}

function competitionCompatible(
  fixtureCompetition: string | null | undefined,
  sourceCompetition: string | null | undefined,
): boolean {
  if (!fixtureCompetition?.trim() || !sourceCompetition?.trim()) return true;
  const left = fixtureCompetition.toLowerCase();
  const right = sourceCompetition.toLowerCase();
  if (left.includes(right.slice(0, 6)) || right.includes(left.slice(0, 6))) return true;
  // Soft pass for Currie Cup / domestic cup naming drift
  if (left.includes("currie") && right.includes("currie")) return true;
  return false;
}

function sidesMatch(
  home: string,
  away: string,
  teamName: string,
  opponentName: string,
): boolean {
  return (
    (fixtureTeamsLikelyMatch(home, teamName) && fixtureTeamsLikelyMatch(away, opponentName)) ||
    (fixtureTeamsLikelyMatch(home, opponentName) && fixtureTeamsLikelyMatch(away, teamName))
  );
}

function slugHintsMatch(slug: string | null | undefined, input: RugbyPassMatchLinkInput): boolean {
  if (!slug?.trim()) return false;
  const s = slug.toLowerCase();
  const teamTokens = [...fixtureTeamMatchTokens(input.teamName)].filter((t) => t.length >= 4);
  const oppTokens = [...fixtureTeamMatchTokens(input.opponentName)].filter((t) => t.length >= 4);
  const teamHit = teamTokens.some((t) => s.includes(t.replace(/\s+/g, "-")) || s.includes(t));
  const oppHit = oppTokens.some((t) => s.includes(t.replace(/\s+/g, "-")) || s.includes(t));
  if (!teamHit || !oppHit) return false;
  const iso = input.kickoffAt.toISOString().slice(0, 10);
  return s.includes(iso) || s.includes(iso.replace(/-/g, ""));
}

/**
 * Pick the best existing CMS fixture for a RugbyPass appearance.
 * Returns null when no confident match — caller must not create a new fixture.
 */
export function pickStoredFixtureForRugbyPassMatch(
  candidates: FixtureMatchCandidate[],
  input: RugbyPassMatchLinkInput,
): string | null {
  let best: { id: string; score: number } | null = null;

  for (const row of candidates) {
    if (!row.homeName || !row.awayName || !row.kickoffAt) continue;
    const kickoff = new Date(row.kickoffAt);
    if (Number.isNaN(kickoff.getTime())) continue;

    const dayGap = daysApartUtc(kickoff, input.kickoffAt);
    if (dayGap > 1) continue;

    const teamsOk = sidesMatch(row.homeName, row.awayName, input.teamName, input.opponentName);
    const slugOk = slugHintsMatch(row.slug, input);
    if (!teamsOk && !slugOk) continue;
    if (!competitionCompatible(row.competitionName, input.competitionName)) continue;

    let score = 0;
    if (teamsOk) score += 50;
    if (slugOk) score += 25;
    if (sameUtcDay(kickoff, input.kickoffAt)) score += 20;
    else score += 5;
    if (
      input.competitionName &&
      row.competitionName &&
      competitionCompatible(row.competitionName, input.competitionName)
    ) {
      score += 5;
    }

    if (!best || score > best.score) best = { id: row.id, score };
  }

  return best && best.score >= 50 ? best.id : null;
}
