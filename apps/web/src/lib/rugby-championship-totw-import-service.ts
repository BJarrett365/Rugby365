import "server-only";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  emptyParsedPlayerMatchPerformance,
  fetchSdmsLineups,
  fetchWikipediaSeasonPage,
  isRugbyChampionshipNation,
  jerseyToPositionName,
  mapSdmsLineups,
  parseWikipediaChampionshipMatchLineups,
} from "@rugby365/import-sdk";
import {
  competitionSeasons,
  competitions,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { SDMS_PROVIDER, syncFixtureSquad } from "./entity-resolve-service";
import { upsertMatchPerformanceStat } from "./player-season-stats-service";
import { rugbyChampionshipParticipantTeamKey } from "./rugby-championship-lineage";
import { teamScoringBucket } from "./team-match-event-scoring";

const WIKI_PAGES: Record<number, string[]> = {
  2020: ["2020 Tri Nations Series", "2020 Rugby Championship"],
};

function wikiTitles(year: number): string[] {
  return WIKI_PAGES[year] ?? [`${year} Rugby Championship`];
}

function dayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function looksSdmsId(id: string | null | undefined): boolean {
  return Boolean(id && /^[a-z0-9]{6,12}$/i.test(id) && !id.includes(":"));
}

export type RugbyChampionshipTotwImportResult = {
  year: number;
  wikipediaMatches: number;
  wikipediaPlayers: number;
  sdmsMatches: number;
  sdmsPlayers: number;
  statsUpserted: number;
  warnings: string[];
};

async function loadChampionshipFixtures(year: number) {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "rugby-championship"))
    .limit(1);
  if (!competition) throw new Error("rugby-championship competition not found");
  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!season) throw new Error(`Season ${year} not found`);

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const rows = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: homeTeams.name,
      awayName: awayTeams.name,
      competitionId: fixtures.competitionId,
      seasonId: fixtures.seasonId,
    })
    .from(fixtures)
    .innerJoin(homeTeams, eq(homeTeams.id, fixtures.homeTeamId))
    .innerJoin(awayTeams, eq(awayTeams.id, fixtures.awayTeamId))
    .where(and(eq(fixtures.competitionId, competition.id), eq(fixtures.seasonId, season.id)));

  return {
    competition,
    season,
    fixtures: rows.filter(
      (row) => isRugbyChampionshipNation(row.homeName) && isRugbyChampionshipNation(row.awayName),
    ),
  };
}

function toSquad(side: {
  teamName: string;
  players: Array<{
    jerseyNumber: number;
    playerName: string;
    playerLabel: string;
    squadRole: "starting" | "substitute";
  }>;
}) {
  const mapped = side.players.map((player) => ({
    providerId: "",
    name: player.playerLabel || player.playerName,
    jerseyNumber: player.jerseyNumber,
    positionName: jerseyToPositionName(player.jerseyNumber),
  }));
  return {
    teamName: side.teamName,
    starting: mapped.filter((p) => p.jerseyNumber <= 15),
    substitutes: mapped.filter((p) => p.jerseyNumber > 15),
  };
}

