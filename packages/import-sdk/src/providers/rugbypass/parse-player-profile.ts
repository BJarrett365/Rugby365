export type RugbyPassSeasonStat = {
  competitionName: string;
  seasonLabel: string;
  rugbypassPlayerId: string | null;
  gamesPlayed: number | null;
  tries: number | null;
  points: number | null;
  minutesPlayed: number | null;
  stats: Record<string, number>;
};

export type RugbyPassPlayerMatch = {
  importKey: string;
  matchTitle: string;
  competitionName: string;
  seasonLabel: string;
  teamName: string;
  opponentName: string;
  kickoffAt: string;
  squadRole: "start" | "bench" | "unused" | "played";
  minutesPlayed: number;
  tries: number;
  points: number;
  conversions: number;
  stats: Record<string, unknown>;
};

export type RugbyPassPlayerProfile = {
  slug: string;
  sourceUrl: string;
  displayName: string;
  fullName: string | null;
  nationality: string | null;
  age: number | null;
  birthDate: string | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  currentTeam: string | null;
  imageUrl: string | null;
  bioSummary: string | null;
  birthPlace: string | null;
  rugbypassPlayerId: string | null;
  seasonStats: RugbyPassSeasonStat[];
  recentMatches: RugbyPassPlayerMatch[];
};

const RUGBYPASS_PLAYER_URL_RE =
  /(?:https?:\/\/(?:www\.)?rugbypass\.com)?\/players\/([a-z0-9-]+)\/?/i;

