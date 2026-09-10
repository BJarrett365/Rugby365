import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  extractTemplateBlocks,
  fetchWikipediaSeasonPage,
  isRugbyChampionshipNation,
  mergeWikipediaSeasonStatRows,
  parseRugbyboxScoringBlock,
  parseTemplateParams,
  parseWikiDate,
  parseWikipediaScorerWikitable,
  seasonStatsFromRugbyboxScoring,
  type WikipediaRugbyboxScoring,
} from "@rugby365/import-sdk";
import {
  competitionSeasons,
  competitions,
  fixtures,
  matchEvents,
  playerSeasonStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { matchScorerToCandidates } from "./event-scorer-match";
import { resolvePlayer } from "./entity-resolve-service";

const WIKI_EVENT_SOURCE = "wikipedia-rugby-box";
const WIKI_STATS_SOURCE = "wikipedia";

const PAGE_TITLES: Record<number, string[]> = {
  2020: ["2020 Rugby Championship", "2020 Tri Nations Series"],
};

export type RugbyChampionshipWikipediaImportResult = {
  year: number;
  pageTitle: string;
  fixturesMatched: number;
  eventsInserted: number;
  seasonStatsUpserted: number;
  unmatchedBoxes: number;
  warnings: string[];
};

function wikiPageTitles(year: number): string[] {
  return PAGE_TITLES[year] ?? [`${year} Rugby Championship`];
}

function dayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function teamKey(name: string): string {
  return name.trim().toLowerCase();
}

function daysApart(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime());
  return Math.round(ms / 86_400_000);
}