export async function importRugbyChampionshipWikipediaLineups(
  year: number,
): Promise<{ matched: number; players: number; warnings: string[] }> {
  const warnings: string[] = [];
  let wikitext = "";
  for (const title of wikiTitles(year)) {
    try {
      const page = await fetchWikipediaSeasonPage(title);
      wikitext = page.wikitext;
      break;
    } catch (error) {
      warnings.push(`${title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!wikitext) return { matched: 0, players: 0, warnings };

  const lineups = parseWikipediaChampionshipMatchLineups(wikitext);
  const { fixtures: seasonFixtures } = await loadChampionshipFixtures(year);
  let matched = 0;
  let players = 0;

  for (const match of lineups) {
    const fixture = seasonFixtures.find((row) => {
      if (rugbyChampionshipParticipantTeamKey(row.homeName) !== rugbyChampionshipParticipantTeamKey(match.homeTeam)) {
        return false;
      }
      if (rugbyChampionshipParticipantTeamKey(row.awayName) !== rugbyChampionshipParticipantTeamKey(match.awayTeam)) {
        return false;
      }
      const fixtureDay = dayKey(row.kickoffAt);
      if (!match.date || !fixtureDay) return true;
      return Math.abs(new Date(`${match.date}T00:00:00Z`).getTime() - new Date(`${fixtureDay}T00:00:00Z`).getTime()) <= 86400000;
    });
    if (!fixture?.homeTeamId || !fixture.awayTeamId) {
      warnings.push(`No fixture for ${match.date ?? "?"} ${match.homeTeam} v ${match.awayTeam}`);
      continue;
    }
    const synced = await syncFixtureSquad(
      fixture.id,
      { home: toSquad(match.home), away: toSquad(match.away) },
      fixture.homeTeamId,
      fixture.awayTeamId,
      { sourceProvider: "wikipedia" },
    );
    matched += 1;
    players += synced;

    const minutes = new Map<string, number>();
    for (const side of [match.home, match.away]) {
      const teamId = side === match.home ? fixture.homeTeamId : fixture.awayTeamId;
      for (const player of side.players) {
        minutes.set(`${teamId}:${player.playerLabel.toLowerCase()}`, player.minutesPlayed);
      }
    }
    await upsertLineupScoringStats({
      fixtureId: fixture.id,
      seasonId: fixture.seasonId,
      competitionId: fixture.competitionId,
      externalMatchId: fixture.externalMatchId ?? `wiki-totw:${fixture.id}`,
      minutesByLabel: minutes,
    });
  }

  return { matched, players, warnings };
}

async function upsertLineupScoringStats(input: {
  fixtureId: string;
  seasonId: string | null;
  competitionId: string | null;
  externalMatchId: string;
  minutesByLabel: Map<string, number>;
}): Promise<number> {
  const db = getDb();
  const [existingSdms] = await db
    .select({ id: playerMatchPerformanceStats.id })
    .from(playerMatchPerformanceStats)
    .where(
      and(
        eq(playerMatchPerformanceStats.fixtureId, input.fixtureId),
        eq(playerMatchPerformanceStats.sourceProvider, "sdms"),
      ),
    )
    .limit(1);
  if (existingSdms) return 0;

  const { fixturePlayers, players } = await import("@rugby365/db");
  const squad = await db
    .select({
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      jerseyNumber: fixturePlayers.jerseyNumber,
      playerName: players.name,
      externalPlayerId: players.externalProviderId,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(eq(fixturePlayers.fixtureId, input.fixtureId));

  const events = await db
    .select({
      playerId: matchEvents.playerId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
      payload: matchEvents.payload,
    })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, input.fixtureId));

  const scoring = new Map<string, { tries: number; conversions: number; penalties: number; dropGoals: number }>();
  for (const event of events) {
    const bucket = teamScoringBucket(event.eventType);
    if (!bucket || !event.playerId) continue;
    const acc = scoring.get(event.playerId) ?? { tries: 0, conversions: 0, penalties: 0, dropGoals: 0 };
    if (bucket === "try") acc.tries += 1;
    else if (bucket === "conversion") acc.conversions += 1;
    else if (bucket === "penalty") acc.penalties += 1;
    else acc.dropGoals += 1;
    scoring.set(event.playerId, acc);
  }

  let upserted = 0;
  for (const row of squad) {
    const mins =
      [...input.minutesByLabel.entries()].find(([key]) =>
        key.endsWith(`:${row.playerName.trim().toLowerCase()}`),
      )?.[1] ?? (row.jerseyNumber != null && row.jerseyNumber <= 15 ? 80 : 0);
    if (mins < 1) continue;
    const sc = scoring.get(row.playerId) ?? { tries: 0, conversions: 0, penalties: 0, dropGoals: 0 };
    const points = sc.tries * 5 + sc.conversions * 2 + sc.penalties * 3 + sc.dropGoals * 3;
    const base = emptyParsedPlayerMatchPerformance(
      row.externalPlayerId ?? row.playerId,
      row.playerName,
    );
    await upsertMatchPerformanceStat({
      fixtureId: input.fixtureId,
      playerId: row.playerId,
      teamId: row.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      externalMatchId: input.externalMatchId,
      externalPlayerId: row.externalPlayerId ?? row.playerId,
      stats: {
        ...base,
        minutesPlayed: mins,
        tries: sc.tries,
        points,
      },
      sourceProvider: "scoring_events",
      skipBioRefresh: true,
    });
    upserted += 1;
  }
  return upserted;
}

export async function importRugbyChampionshipSdmsLineups(
  year: number,
): Promise<{ matched: number; players: number; warnings: string[] }> {
  const warnings: string[] = [];
  const { fixtures: seasonFixtures } = await loadChampionshipFixtures(year);
  let matched = 0;
  let players = 0;
  for (const fixture of seasonFixtures) {
    const matchId = fixture.externalMatchId;
    if (!looksSdmsId(matchId) || !fixture.homeTeamId || !fixture.awayTeamId) continue;
    try {
      const raw = await fetchSdmsLineups(matchId, { timeoutMs: 20000 });
      if (!raw) {
        warnings.push(`No SDMS lineup for ${matchId}`);
        continue;
      }
      const mapped = mapSdmsLineups(raw, fixture.homeName, fixture.awayName);
      const synced = await syncFixtureSquad(
        fixture.id,
        mapped,
        fixture.homeTeamId,
        fixture.awayTeamId,
        { sourceProvider: SDMS_PROVIDER },
      );
      matched += 1;
      players += synced;
      const db = getDb();
      const [sdmsPerf] = await db
        .select({ id: playerMatchPerformanceStats.id })
        .from(playerMatchPerformanceStats)
        .where(
          and(
            eq(playerMatchPerformanceStats.fixtureId, fixture.id),
            eq(playerMatchPerformanceStats.sourceProvider, "sdms"),
          ),
        )
        .limit(1);
      if (!sdmsPerf) {
        await upsertLineupScoringStats({
          fixtureId: fixture.id,
          seasonId: fixture.seasonId,
          competitionId: fixture.competitionId,
          externalMatchId: fixture.externalMatchId ?? fixture.id,
          minutesByLabel: new Map(),
        });
      }
    } catch (error) {
      warnings.push(`${matchId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { matched, players, warnings };
}

export async function importRugbyChampionshipTotwInputs(
  year: number,
): Promise<RugbyChampionshipTotwImportResult> {
  const warnings: string[] = [];
  let wikipediaMatches = 0;
  let wikipediaPlayers = 0;
  let sdmsMatches = 0;
  let sdmsPlayers = 0;
  let statsUpserted = 0;

  if (year <= 2020) {
    const wiki = await importRugbyChampionshipWikipediaLineups(year);
    wikipediaMatches = wiki.matched;
    wikipediaPlayers = wiki.players;
    statsUpserted = wiki.players;
    warnings.push(...wiki.warnings);
  } else {
    const sdms = await importRugbyChampionshipSdmsLineups(year);
    sdmsMatches = sdms.matched;
    sdmsPlayers = sdms.players;
    warnings.push(...sdms.warnings);
    if (sdms.players === 0) {
      const wiki = await importRugbyChampionshipWikipediaLineups(year);
      wikipediaMatches = wiki.matched;
      wikipediaPlayers = wiki.players;
      statsUpserted = wiki.players;
      warnings.push(...wiki.warnings);
    }
  }

  return {
    year,
    wikipediaMatches,
    wikipediaPlayers,
    sdmsMatches,
    sdmsPlayers,
    statsUpserted,
    warnings,
  };
}