export function parseRugbyPassPlayerSlug(urlOrSlug: string): string | null {
  const trimmed = urlOrSlug.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(RUGBYPASS_PLAYER_URL_RE)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function rugbyPassPlayerUrl(slug: string): string {
  return `https://www.rugbypass.com/players/${slug}/`;
}

/** Sport365/CMS slugs often append a short external id (e.g. alapati-leiua-294ok068). */
export function cmsPlayerSlugToRugbyPassSlug(
  cmsSlug: string,
  externalProviderId?: string | null,
): string {
  const lower = cmsSlug.trim().toLowerCase();
  if (!externalProviderId) return lower;

  const suffix = externalProviderId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase();
  if (suffix.length >= 4 && lower.endsWith(`-${suffix}`)) {
    return lower.slice(0, -(suffix.length + 1));
  }
  return lower;
}

/** Ordered RugbyPass slug candidates when a CMS slug may include a Sport365 suffix. */
export function rugbyPassPlayerSlugCandidates(
  slugOrUrl: string,
  externalProviderId?: string | null,
): string[] {
  const parsed = parseRugbyPassPlayerSlug(slugOrUrl) ?? slugOrUrl.trim().toLowerCase();
  if (!parsed) return [];

  const stripped = cmsPlayerSlugToRugbyPassSlug(parsed, externalProviderId);
  const out: string[] = [];
  for (const slug of [parsed, stripped]) {
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseMetric(value: string, unit: "cm" | "kg"): number | null {
  const match = value.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i"));
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseAge(value: string): number | null {
  const n = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 80 ? n : null;
}

export function approximateBirthDateFromAge(age: number, asOf: Date = new Date()): string {
  const year = asOf.getFullYear() - age;
  return `${year}-01-01`;
}

function extractScriptJsonArray(html: string, scriptId: string): unknown[] {
  const marker = `id="${scriptId}"`;
  const startIdx = html.indexOf(marker);
  if (startIdx < 0) return [];
  const afterTag = html.indexOf(">", startIdx);
  if (afterTag < 0) return [];
  const raw = html.slice(afterTag + 1);
  const arrayStart = raw.indexOf("[");
  if (arrayStart < 0) return [];
  let depth = 0;
  for (let i = arrayStart; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(raw.slice(arrayStart, i + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function parsePlayerDetails(html: string): {
  nationality: string | null;
  age: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthDate: string | null;
  birthPlace: string | null;
} {
  const detailsMatch = html.match(/<div class="player-details">([\s\S]*?)<\/div>\s*<div class="main-news">/i);
  const block = detailsMatch?.[1] ?? "";
  const fields: Record<string, string> = {};
  const detailRe = /<div class="detail">\s*<h3>([^<]+)<\/h3>\s*<div>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = detailRe.exec(block))) {
    const label = stripTags(match[1] ?? "").toLowerCase();
    const raw = match[2] ?? "";
    if (label.includes("nationality") || label.includes("country")) {
      const flagAlt = raw.match(/alt="([^"]+)"/i)?.[1];
      fields.nationality = flagAlt ? stripTags(flagAlt) : stripTags(raw);
    } else if (label.includes("age")) {
      fields.age = stripTags(raw);
    } else if (label.includes("position")) {
      fields.position = stripTags(raw);
    } else if (label.includes("height")) {
      fields.height = stripTags(raw);
    } else if (label.includes("weight")) {
      fields.weight = stripTags(raw);
    } else if (label.includes("birth") && label.includes("date")) {
      fields.birthDate = stripTags(raw);
    } else if (label.includes("place") && label.includes("birth")) {
      fields.birthPlace = stripTags(raw);
    } else if (label === "dob" || label === "date of birth") {
      fields.birthDate = stripTags(raw);
    }
  }

  const age = fields.age ? parseAge(fields.age) : null;
  let birthDate: string | null = null;
  if (fields.birthDate) {
    const parsed = Date.parse(fields.birthDate);
    if (!Number.isNaN(parsed)) birthDate = new Date(parsed).toISOString().slice(0, 10);
  } else if (age != null) {
    birthDate = approximateBirthDateFromAge(age);
  }

  return {
    nationality: fields.nationality ?? null,
    age,
    position: fields.position ?? null,
    heightCm: fields.height ? parseMetric(fields.height, "cm") : null,
    weightKg: fields.weight ? parseMetric(fields.weight, "kg") : null,
    birthDate,
    birthPlace: fields.birthPlace ?? null,
  };
}

function parseDisplayName(html: string): string | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return stripTags(h1);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  return title ? stripTags(title).replace(/\s*\|\s*RugbyPass.*$/i, "") : null;
}

function parseCurrentTeam(html: string): string | null {
  const team = html.match(/<a[^>]+class="team"[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  return team ? stripTags(team) : null;
}

function parseImageUrl(html: string): string | null {
  const img =
    html.match(/<img[^>]+class="player-image"[^>]+src="([^"]+)"/i)?.[1] ??
    html.match(/<img[^>]+src="([^"]+)"[^>]+class="player-image"/i)?.[1];
  return img ? decodeHtmlEntities(img) : null;
}

function parseBioSummary(html: string): string | null {
  const bio =
    html.match(/<div class="player-bio[^"]*">([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<div class="bio[^"]*">([\s\S]*?)<\/div>/i)?.[1];
  const text = bio ? stripTags(bio) : "";
  return text.length >= 20 ? text : null;
}

function parseCanonicalUrl(html: string, slug: string): string {
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  return canonical ? decodeHtmlEntities(canonical) : rugbyPassPlayerUrl(slug);
}

export function parseMatchTitle(title: string): { home: string; away: string } | null {
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return null;
  const home = parts[0]?.trim();
  const away = parts[1]?.trim();
  if (!home || !away) return null;
  return { home, away };
}

export function inferPlayerTeamFromMatch(
  matchTitle: string,
  oppositionName: string,
  currentTeam?: string | null,
): string | null {
  const parsed = parseMatchTitle(matchTitle);
  if (!parsed) return currentTeam ?? null;
  const opp = oppositionName.trim().toLowerCase();
  if (parsed.home.toLowerCase() === opp) return parsed.away;
  if (parsed.away.toLowerCase() === opp) return parsed.home;
  if (currentTeam) {
    const team = currentTeam.trim().toLowerCase();
    if (parsed.home.toLowerCase().includes(team) || team.includes(parsed.home.toLowerCase())) {
      return parsed.home;
    }
    if (parsed.away.toLowerCase().includes(team) || team.includes(parsed.away.toLowerCase())) {
      return parsed.away;
    }
  }
  return currentTeam ?? null;
}

function inferSquadRole(minutes: number): RugbyPassPlayerMatch["squadRole"] {
  if (minutes <= 0) return "unused";
  if (minutes >= 60) return "start";
  if (minutes > 0) return "bench";
  return "played";
}

export function buildRugbyPassMatchImportKey(input: {
  rugbypassPlayerId: string | null;
  slug: string;
  kickoffUnix: number;
  matchTitle: string;
}): string {
  const playerKey = input.rugbypassPlayerId ?? input.slug;
  const titleKey = input.matchTitle.trim().toLowerCase().replace(/\s+/g, "-");
  return `rugbypass:match:${playerKey}:${input.kickoffUnix}:${titleKey}`;
}

function parseSeasonStats(
  rows: unknown[],
  rugbypassPlayerId: string | null,
): RugbyPassSeasonStat[] {
  const out: RugbyPassSeasonStat[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const competition = (row as { competition?: Record<string, unknown> }).competition;
    if (!competition || typeof competition !== "object") continue;
    const name = typeof competition.name === "string" ? competition.name : null;
    const season =
      competition.season && typeof competition.season === "object"
        ? (competition.season as Record<string, unknown>)
        : null;
    const seasonLabel =
      season && typeof season.label === "string" ? season.label : null;
    const statsBlock =
      competition.stats &&
      typeof competition.stats === "object" &&
      (competition.stats as { stats?: Record<string, unknown> }).stats
        ? ((competition.stats as { stats: Record<string, unknown> }).stats as Record<
            string,
            unknown
          >)
        : null;
    if (!name || !statsBlock) continue;
    const numericStats: Record<string, number> = {};
    for (const [key, value] of Object.entries(statsBlock)) {
      if (typeof value === "number" && Number.isFinite(value)) numericStats[key] = value;
    }
    const playerIdFromStats =
      typeof statsBlock.player_id === "number" || typeof statsBlock.player_id === "string"
        ? String(statsBlock.player_id)
        : rugbypassPlayerId;
    out.push({
      competitionName: name,
      seasonLabel: seasonLabel ?? name,
      rugbypassPlayerId: playerIdFromStats,
      gamesPlayed:
        typeof statsBlock.total_games === "number" ? statsBlock.total_games : null,
      tries: typeof statsBlock.tries === "number" ? statsBlock.tries : null,
      points: typeof statsBlock.points === "number" ? statsBlock.points : null,
      minutesPlayed:
        typeof statsBlock.minutes_played_total === "number"
          ? statsBlock.minutes_played_total
          : null,
      stats: numericStats,
    });
  }
  return out;
}

function parseRecentMatches(
  rows: unknown[],
  slug: string,
  rugbypassPlayerId: string | null,
  currentTeam: string | null,
): RugbyPassPlayerMatch[] {
  const out: RugbyPassPlayerMatch[] = [];
  for (const comp of rows) {
    if (!comp || typeof comp !== "object") continue;
    const games = (comp as { games?: unknown[] }).games;
    if (!Array.isArray(games)) continue;
    for (const game of games) {
      if (!game || typeof game !== "object") continue;
      const g = game as Record<string, unknown>;
      const title = typeof g.title === "string" ? g.title : null;
      const compTitle = typeof g.compTitle === "string" ? g.compTitle : null;
      const time = typeof g.time === "number" ? g.time : null;
      const opposition =
        g.opposition && typeof g.opposition === "object"
          ? (g.opposition as { name?: string }).name
          : null;
      if (!title || !time || !opposition) continue;
      const stats =
        g.stats && typeof g.stats === "object"
          ? (g.stats as Record<string, unknown>)
          : {};
      const minutes =
        typeof stats.mins === "number" ? stats.mins : Number(stats.mins ?? 0) || 0;
      const tries = typeof stats.tries === "number" ? stats.tries : Number(stats.tries ?? 0) || 0;
      const conversions =
        typeof stats.conversions === "number"
          ? stats.conversions
          : Number(stats.conversions ?? 0) || 0;
      const points = tries * 5 + conversions * 2;
      const teamName = inferPlayerTeamFromMatch(title, opposition, currentTeam) ?? currentTeam ?? "";
      const kickoffAt = new Date(time * 1000).toISOString();
      out.push({
        importKey: buildRugbyPassMatchImportKey({
          rugbypassPlayerId,
          slug,
          kickoffUnix: time,
          matchTitle: title,
        }),
        matchTitle: title,
        competitionName: compTitle ?? "",
        seasonLabel: compTitle ?? "",
        teamName,
        opponentName: opposition,
        kickoffAt,
        squadRole: inferSquadRole(minutes),
        minutesPlayed: minutes,
        tries,
        points,
        conversions,
        stats,
      });
    }
  }
  return out.sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt));
}

export function parseRugbyPassPlayerProfile(
  html: string,
  sourceUrl?: string,
): RugbyPassPlayerProfile | null {
  const slugFromUrl = sourceUrl ? parseRugbyPassPlayerSlug(sourceUrl) : null;
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  const slug =
    slugFromUrl ??
    (canonical ? parseRugbyPassPlayerSlug(canonical) : null) ??
    null;
  if (!slug) return null;

  const displayName = parseDisplayName(html);
  if (!displayName) return null;

  const details = parsePlayerDetails(html);
  const currentTeam = parseCurrentTeam(html);
  const compStats = extractScriptJsonArray(html, "app-comp-stats");
  const compMatches = extractScriptJsonArray(html, "app-competitions");
  const seasonStats = parseSeasonStats(compStats, null);
  const rugbypassPlayerId = seasonStats.find((s) => s.rugbypassPlayerId)?.rugbypassPlayerId ?? null;
  const recentMatches = parseRecentMatches(
    compMatches,
    slug,
    rugbypassPlayerId,
    currentTeam,
  );

  return {
    slug,
    sourceUrl: sourceUrl ? decodeHtmlEntities(sourceUrl) : parseCanonicalUrl(html, slug),
    displayName,
    fullName: displayName,
    nationality: details.nationality,
    age: details.age,
    birthDate: details.birthDate,
    position: details.position,
    heightCm: details.heightCm,
    weightKg: details.weightKg,
    currentTeam,
    imageUrl: parseImageUrl(html),
    bioSummary: parseBioSummary(html),
    birthPlace: details.birthPlace,
    rugbypassPlayerId,
    seasonStats,
    recentMatches,
  };
}
