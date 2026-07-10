import {
  assertSport365RugbyMatchUrl,
  extractSport365MatchId,
  parseSport365StartTimestamp,
  sport365StatusLabel,
} from "./sport365-parse";

const SPORT365_API = "https://api.sport365.com";
const SITE_SPORT_TO_API: Record<string, string> = {
  "rugby-union": "rugby_union",
};

export type Sport365CompetitionMatch = {
  matchId: string;
  sourceUrl: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  competition: string;
  stageName: string;
  kickoffAt?: string;
  suggestedSlug: string;
};

export type Sport365TournamentPreview = {
  kind: "tournament";
  sourceUrl: string;
  sportPath: string;
  categoryCode: string;
  stageCode: string;
  competitionName: string;
  stageName: string;
  stageId: string;
  matches: Sport365CompetitionMatch[];
};

type Sport365StageRow = {
  id: string;
  c_name?: string;
  c_code?: string;
  st_name?: string;
  st_code?: string;
  status?: number;
  status_txt?: string;
  start?: number;
  score?: number[];
  teams?: Array<{ pos?: number; name?: string }>;
};

type Sport365CategoryMenu = {
  c_id?: string;
  c_name?: string;
  c_code?: string;
  stages?: Array<{
    st_id?: string;
    st_name?: string;
    st_code?: string;
  }>;
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function siteSportToApiSlug(siteSportPath: string): string {
  return SITE_SPORT_TO_API[siteSportPath] ?? siteSportPath.replace(/-/g, "_");
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSport365MatchUrl(row: Sport365StageRow): string {
  const home = row.teams?.find((t) => t.pos === 0)?.name ?? "home";
  const away = row.teams?.find((t) => t.pos === 1)?.name ?? "away";
  const slug = `${slugifyName(home)}-vs-${slugifyName(away)}`;
  const category = row.c_code ?? "competition";
  const stage = row.st_code ?? "stage";
  return `https://www.sport365.com/rugby-union/${category}/${stage}/${slug}/${row.id}`;
}

export function parseSport365ListMatch(row: Sport365StageRow): Sport365CompetitionMatch | null {
  const home = row.teams?.find((t) => t.pos === 0)?.name?.trim();
  const away = row.teams?.find((t) => t.pos === 1)?.name?.trim();
  if (!home || !away || !row.id) return null;

  const score = Array.isArray(row.score) ? row.score : [];
  const statusCode = asNumber(row.status);
  const statusText = typeof row.status_txt === "string" ? row.status_txt : undefined;

  return {
    matchId: row.id,
    sourceUrl: buildSport365MatchUrl(row),
    homeTeam: home,
    awayTeam: away,
    homeScore: asNumber(score[0]) ?? 0,
    awayScore: asNumber(score[1]) ?? 0,
    status: sport365StatusLabel(statusCode, statusText),
    competition: row.c_name ?? "Unknown",
    stageName: row.st_name ?? "",
    kickoffAt: parseSport365StartTimestamp(row.start),
    suggestedSlug: `${slugifyName(home)}-v-${slugifyName(away)}`,
  };
}

export function parseSport365CompetitionUrl(input: string): {
  sportPath: string;
  categoryCode: string;
  stageCode: string;
  sourceUrl: string;
} {
  const url = new URL(input.trim().replace(/#.*$/, ""));
  if (url.protocol !== "https:") throw new Error("Sport365 URL must use https.");
  if (!/(^|\.)sport365\.com$/i.test(url.hostname)) {
    throw new Error("Only sport365.com URLs are allowed.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "rugby-union") {
    throw new Error("Competition URL must look like /rugby-union/{category}/{stage}");
  }

  const last = parts.at(-1) ?? "";
  if (/^\d+-\d+$/.test(last)) {
    throw new Error("This is a single-match URL. Use match import or pick a competition page URL.");
  }

  return {
    sportPath: parts[0],
    categoryCode: parts[1],
    stageCode: parts[2],
    sourceUrl: url.toString(),
  };
}

export function isSport365MatchUrl(input: string): boolean {
  try {
    const normalized = input.trim().replace(/#.*$/, "");
    assertSport365RugbyMatchUrl(normalized);
    extractSport365MatchId(normalized);
    return true;
  } catch {
    return false;
  }
}

export function isSport365CompetitionUrl(input: string): boolean {
  try {
    parseSport365CompetitionUrl(input);
    return true;
  } catch {
    return false;
  }
}

async function fetchSport365ApiJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${SPORT365_API}${path}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Rugby365MatchOperatorAgent/0.1",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sport365 API HTTP ${res.status} for ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSport365Categories(apiSport: string) {
  return fetchSport365ApiJson<{ categories?: Sport365CategoryMenu[] }>(
    `/v1/en/categories/${apiSport}/1`,
  );
}

export async function fetchSport365Stage(apiSport: string, stageId: string) {
  return fetchSport365ApiJson<{
    c_name?: string;
    st_name?: string;
    st_id?: string;
    matches?: Sport365StageRow[];
  }>(`/v1/en/stage/${apiSport}/${stageId}`);
}

export async function resolveStageId(
  apiSport: string,
  categoryCode: string,
  stageCode: string,
): Promise<{ stageId: string; competitionName: string; stageName: string }> {
  const menu = await fetchSport365Categories(apiSport);
  const categories = menu.categories ?? [];
  const category = categories.find((c) => c.c_code === categoryCode);
  if (!category) {
    throw new Error(`Competition “${categoryCode}” not found on Sport365.`);
  }
  const stage = category.stages?.find((s) => s.st_code === stageCode);
  if (!stage?.st_id) {
    throw new Error(`Stage “${stageCode}” not found under ${category.c_name ?? categoryCode}.`);
  }
  return {
    stageId: stage.st_id,
    competitionName: category.c_name ?? categoryCode,
    stageName: stage.st_name ?? stageCode,
  };
}

export async function previewSport365Tournament(sourceUrl: string): Promise<Sport365TournamentPreview> {
  const parsed = parseSport365CompetitionUrl(sourceUrl);
  const apiSport = siteSportToApiSlug(parsed.sportPath);
  const resolved = await resolveStageId(apiSport, parsed.categoryCode, parsed.stageCode);
  const stage = await fetchSport365Stage(apiSport, resolved.stageId);
  const rows = Array.isArray(stage.matches) ? stage.matches : [];
  const matches = rows
    .map(parseSport365ListMatch)
    .filter((m): m is Sport365CompetitionMatch => m !== null)
    .sort((a, b) => {
      const ak = a.kickoffAt ?? "";
      const bk = b.kickoffAt ?? "";
      return ak.localeCompare(bk) || a.homeTeam.localeCompare(b.homeTeam);
    });

  return {
    kind: "tournament",
    sourceUrl: parsed.sourceUrl,
    sportPath: parsed.sportPath,
    categoryCode: parsed.categoryCode,
    stageCode: parsed.stageCode,
    competitionName: stage.c_name ?? resolved.competitionName,
    stageName: stage.st_name ?? resolved.stageName,
    stageId: resolved.stageId,
    matches,
  };
}

export async function listSport365Tournaments(apiSport = "rugby_union") {
  const menu = await fetchSport365Categories(apiSport);
  const items: Array<{
    categoryCode: string;
    categoryName: string;
    stageCode: string;
    stageName: string;
    stageId: string;
    sourceUrl: string;
  }> = [];

  for (const category of menu.categories ?? []) {
    if (!category.c_code) continue;
    for (const stage of category.stages ?? []) {
      if (!stage.st_code || !stage.st_id) continue;
      items.push({
        categoryCode: category.c_code,
        categoryName: category.c_name ?? category.c_code,
        stageCode: stage.st_code,
        stageName: stage.st_name ?? stage.st_code,
        stageId: stage.st_id,
        sourceUrl: `https://www.sport365.com/rugby-union/${category.c_code}/${stage.st_code}`,
      });
    }
  }

  return items.sort((a, b) =>
    `${a.categoryName} ${a.stageName}`.localeCompare(`${b.categoryName} ${b.stageName}`),
  );
}