export async function importRugbyChampionshipWikipediaScoring(
  year: number,
): Promise<RugbyChampionshipWikipediaImportResult> {
  const warnings: string[] = [];
  let pageTitle = "";
  let wikitext = "";
  for (const title of wikiPageTitles(year)) {
    try {
      const page = await fetchWikipediaSeasonPage(title);
      pageTitle = page.pageTitle;
      wikitext = page.wikitext;
      break;
    } catch (error) {
      warnings.push(`${title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!wikitext) {
    throw new Error(`No Wikipedia season page found for Rugby Championship ${year}`);
  }

  const boxes: WikipediaRugbyboxScoring[] = [];
  for (const templateName of ["Rugbybox", "Rugbybox2"]) {
    for (const block of extractTemplateBlocks(wikitext, templateName)) {
      const params = parseTemplateParams(block);
      const parsed = parseRugbyboxScoringBlock(params, parseWikiDate(params.date));
      if (parsed) boxes.push(parsed);
    }
  }

  const statsRows = mergeWikipediaSeasonStatRows(
    [
      ...parseWikipediaScorerWikitable(wikitext, "tries"),
      ...parseWikipediaScorerWikitable(wikitext, "points"),
      ...seasonStatsFromRugbyboxScoring(boxes),
    ],
    [],
  );

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
    .where(
      and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)),
    )
    .limit(1);
  if (!season) throw new Error(`Season ${year} not found for rugby-championship`);

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: homeTeams.name,
      awayName: awayTeams.name,
    })
    .from(fixtures)
    .innerJoin(homeTeams, eq(homeTeams.id, fixtures.homeTeamId))
    .innerJoin(awayTeams, eq(awayTeams.id, fixtures.awayTeamId))
    .where(and(eq(fixtures.competitionId, competition.id), eq(fixtures.seasonId, season.id)));

  const championshipFixtures = fixtureRows.filter(
    (row) => isRugbyChampionshipNation(row.homeName) && isRugbyChampionshipNation(row.awayName),
  );

  const teamIds = [
    ...new Set(
      championshipFixtures.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter(Boolean),
    ),
  ] as string[];

  const squadRows = teamIds.length
    ? await db
        .select({
          id: players.id,
          name: players.name,
          slug: players.slug,
          imageUrl: players.imageUrl,
          teamId: players.internationalTeamId,
        })
        .from(players)
        .where(inArray(players.internationalTeamId, teamIds))
    : [];
  const squadByTeam = new Map<string, typeof squadRows>();
  for (const row of squadRows) {
    if (!row.teamId) continue;
    const list = squadByTeam.get(row.teamId) ?? [];
    list.push(row);
    squadByTeam.set(row.teamId, list);
  }

  const teamNameToId = new Map<string, string>();
  for (const row of championshipFixtures) {
    if (row.homeTeamId) teamNameToId.set(teamKey(row.homeName), row.homeTeamId);
    if (row.awayTeamId) teamNameToId.set(teamKey(row.awayName), row.awayTeamId);
  }

  async function resolveScorer(name: string, teamId: string) {
    const matched = matchScorerToCandidates(name, squadByTeam.get(teamId) ?? []);
    if (matched) {
      return { id: matched.id, name: matched.name, slug: matched.slug, imageUrl: matched.imageUrl };
    }
    return resolvePlayer({
      name,
      internationalTeamId: teamId,
      createIfMissing: true,
      skipArchiveEnrich: true,
      sourceProvider: WIKI_STATS_SOURCE,
    });
  }

  let fixturesMatched = 0;
  let eventsInserted = 0;
  let unmatchedBoxes = 0;

  for (const box of boxes) {
    const fixture = championshipFixtures.find((row) => {
      if (teamKey(row.homeName) !== teamKey(box.homeTeam)) return false;
      if (teamKey(row.awayName) !== teamKey(box.awayTeam)) return false;
      const fixtureDay = dayKey(row.kickoffAt);
      if (!box.date || !fixtureDay) return true;
      return daysApart(box.date, fixtureDay) <= 1;
    });
    if (!fixture?.homeTeamId || !fixture.awayTeamId) {
      unmatchedBoxes += 1;
      warnings.push(`No fixture for ${box.date ?? "?"} ${box.homeTeam} v ${box.awayTeam}`);
      continue;
    }
    fixturesMatched += 1;

    const [existingWiki] = await db
      .select({ id: matchEvents.id })
      .from(matchEvents)
      .where(
        and(eq(matchEvents.fixtureId, fixture.id), eq(matchEvents.sourceProvider, WIKI_EVENT_SOURCE)),
      )
      .limit(1);
    if (existingWiki) continue;

    const [last] = await db
      .select({ sequenceNo: matchEvents.sequenceNo })
      .from(matchEvents)
      .where(eq(matchEvents.fixtureId, fixture.id))
      .orderBy(desc(matchEvents.sequenceNo))
      .limit(1);
    let sequenceNo = last?.sequenceNo ?? 0;
    const values = [];

    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
      for (const entry of box[side]) {
        const player = await resolveScorer(entry.playerName, teamId);
        for (let i = 0; i < entry.count; i += 1) {
          sequenceNo += 1;
          values.push({
            fixtureId: fixture.id,
            eventType: entry.kind,
            minute: 0,
            second: 0,
            teamId,
            playerId: player?.id ?? null,
            payload: {
              source: WIKI_EVENT_SOURCE,
              teamSide: side,
              playerName: entry.playerLabel || entry.playerName,
              player: entry.playerName,
            },
            sourceProvider: WIKI_EVENT_SOURCE,
            sequenceNo,
          });
        }
      }
    }

    if (values.length) {
      await db.insert(matchEvents).values(values);
      eventsInserted += values.length;
    }
  }

  let seasonStatsUpserted = 0;
  for (const row of statsRows) {
    const teamId = teamNameToId.get(teamKey(row.teamName));
    if (!teamId) {
      warnings.push(`No team id for ${row.teamName} (${row.playerName})`);
      continue;
    }
    const player = await resolveScorer(row.playerName, teamId);
    if (!player?.id) {
      warnings.push(`Could not resolve ${row.playerName}`);
      continue;
    }

    const [existing] = await db
      .select()
      .from(playerSeasonStats)
      .where(
        and(
          eq(playerSeasonStats.playerId, player.id),
          eq(playerSeasonStats.seasonId, season.id),
          eq(playerSeasonStats.teamId, teamId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(playerSeasonStats)
        .set({
          tries: Math.max(existing.tries ?? 0, row.tries),
          points: Math.max(existing.points ?? 0, row.points),
          syncedAt: new Date(),
        })
        .where(eq(playerSeasonStats.id, existing.id));
    } else {
      // Scoring tables do not record appearances. Leave apps at 0 so profile
      // overlays skip the row until a verified appearance total is written.
      await db.insert(playerSeasonStats).values({
        playerId: player.id,
        seasonId: season.id,
        competitionId: competition.id,
        teamId,
        appearances: 0,
        tries: row.tries,
        points: row.points,
        sourceProvider: WIKI_STATS_SOURCE,
        syncedAt: new Date(),
      });
    }
    seasonStatsUpserted += 1;
  }

  return {
    year,
    pageTitle,
    fixturesMatched,
    eventsInserted,
    seasonStatsUpserted,
    unmatchedBoxes,
    warnings,
  };
}

export async function importRugbyChampionshipWikipediaScoringRange(
  fromYear: number,
  toYear: number,
): Promise<RugbyChampionshipWikipediaImportResult[]> {
  const results: RugbyChampionshipWikipediaImportResult[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    results.push(await importRugbyChampionshipWikipediaScoring(year));
  }
  return results;
}
