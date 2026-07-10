import { parseLiveSportCompetitionUrl } from "./parse-url";
import { buildLiveSportSeasonPathSlug } from "./season-url";
import { parseLiveSportPage } from "./parse-feed";
import type { LiveSportTournamentPreview } from "./types";

const USER_AGENT = "Rugby365Import/1.0 (+https://rugby365.com)";

function titleCaseCompetition(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function seasonLabelFromHtml(html: string): string | null {
  const match = html.match(/id="season_url"[^>]*>([^<]+)</i);
  return match?.[1]?.trim() ?? null;
}

export async function fetchLiveSportHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`LiveSport HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function resolveLiveSportSeasonUrl(sourceUrl: string, seasonLabel: string): string {
  const parsed = parseLiveSportCompetitionUrl(sourceUrl);
  const url = new URL(parsed.sourceUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const sportIndex = parts.findIndex((part) => part === "rugby-union");
  const region = parts[sportIndex + 1] ?? "europe";
  const slug = buildLiveSportSeasonPathSlug(parsed.competitionSlug, seasonLabel);
  url.pathname = `/${parts[0] ?? "uk"}/rugby-union/${region}/${slug}/`;
  return url.toString();
}

export async function previewLiveSportTournament(
  sourceUrl: string,
  options: { seasonLabel?: string } = {},
): Promise<LiveSportTournamentPreview> {
  const parsed = parseLiveSportCompetitionUrl(sourceUrl);
  const initialHtml = await fetchLiveSportHtml(parsed.sourceUrl);
  const pageSeason = parsed.seasonLabel ?? seasonLabelFromHtml(initialHtml);
  const seasonLabel = options.seasonLabel ?? pageSeason;

  let fetchUrl = parsed.sourceUrl;
  if (seasonLabel && !parsed.seasonLabel) {
    fetchUrl = resolveLiveSportSeasonUrl(parsed.sourceUrl, seasonLabel);
  } else if (parsed.seasonLabel) {
    fetchUrl = parsed.sourceUrl;
  }

  const html = fetchUrl === parsed.sourceUrl ? initialHtml : await fetchLiveSportHtml(fetchUrl);
  const resolvedSeason = seasonLabel ?? seasonLabelFromHtml(html) ?? new Date().getFullYear().toString();

  const meta = {
    competitionName: titleCaseCompetition(parsed.competitionSlug),
    competitionSlug: parsed.competitionSlug,
    seasonLabel: resolvedSeason,
    tournamentId: null,
    seasonTournamentId: null,
    sourceUrl: fetchUrl,
    pagePath: new URL(fetchUrl).pathname,
  };

  return parseLiveSportPage(html, meta);
}
