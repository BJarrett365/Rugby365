import { isLiveFixtureStatus } from "./live-table-service";

const COMPLETED_STATUSES = new Set(["full_time", "finished", "completed", "ft"]);

/** Common international nicknames → country name used on standings. */
const NATIONAL_TEAM_ALIASES: Record<string, string> = {
  "all blacks": "New Zealand",
  "new zealand (all blacks)": "New Zealand",
  springboks: "South Africa",
  "south africa springboks": "South Africa",
  "ru zaf": "South Africa",
  "ru-rt zaf": "South Africa",
  "ru jpn": "Japan",
  "ru-jpn": "Japan",
  jpn: "Japan",
  wallabies: "Australia",
  pumas: "Argentina",
  "los pumas": "Argentina",
};

/**
 * Fixture-slug / display aliases for club sides so orphan placeholders and
 * long-form EPCR/URC names collapse onto the canonical CMS team label.
 */
const CLUB_TEAM_ALIASES: Record<string, string> = {
  "stade toulousain": "Toulouse",
  "bordeaux begles": "Bordeaux Begles",
  "bordeaux-begles": "Bordeaux Begles",
  "bordeaux bègles": "Bordeaux Begles",
  "union bordeaux begles": "Bordeaux Begles",
  "union bordeaux-bègles": "Bordeaux Begles",
  "union bordeaux bègles": "Bordeaux Begles",
  "zebre parma": "Zebre",
  "llanelli scarlets": "Scarlets",
  "blue bulls": "Bulls",
  "natal sharks": "Sharks",
  "hollywood sharks": "Sharks",
  "hollywood cardiffs": "Cardiff Rugby",
  "hawkes bay": "Hawke's Bay",
  "hawke s bay": "Hawke's Bay",
  "hawke's bay": "Hawke's Bay",
};

/** Core Rugby Championship / Tri-Nations sides (post-name normalisation). */
export const RUGBY_CHAMPIONSHIP_TEAM_KEYS = new Set([
  "argentina",
  "australia",
  "new zealand",
  "south africa",
]);

const STALE_LIVE_MS = 5 * 60 * 60 * 1000;
/** Kickoff more than this far in the future cannot be "in play". */
const LIVE_NOT_STARTED_GRACE_MS = 2 * 60 * 1000;

export function canonicalStandingsTeamName(name: string): string {
  const trimmed = name
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/[|_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return trimmed;
  if (/^unknown\b/i.test(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  if (NATIONAL_TEAM_ALIASES[key]) return NATIONAL_TEAM_ALIASES[key]!;
  if (CLUB_TEAM_ALIASES[key]) return CLUB_TEAM_ALIASES[key]!;
  if (/\bzaf\b/i.test(key)) return "South Africa";
  if (/\bnzl\b/i.test(key)) return "New Zealand";
  if (/\baus\b/i.test(key)) return "Australia";
  if (/\barg\b/i.test(key)) return "Argentina";
  return trimmed;
}

/**
 * Normalise a fixture-slug side token (`sharks`, `zebre-zd93w56v`, `stade-toulousain`)
 * by stripping provider hash suffixes before name resolution.
 */
export function cleanFixtureSlugSideToken(raw: string): string {
  let token = (raw ?? "").trim().toLowerCase();
  if (!token) return token;
  const parts = token.split("-").filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    // Opaque CMS hash suffixes mix letters + digits (zd93w56v, krjdq463, 52944z98).
    const isHash =
      last.length >= 6 &&
      last.length <= 12 &&
      /\d/.test(last) &&
      /[a-z]/i.test(last) &&
      !/^(u\d+|under\d+)$/i.test(last);
    if (isHash) return parts.slice(0, -1).join("-");
  }
  return token;
}

/** Title-case a cleaned slug token into a display team name (with aliases applied). */
export function displayNameFromFixtureSlugToken(raw: string): string {
  const cleaned = cleanFixtureSlugSideToken(raw);
  return canonicalStandingsTeamName(
    cleaned
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase()),
  );
}

/** Reject synced standings polluted by duplicate imports / orphan teams. */
export function isHealthyStandingsRows(
  rows: Array<{ teamId?: string; teamName?: string | null }>,
): boolean {
  if (!rows.length) return false;
  const names = rows.map((row) => canonicalStandingsTeamName(row.teamName ?? ""));
  if (names.some((name) => isUnknownStandingsTeamName(name))) return false;
  const uniqueNames = new Set(names.map((name) => name.toLowerCase()));
  if (uniqueNames.size !== rows.length) return false;
  const uniqueIds = new Set(rows.map((row) => row.teamId).filter(Boolean));
  if (uniqueIds.size !== rows.length) return false;
  return true;
}

export function isRugbyChampionshipParticipant(teamName: string): boolean {
  const key = canonicalStandingsTeamName(teamName).toLowerCase();
  return RUGBY_CHAMPIONSHIP_TEAM_KEYS.has(key);
}

export function isUnknownStandingsTeamName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /^unknown\b/i.test(name.trim()) || /^orphan\b/i.test(name.trim());
}

