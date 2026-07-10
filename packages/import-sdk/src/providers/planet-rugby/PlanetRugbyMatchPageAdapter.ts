import type {
  PlanetRugbyFixturesPageData,
  PlanetRugbyMatchPageData,
  PlanetRugbyPageSection,
  PlanetRugbyTournamentPageData,
} from "../types";
import {
  assertPlanetRugbyUrl,
  isPlanetRugbyFixturesUrl,
  isPlanetRugbyMatchUrl,
  isPlanetRugbyTournamentUrl,
  parsePlanetRugbyMatchUrl,
  parsePlanetRugbyTournamentUrl,
} from "./parse-url";
import { parsePlanetRugbyFixturesPageHtml, parsePlanetRugbyMatchPageHtml, parsePlanetRugbyTournamentPageHtml } from "./parse-page";
import {
  combineKickoffIso,
  fetchSdmsActiveSeason,
  fetchSdmsFixtures,
  fetchSdmsMatchDetail,
  fetchSdmsResults,
  fetchSdmsSeasons,
  fetchSdmsTable,
  sdmsStatusToMatchStatus,
} from "./sdms-fetch";

const FETCH_MS = 20_000;

export type PlanetRugbyAdapterOptions = {
  html?: string;
  /** Enrich widget sections via SDMS (Planet Rugby widgets use SDMS APIs). */
  enrichSdms?: boolean;
  sectionItemCount?: number;
  /** SDMS season year (e.g. 2025) for table/fixture/result counts. */
  seasonLabel?: string;
};

export class PlanetRugbyMatchPageAdapter {
  readonly provider = "planet_rugby" as const;

  async fetchHtml(sourceUrl: string): Promise<string> {
    const url = assertPlanetRugbyUrl(sourceUrl).toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Rugby365ImportSdk/0.1 (PlanetRugbyMatchPageAdapter)",
        },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Planet Rugby HTTP ${res.status}`);
      return res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async adaptMatchPage(sourceUrl: string, options: PlanetRugbyAdapterOptions = {}): Promise<PlanetRugbyMatchPageData> {
    if (!isPlanetRugbyMatchUrl(sourceUrl)) {
      throw new Error("Not a Planet Rugby match page URL.");
    }
    const url = parsePlanetRugbyMatchUrl(sourceUrl);
    const html = options.html ?? (await this.fetchHtml(sourceUrl));
    const parsed = parsePlanetRugbyMatchPageHtml(html, sourceUrl, url);

    const data: PlanetRugbyMatchPageData = {
      provider: "planet_rugby",
      sourceUrl,
      url,
      fetchedAt: new Date().toISOString(),
      ...parsed,
    };

    if (options.enrichSdms !== false) {
      await this.enrichMatchSections(data, options.sectionItemCount ?? 5);
    }

    return data;
  }

  async adaptFixturesPage(
    sourceUrl = "https://www.planetrugby.com/fixtures",
    options: PlanetRugbyAdapterOptions = {},
  ): Promise<PlanetRugbyFixturesPageData> {
    if (!isPlanetRugbyFixturesUrl(sourceUrl)) {
      throw new Error("Not a Planet Rugby fixtures page URL.");
    }
    const html = options.html ?? (await this.fetchHtml(sourceUrl));
    const parsed = parsePlanetRugbyFixturesPageHtml(html, sourceUrl);
    return {
      provider: "planet_rugby",
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      ...parsed,
    };
  }

  async adaptTournamentPage(
    sourceUrl: string,
    options: PlanetRugbyAdapterOptions = {},
  ): Promise<PlanetRugbyTournamentPageData> {
    if (!isPlanetRugbyTournamentUrl(sourceUrl)) {
      throw new Error("Not a Planet Rugby tournament page URL.");
    }
    const { competitionSlug, pageType } = parsePlanetRugbyTournamentUrl(sourceUrl);
    const html = options.html ?? (await this.fetchHtml(sourceUrl));
    const parsed = parsePlanetRugbyTournamentPageHtml(html, sourceUrl, competitionSlug, pageType);

    const data: PlanetRugbyTournamentPageData = {
      provider: "planet_rugby",
      kind: "tournament",
      sourceUrl,
      competitionSlug,
      pageType,
      competitionName: parsed.competitionName,
      sdmsCompCode: parsed.sdmsCompCode,
      fetchedAt: new Date().toISOString(),
    };

    if (options.enrichSdms !== false && parsed.sdmsCompCode) {
      const seasons = await fetchSdmsSeasons(parsed.sdmsCompCode);
      data.seasons = seasons?.seasons ?? [];
      data.activeSeason = seasons?.activeSeason ?? seasons?.currentSeason ?? null;

      const seasonForCounts =
        options.seasonLabel ?? data.activeSeason ?? seasons?.currentSeason ?? data.seasons.at(-1) ?? null;

      if (seasonForCounts) {
        const [table, fixtures, results] = await Promise.all([
          fetchSdmsTable(parsed.sdmsCompCode, seasonForCounts),
          fetchSdmsFixtures(parsed.sdmsCompCode, seasonForCounts),
          fetchSdmsResults(parsed.sdmsCompCode, seasonForCounts),
        ]);
        data.tableRowCount = table?.length ?? 0;
        data.fixtureCount = fixtures?.length ?? 0;
        data.resultCount = results?.length ?? 0;
      }
    }

    return data;
  }

  private async enrichMatchSections(data: PlanetRugbyMatchPageData, count: number): Promise<void> {
    const matchId = data.sdmsMatchId ?? data.url.match_external_id;
    const detail = await fetchSdmsMatchDetail(matchId);
    if (detail) {
      data.homeScore = detail.home_team_score;
      data.awayScore = detail.away_team_score;
      data.matchStatus = sdmsStatusToMatchStatus(detail.status);
      data.competition = detail.competition_name || data.competition;
      data.homeTeamName = detail.home_team_name;
      data.awayTeamName = detail.away_team_name;
      data.kickoffAt = combineKickoffIso(detail.date, detail.time);
      data.venue = detail.venue_name ?? data.venue;
    }

    const compCode = data.url.competition_external_id;
    const season = await fetchSdmsActiveSeason(compCode);
    if (!season) return;

    await Promise.all([
      this.fillSection(data.sections.table, () => fetchSdmsTable(compCode, season)),
      this.fillSection(data.sections.fixtures, () => fetchSdmsFixtures(compCode, season, count)),
      this.fillSection(data.sections.results, () => fetchSdmsResults(compCode, season, count)),
    ]);
  }

  private async fillSection<T extends unknown[]>(
    section: PlanetRugbyPageSection,
    loader: () => Promise<T | null>,
  ): Promise<void> {
    if (!section.present) return;
    const rows = await loader();
    if (rows) section.itemCount = rows.length;
  }
}

export const planetRugbyMatchPageAdapter = new PlanetRugbyMatchPageAdapter();
