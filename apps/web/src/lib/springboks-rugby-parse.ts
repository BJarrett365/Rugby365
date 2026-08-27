/**
 * Parse official SA Rugby (springboks.rugby) match-centre embedded fixture JSON.
 */
export const SPRINGBOKS_RUGBY_ORIGIN = "https://springboks.rugby";
export const SPRINGBOKS_MATCH_CENTRE_URL = `${SPRINGBOKS_RUGBY_ORIGIN}/match-centre`;
export const SPRINGBOKS_PROVIDER = "springboks_rugby";

export type SpringboksRugbyTeam = {
  teamId: string;
  name: string;
  isHomeTeam: boolean;
  score: number | null;
  imagePath: string | null;
};

export type SpringboksRugbyMatch = {
  matchId: string;
  competitionId: string | null;
  competitionName: string | null;
  seasonName: string | null;
  venueName: string | null;
  roundName: string | null;
  roundNumber: number | null;
  utcDate: string;
  isCancelled: boolean;
  isPostponed: boolean;
  isLive: boolean;
  homeTeam: SpringboksRugbyTeam | null;
  awayTeam: SpringboksRugbyTeam | null;
  teams: SpringboksRugbyTeam[];
  matchUrl: string;
};

function unescapeRscJsonFragment(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\'/g, "'");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractJsonObject(unesc: string): string | null {
  if (!unesc.startsWith("{")) return null;
  let depth = 0;
  for (let i = 0; i < unesc.length; i += 1) {
    const ch = unesc[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return unesc.slice(0, i + 1);
    }
  }
  return null;
}

function mapTeam(raw: Record<string, unknown>): SpringboksRugbyTeam | null {
  const teamId = typeof raw.teamId === "string" ? raw.teamId : null;
  const name = typeof raw.name === "string" ? raw.name.trim() : null;
  if (!teamId || !name) return null;
  return {
    teamId,
    name,
    isHomeTeam: Boolean(raw.isHomeTeam),
    score: typeof raw.score === "number" ? raw.score : null,
    imagePath: typeof raw.imagePath === "string" ? raw.imagePath : null,
  };
}

function competitionSlug(name: string | null): string {
  return slugify(name || "match");
}

function fixtureSlug(home: string, away: string): string {
  return `${slugify(home)}-v-${slugify(away)}`;
}

/**
 * Extract fixture objects embedded in the springboks.rugby match-centre HTML (Next.js RSC).
 */
export function parseSpringboksMatchCentreHtml(html: string): SpringboksRugbyMatch[] {
  const byId = new Map<string, SpringboksRugbyMatch>();
  const re = /\{\\"matchId\\":\\"([0-9a-f-]{36})\\"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const start = m.index;
    const window = html.slice(start, start + 6000);
    const blob = extractJsonObject(unescapeRscJsonFragment(window));
    if (!blob) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(blob) as Record<string, unknown>;
    } catch {
      continue;
    }
    const matchId = typeof obj.matchId === "string" ? obj.matchId : null;
    const utcDate = typeof obj.utcDate === "string" ? obj.utcDate : null;
    if (!matchId || !utcDate) continue;

    const teamsRaw = Array.isArray(obj.teams) ? obj.teams : [];
    const teams = teamsRaw
      .map((t) => (t && typeof t === "object" ? mapTeam(t as Record<string, unknown>) : null))
      .filter((t): t is SpringboksRugbyTeam => Boolean(t));
    const homeTeam = teams.find((t) => t.isHomeTeam) ?? teams[0] ?? null;
    const awayTeam = teams.find((t) => !t.isHomeTeam) ?? teams[1] ?? null;
    const competitionName =
      typeof obj.competitionName === "string" ? obj.competitionName : null;

    byId.set(matchId, {
      matchId,
      competitionId: typeof obj.competitionId === "string" ? obj.competitionId : null,
      competitionName,
      seasonName: typeof obj.seasonName === "string" ? obj.seasonName : null,
      venueName: typeof obj.venueName === "string" ? obj.venueName : null,
      roundName: typeof obj.roundName === "string" ? obj.roundName : null,
      roundNumber: typeof obj.roundNumber === "number" ? obj.roundNumber : null,
      utcDate: utcDate.endsWith("Z") ? utcDate : `${utcDate}Z`,
      isCancelled: Boolean(obj.isCancelled),
      isPostponed: Boolean(obj.isPostponed),
      isLive: Boolean(obj.isLive),
      homeTeam,
      awayTeam,
      teams,
      matchUrl: `${SPRINGBOKS_RUGBY_ORIGIN}/match-centre/match/${competitionSlug(competitionName)}/${fixtureSlug(homeTeam?.name ?? "home", awayTeam?.name ?? "away")}/${matchId}`,
    });
  }
  return [...byId.values()].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

