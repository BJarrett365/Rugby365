import type { BmbetsParsedUrl } from "./types";

const BMBETS_HOST = "www.bmbets.com";

/**
 * Competitions BMbets wrongly nests under /rugby-union/ that are Rugby League.
 * Super League (Europe) is the main offender (Hull KR, Wigan, Leeds Rhinos, …).
 */
export const BMBETS_UNION_PATH_LEAGUE_BLOCKLIST = [
  "/rugby-union/europe/super-league",
  "/rugby-union/australia/nrl",
  "/rugby-union/england/super-league",
  "/rugby-union/england/rfl-championship",
] as const;

const LEAGUE_TEAM_HINTS =
  /\b(rhinos|tigers|warriors|dragons|wolves|trinity|rovers|knights|leopards|bulls|vikings|hull kr|st helens|wigan|castleford|wakefield|salford|huddersfield|catalans|toulouse olympique|bradford|leigh)\b/i;

/**
 * Parse BMbets rugby-union URLs only.
 *
 * Examples:
 * - https://www.bmbets.com/matches/rugby-union/
 * - https://www.bmbets.com/rugby-union/
 * - https://www.bmbets.com/rugby-union/new-zealand/npc/
 * - https://www.bmbets.com/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/
 */
export function parseBmbetsUrl(raw: string): BmbetsParsedUrl {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid BMbets URL");
  }

  if (!url.hostname.toLowerCase().includes("bmbets.com")) {
    throw new Error("URL must be a bmbets.com page");
  }

  const parts = url.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());

  if (parts.includes("rugby-league")) {
    throw new Error("URL is Rugby League — only Rugby Union is supported");
  }

  const matchesIdx = parts[0] === "matches" ? 0 : -1;
  const sportIdx =
    matchesIdx >= 0
      ? parts[1] === "rugby-union"
        ? 1
        : -1
      : parts[0] === "rugby-union"
        ? 0
        : -1;

  if (sportIdx < 0) {
    throw new Error("URL must be under /rugby-union or /matches/rugby-union");
  }

  const after = parts.slice(sportIdx + 1);

  // Match: region/competition/home-v-away-12345/
  const matchPart = after.find((p) => /-v-/.test(p) && /-\d+$/.test(p));
  if (matchPart) {
    const matchIdx = after.indexOf(matchPart);
    const regionSlug = after[0] ?? null;
    const competitionSlug = after.length > 2 ? after[matchIdx - 1]! : after[1] ?? null;
    const eventId = matchPart.match(/-(\d+)$/)?.[1] ?? null;
    const namePart = matchPart.replace(/-\d+$/, "");
    const [homeHint, awayHint] = namePart.split("-v-");
    return {
      sourceUrl: `https://${BMBETS_HOST}/rugby-union/${after.slice(0, matchIdx + 1).join("/")}/`,
      kind: "match",
      sportSlug: "rugby-union",
      regionSlug,
      competitionSlug,
      matchSlug: matchPart,
      eventId,
      homeNameHint: homeHint ? titleFromSlug(homeHint) : null,
      awayNameHint: awayHint ? titleFromSlug(awayHint) : null,
    };
  }

  if (matchesIdx >= 0 || after.length === 0) {
    return {
      sourceUrl: `https://${BMBETS_HOST}/matches/rugby-union/`,
      kind: "sport_listing",
      sportSlug: "rugby-union",
      regionSlug: null,
      competitionSlug: null,
      matchSlug: null,
      eventId: null,
      homeNameHint: null,
      awayNameHint: null,
    };
  }

  return {
    sourceUrl: `https://${BMBETS_HOST}/rugby-union/${after.join("/")}/`,
    kind: "competition",
    sportSlug: "rugby-union",
    regionSlug: after[0] ?? null,
    competitionSlug: after[1] ?? after[0] ?? null,
    matchSlug: null,
    eventId: null,
    homeNameHint: null,
    awayNameHint: null,
  };
}

export function isBmbetsRugbyUnionUrl(raw: string): boolean {
  try {
    parseBmbetsUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function isBmbetsLeaguePath(pathnameOrUrl: string): boolean {
  const path = pathnameOrUrl.toLowerCase();
  if (path.includes("/rugby-league/")) return true;
  return BMBETS_UNION_PATH_LEAGUE_BLOCKLIST.some((blocked) => path.includes(blocked));
}

/**
 * Detect Rugby League fixtures that BMbets has filed under Rugby Union.
 */
export function classifyBmbetsLeagueContamination(input: {
  sourceUrl: string;
  competitionName?: string | null;
  homeName?: string | null;
  awayName?: string | null;
}): { rejectedAsLeague: boolean; rejectReason: string | null } {
  const url = input.sourceUrl.toLowerCase();
  if (url.includes("/rugby-league/")) {
    return { rejectedAsLeague: true, rejectReason: "Path is /rugby-league/" };
  }
  if (isBmbetsLeaguePath(url)) {
    return {
      rejectedAsLeague: true,
      rejectReason: "Competition path is a known Rugby League feed misfiled under Rugby Union",
    };
  }

  const comp = (input.competitionName ?? "").toLowerCase();
  if (/\bnrl\b/.test(comp) || /^super league$/.test(comp.trim()) || /\brfl\b/.test(comp)) {
    return {
      rejectedAsLeague: true,
      rejectReason: `Competition "${input.competitionName}" looks like Rugby League`,
    };
  }

  // Super League under any rugby-union region with RL club nicknames
  if (/super-league|super league/.test(url) || /super league/.test(comp)) {
    const teams = `${input.homeName ?? ""} ${input.awayName ?? ""}`;
    if (LEAGUE_TEAM_HINTS.test(teams)) {
      return {
        rejectedAsLeague: true,
        rejectReason: "Super League teams indicate Rugby League, not Union",
      };
    }
  }

  return { rejectedAsLeague: false, rejectReason: null };
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