/** Infer home/away labels from slug when CMS team rows are orphan placeholders. */
export function resolveTeamNamesFromFixtureSlug(
  slug: string | null | undefined,
  homeName: string,
  awayName: string,
): { homeName: string; awayName: string } {
  let home = canonicalStandingsTeamName(homeName);
  let away = canonicalStandingsTeamName(awayName);
  if (!isUnknownStandingsTeamName(home) && !isUnknownStandingsTeamName(away)) {
    return { homeName: home, awayName: away };
  }

  const base = (slug ?? "").split("__legacy__")[0] ?? "";
  const withoutDate = base.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const parts = withoutDate.split("-v-");
  if (parts.length !== 2) return { homeName: home, awayName: away };

  const fromSlug = (raw: string) =>
    displayNameFromFixtureSlugToken(raw.replace(/\bwrmru\d+\b/gi, " "));

  if (isUnknownStandingsTeamName(home)) home = fromSlug(parts[0]!);
  if (isUnknownStandingsTeamName(away)) away = fromSlug(parts[1]!);
  return { homeName: home, awayName: away };
}

/**
 * Recover club names for the public fixtures board without national nicknames
 * (`pumas` stays Pumas, not Argentina).
 */
export function resolvePublicClubNamesFromFixtureSlug(
  slug: string | null | undefined,
  homeName: string,
  awayName: string,
): { homeName: string; awayName: string } {
  let home = homeName.trim();
  let away = awayName.trim();
  const homeUnknown = isUnknownStandingsTeamName(home);
  const awayUnknown = isUnknownStandingsTeamName(away);
  if (!homeUnknown && !awayUnknown) {
    return {
      homeName: canonicalStandingsTeamName(home),
      awayName: canonicalStandingsTeamName(away),
    };
  }

  const base = (slug ?? "").split("__legacy__")[0] ?? "";
  const withoutDate = base.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const parts = withoutDate.split("-v-");
  if (parts.length !== 2) {
    return { homeName: canonicalStandingsTeamName(home), awayName: canonicalStandingsTeamName(away) };
  }

  const fromSlug = (raw: string) => {
    const cleaned = cleanFixtureSlugSideToken(raw.replace(/\bwrmru\d+\b/gi, " "));
    const titled = cleaned
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
    return CLUB_TEAM_ALIASES[titled.toLowerCase()] ?? titled;
  };
  if (homeUnknown) home = fromSlug(parts[0]!);
  if (awayUnknown) away = fromSlug(parts[1]!);
  return { homeName: home, awayName: away };
}

export function isStaleLiveFixture(
  status: string,
  kickoffAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!isLiveFixtureStatus(status)) return false;
  // Live with no kickoff cannot be validated — treat as abandoned/stale.
  if (kickoffAt == null) return true;
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return true;
  const age = nowMs - kickoff.getTime();
  // Not started yet (future kickoff) → not a real live match.
  if (age < -LIVE_NOT_STARTED_GRACE_MS) return true;
  return age > STALE_LIVE_MS;
}

/** True only for matches that are actually in play right now. */
export function isActivelyLiveFixture(
  status: string,
  kickoffAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return isLiveFixtureStatus(status) && !isStaleLiveFixture(status, kickoffAt, nowMs);
}

