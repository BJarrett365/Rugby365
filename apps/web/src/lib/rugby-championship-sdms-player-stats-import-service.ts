import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  buildPlanetRugbyMatchUrl,
  fetchSdmsResults,
  isRugbyChampionshipNation,
  type SdmsFixtureRow,
} from "@rugby365/import-sdk";
import { competitions, competitionSeasons, fixtures } from "@rugby365/db";
import { getDb } from "./db";
import { resolveTeam } from "./entity-resolve-service";
import { importMatchPerformanceStats } from "./planet-rugby-player-stats-import-service";

const SLUG = "rugby-championship";
const SDMS_COMP = "4wjxn9pv";

export type RugbyChampionshipSdmsStatsImportResult = {
  year: number;
  sdmsMatches: number;
  fixturesMatched: number;
  playersImported: number;
  unmatched: string[];
  errors: string[];
};

function dayWindow(dateIso: string): { from: Date; to: Date } {
  const noon = new Date(`${dateIso}T12:00:00Z`);
  const ms = 40 * 60 * 60 * 1000;
  return { from: new Date(noon.getTime() - ms), to: new Date(noon.getTime() + ms) };
}

function planetUrl(row: SdmsFixtureRow): string {
  return buildPlanetRugbyMatchUrl({
    match_external_id: row.match_id,
    competition_slug: SLUG,
    competition_external_id: row.competition_id ?? SDMS_COMP,
    home_team: row.home_team_slug,
    away_team: row.away_team_slug,
    match_date: row.date,
  });
}

async function findFixtureForRow(
  row: SdmsFixtureRow,
  competitionId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  const db = getDb();
  const [byExternal] = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.externalMatchId, row.match_id))
    .limit(1);
  if (byExternal) return byExternal;

  const { from, to } = dayWindow(row.date);
  const candidates = await db
    .select()
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, competitionId),
        eq(fixtures.homeTeamId, homeTeamId),
        eq(fixtures.awayTeamId, awayTeamId),
        gte(fixtures.kickoffAt, from),
        lte(fixtures.kickoffAt, to),
      ),
    );
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) {
    const target = new Date(`${row.date}T12:00:00Z`).getTime();
    return [...candidates].sort((a, b) => {
      const da = Math.abs((a.kickoffAt?.getTime() ?? 0) - target);
      const dbTime = Math.abs((b.kickoffAt?.getTime() ?? 0) - target);
      return da - dbTime;
    })[0]!;
  }
  return null;
}

export async function importRugbyChampionshipSdmsPlayerStats(
  year: number,
): Promise<RugbyChampionshipSdmsStatsImportResult> {
  const unmatched: string[] = [];
  const errors: string[] = [];
  const db = getDb();

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, SLUG))
    .limit(1);
  if (!competition) throw new Error("rugby-championship competition not found");

  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!season) throw new Error(`Season ${year} not found for rugby-championship`);

  const rows = (await fetchSdmsResults(competition.sdmsCompCode ?? SDMS_COMP, String(year), 50)) ?? [];
  const championshipRows = rows.filter(
    (row) =>
      row.status === "Result" &&
      isRugbyChampionshipNation(row.home_team_name) &&
      isRugbyChampionshipNation(row.away_team_name),
  );

  let fixturesMatched = 0;
  let playersImported = 0;

  for (const row of championshipRows) {
    const homeTeam = await resolveTeam({
      name: row.home_team_name,
      externalProviderId: row.home_team_id,
      createIfMissing: false,
      sourceProvider: "sdms",
    });
    const awayTeam = await resolveTeam({
      name: row.away_team_name,
      externalProviderId: row.away_team_id,
      createIfMissing: false,
      sourceProvider: "sdms",
    });
    if (!homeTeam || !awayTeam) {
      unmatched.push(`${row.date} ${row.home_team_name} v ${row.away_team_name} (teams)`);
      continue;
    }

    const fixture = await findFixtureForRow(row, competition.id, homeTeam.id, awayTeam.id);
    if (!fixture) {
      unmatched.push(`${row.date} ${row.home_team_name} v ${row.away_team_name}`);
      continue;
    }
    fixturesMatched += 1;

    await db
      .update(fixtures)
      .set({
        externalMatchId: row.match_id,
        planetRugbyUrl: planetUrl(row),
        seasonId: fixture.seasonId ?? season.id,
      })
      .where(eq(fixtures.id, fixture.id));

    try {
      const stats = await importMatchPerformanceStats(fixture.id, row.match_id);
      playersImported += stats.playersProcessed;
    } catch (error) {
      errors.push(
        `${row.date} ${row.home_team_name} v ${row.away_team_name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return {
    year,
    sdmsMatches: championshipRows.length,
    fixturesMatched,
    playersImported,
    unmatched,
    errors,
  };
}

export async function importRugbyChampionshipSdmsPlayerStatsRange(
  fromYear: number,
  toYear: number,
): Promise<RugbyChampionshipSdmsStatsImportResult[]> {
  const results: RugbyChampionshipSdmsStatsImportResult[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    results.push(await importRugbyChampionshipSdmsPlayerStats(year));
  }
  return results;
}