export function isSpringboksSeniorMensMatch(match: SpringboksRugbyMatch): boolean {
  return match.teams.some((t) => {
    const n = t.name.toLowerCase();
    return n === "springboks" || n === "south africa";
  });
}

export function normalizeSpringboksTeamName(name: string): string {
  const n = name.trim();
  if (/^springboks$/i.test(n)) return "South Africa";
  if (/^all blacks$/i.test(n)) return "New Zealand";
  return n;
}

export const SPRINGBOKS_SQUAD_URL = `${SPRINGBOKS_RUGBY_ORIGIN}/sa-teams-players/springboks`;

export type SpringboksSquadCard = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  position: string | null;
  externalPlayerId: string | null;
  imageUrl: string | null;
  profileUrl: string;
};

function unescapeHtmlJson(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\n/g, "\n");
}

/**
 * Parse current Springboks squad cards from the official sa-teams-players page (RSC HTML).
 */
export function parseSpringboksSquadHtml(html: string): SpringboksSquadCard[] {
  const unesc = unescapeHtmlJson(html);
  const bySlug = new Map<string, SpringboksSquadCard>();
  const re =
    /\{\s*"firstName"\s*:\s*"([^"]*)"\s*,\s*"lastName"\s*:\s*"([^"]*)"\s*,\s*"position"\s*:\s*"([^"]*)"\s*,\s*"playerId"\s*:\s*"([^"]*)"\s*,\s*"image"\s*:\s*"([^"]*)"\s*,\s*"slug"\s*:\s*"([^"]+)"\s*\}/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(unesc))) {
    const firstName = m[1]!.trim();
    const lastName = m[2]!.trim();
    const position = m[3]!.trim() || null;
    const externalPlayerId = m[4]!.trim() || null;
    const imageUrl = m[5]!.trim() || null;
    const slug = m[6]!.trim().toLowerCase();
    if (!slug || (!firstName && !lastName)) continue;
    const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
    bySlug.set(slug, {
      slug,
      firstName,
      lastName,
      name,
      position,
      externalPlayerId,
      imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
      profileUrl: `${SPRINGBOKS_SQUAD_URL}/${slug}`,
    });
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSpringboksSquadHtml(): Promise<string> {
  const res = await fetch(SPRINGBOKS_SQUAD_URL, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (springboks-squad; local)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`springboks.rugby squad fetch failed (${res.status})`);
  }
  return res.text();
}

export async function fetchSpringboksSquadCards(): Promise<SpringboksSquadCard[]> {
  const html = await fetchSpringboksSquadHtml();
  return parseSpringboksSquadHtml(html);
}

export async function fetchSpringboksPlayerProfileHtml(slug: string): Promise<string> {
  const url = `${SPRINGBOKS_SQUAD_URL}/${slug.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (springboks-player; local)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`springboks.rugby player fetch failed (${res.status}) for ${slug}`);
  }
  return res.text();
}

/** Official headshot on a player profile page (Cortex CDN). */
export function extractSpringboksPlayerImageUrl(html: string): string | null {
  const unesc = unescapeHtmlJson(html);
  const match = unesc.match(
    /https:\/\/media-cdn\.cortextech\.io\/[A-Za-z0-9/_-]+\.(?:webp|png|jpe?g)/i,
  );
  return match?.[0] ?? null;
}