export function standingsMatchDayKey(
  kickoffAt: Date | string,
  homeName: string,
  awayName: string,
): string | null {
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  const day = kickoff.toISOString().slice(0, 10);
  const home = canonicalStandingsTeamName(homeName).toLowerCase();
  const away = canonicalStandingsTeamName(awayName).toLowerCase();
  if (!home || !away || isUnknownStandingsTeamName(home) || isUnknownStandingsTeamName(away)) {
    return null;
  }
  return `${day}:${[home, away].sort().join(":")}`;
}

export type StandingsDedupeFixtureMeta = {
  id: string;
  slug: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homeName: string;
  awayName: string;
  kickoffAt: Date | string | null;
};

export function scoreFixtureForStandingsDedupe(row: StandingsDedupeFixtureMeta): number {
  let score = 0;
  const status = row.status.toLowerCase();
  if (COMPLETED_STATUSES.has(status)) score += 100;
  else if (isLiveFixtureStatus(row.status) && !isStaleLiveFixture(row.status, row.kickoffAt)) score += 40;
  if (row.slug.includes("__legacy__")) score -= 80;
  if (/wrmru\d+/i.test(row.slug)) score -= 25;
  if (isUnknownStandingsTeamName(row.homeName) || isUnknownStandingsTeamName(row.awayName)) score -= 120;
  score += Math.min(80, row.homeScore + row.awayScore);
  if (/^[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}$/i.test(row.slug.split("__legacy__")[0] ?? "")) {
    score += 10;
  }
  return score;
}

/**
 * Collapse duplicate imports of the same match (different team IDs / legacy slugs)
 * down to one fixture per match-day + pair of nations/clubs.
 */
export function pickCanonicalFixturesForStandings<T>(
  rows: T[],
  metaFor: (row: T) => StandingsDedupeFixtureMeta,
): T[] {
  const buckets = new Map<string, Array<{ row: T; meta: StandingsDedupeFixtureMeta; score: number }>>();
  const passthrough: T[] = [];

  for (const row of rows) {
    const meta = metaFor(row);
    const resolved = resolveTeamNamesFromFixtureSlug(meta.slug, meta.homeName, meta.awayName);
    if (!meta.kickoffAt) {
      passthrough.push(row);
      continue;
    }
    const key = standingsMatchDayKey(meta.kickoffAt, resolved.homeName, resolved.awayName);
    if (!key) {
      passthrough.push(row);
      continue;
    }
    const scored = {
      row,
      meta: { ...meta, homeName: resolved.homeName, awayName: resolved.awayName },
      score: scoreFixtureForStandingsDedupe({
        ...meta,
        homeName: resolved.homeName,
        awayName: resolved.awayName,
      }),
    };
    const list = buckets.get(key) ?? [];
    list.push(scored);
    buckets.set(key, list);
  }

  const keepers: T[] = [...passthrough];
  for (const group of buckets.values()) {
    group.sort((a, b) => b.score - a.score || a.meta.slug.localeCompare(b.meta.slug));
    keepers.push(group[0]!.row);
  }
  return keepers;
}

export function pickCanonicalTeamIdByName(
  teams: Array<{ id: string; name: string; slug: string }>,
): Map<string, { id: string; name: string }> {
  const best = new Map<string, { id: string; name: string; score: number }>();
  for (const team of teams) {
    const name = canonicalStandingsTeamName(team.name);
    if (isUnknownStandingsTeamName(name)) continue;
    const key = name.toLowerCase();
    let score = 0;
    const expectedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (team.slug === expectedSlug) score += 50;
    else if (team.slug.startsWith(`${expectedSlug}-`) && !team.slug.includes("__legacy__")) score += 35;
    if (team.name.trim().toLowerCase() === key) score += 25;
    if (!team.slug.includes("__legacy__")) score += 20;
    if (!/wrmru\d+/i.test(team.slug)) score += 10;
    if (team.slug.length <= 40) score += 5;
    if (!isUnknownStandingsTeamName(team.name)) score += 15;
    // Prefer real country labels over nicknames when both map to the same nation.
    if (canonicalStandingsTeamName(team.name) !== team.name.trim()) score -= 15;
    const existing = best.get(key);
    if (!existing || score > existing.score || (score === existing.score && team.id < existing.id)) {
      best.set(key, { id: team.id, name, score });
    }
  }
  return new Map([...best.entries()].map(([key, value]) => [key, { id: value.id, name: value.name }]));
}
