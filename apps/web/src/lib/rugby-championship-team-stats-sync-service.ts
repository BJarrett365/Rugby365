import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitionSeasons,
  competitions,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { upsertTeamMatchStat } from "./team-match-stats-service";
import { countDedupedScoringForTeam } from "./team-match-event-scoring";
import { isRugbyChampionshipParticipantMatch } from "./rugby-championship-lineage";

export const TRC_TEAM_STATS_PROVIDER = "trc_event_rollup";
const SLUG = "rugby-championship";

export type RugbyChampionshipTeamStatsSyncResult = {
  year: number;
  fixtures: number;
  upserted: number;
  skippedIncomplete: number;
};

function numExtra(extras: unknown, key: string): number {
  if (!extras || typeof extras !== "object") return 0;
  const value = (extras as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

export async function syncRugbyChampionshipTeamMatchStats(
  year: number,
): Promise<RugbyChampionshipTeamStatsSyncResult> {
  const db = getDb();
  const [competition] = await db.select().from(competitions).where(eq(competitions.slug, SLUG)).limit(1);
  if (!competition) throw new Error("rugby-championship competition not found");

  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!season) throw new Error(`Season ${year} not found for rugby-championship`);

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const seasonFixtures = await db
    .select({
      id: fixtures.id,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeName: homeTeams.name,
      awayName: awayTeams.name,
    })
    .from(fixtures)
    .innerJoin(homeTeams, eq(homeTeams.id, fixtures.homeTeamId))
    .innerJoin(awayTeams, eq(awayTeams.id, fixtures.awayTeamId))
    .where(and(eq(fixtures.competitionId, competition.id), eq(fixtures.seasonId, season.id)));

  const realFixtures = seasonFixtures.filter(
    (row) =>
      row.homeTeamId &&
      row.awayTeamId &&
      row.homeScore != null &&
      row.awayScore != null &&
      isRugbyChampionshipParticipantMatch(row.homeName, row.awayName, year),
  );

  const fixtureIds = realFixtures.map((row) => row.id);
  if (!fixtureIds.length) {
    return { year, fixtures: 0, upserted: 0, skippedIncomplete: seasonFixtures.length };
  }

  const events = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
      minute: matchEvents.minute,
      sequenceNo: matchEvents.sequenceNo,
      sourceProvider: matchEvents.sourceProvider,
      payload: matchEvents.payload as unknown,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, fixtureIds));

  const eventTeamIds = [...new Set(events.map((event) => event.teamId).filter(Boolean))] as string[];
  const fixtureTeamIds = [
    ...new Set(realFixtures.flatMap((row) => [row.homeTeamId!, row.awayTeamId!])),
  ];
  const allTeamIds = [...new Set([...eventTeamIds, ...fixtureTeamIds])];
  const teamNameRows =
    allTeamIds.length === 0
      ? []
      : await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, allTeamIds));
  const teamNameById = new Map(teamNameRows.map((row) => [row.id, row.name.trim().toLowerCase()]));

  const eventsByFixture = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByFixture.get(event.fixtureId) ?? [];
    list.push(event);
    eventsByFixture.set(event.fixtureId, list);
  }

  const playerRows = await db
    .select({
      fixtureId: playerMatchPerformanceStats.fixtureId,
      teamId: playerMatchPerformanceStats.teamId,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      extras: playerMatchPerformanceStats.extras,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .where(inArray(playerMatchPerformanceStats.fixtureId, fixtureIds));

  const advancedByFixtureTeam = new Map<
    string,
    {
      metres: number;
      carries: number;
      tackles: number;
      turnoversWon: number;
      offloads: number;
      cleanBreaks: number;
      defendersBeaten: number;
    }
  >();
  for (const row of playerRows) {
    if (!row.fixtureId) continue;
    const key = `${row.fixtureId}:${row.teamId}`;
    const cur = advancedByFixtureTeam.get(key) ?? {
      metres: 0,
      carries: 0,
      tackles: 0,
      turnoversWon: 0,
      offloads: 0,
      cleanBreaks: 0,
      defendersBeaten: 0,
    };
    cur.metres += row.metresCarried ?? 0;
    cur.carries += row.carries ?? 0;
    cur.tackles += row.tacklesCompleted ?? 0;
    cur.turnoversWon += row.turnoversWon ?? 0;
    cur.offloads += numExtra(row.extras, "offloads");
    cur.cleanBreaks += row.lineBreaks ?? 0;
    cur.defendersBeaten += row.defendersBeaten ?? 0;
    advancedByFixtureTeam.set(key, cur);
  }

  let upserted = 0;
  let skippedIncomplete = seasonFixtures.length - realFixtures.length;

  for (const fx of realFixtures) {
    const fixtureEvents = eventsByFixture.get(fx.id) ?? [];
    const remapped = fixtureEvents.map((event) => {
      if (!event.teamId) return event;
      if (event.teamId === fx.homeTeamId || event.teamId === fx.awayTeamId) return event;
      const eventName = teamNameById.get(event.teamId);
      const homeName = teamNameById.get(fx.homeTeamId!);
      const awayName = teamNameById.get(fx.awayTeamId!);
      if (eventName && eventName === homeName) return { ...event, teamId: fx.homeTeamId };
      if (eventName && eventName === awayName) return { ...event, teamId: fx.awayTeamId };
      return event;
    });

    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? fx.homeTeamId! : fx.awayTeamId!;
      const matchPoints = side === "home" ? (fx.homeScore ?? 0) : (fx.awayScore ?? 0);
      const scoring = countDedupedScoringForTeam(remapped, teamId);
      const advanced = advancedByFixtureTeam.get(`${fx.id}:${teamId}`) ?? {
        metres: 0,
        carries: 0,
        tackles: 0,
        turnoversWon: 0,
        offloads: 0,
        cleanBreaks: 0,
        defendersBeaten: 0,
      };

      await upsertTeamMatchStat({
        fixtureId: fx.id,
        teamId,
        side,
        seasonId: season.id,
        competitionId: competition.id,
        externalMatchId: `trc-event:${fx.id}`,
        sourceProvider: TRC_TEAM_STATS_PROVIDER,
        skipCascade: true,
        stats: {
          side,
          tries: scoring.tries,
          conversions: scoring.conversions,
          penalties: scoring.penalties,
          dropGoals: scoring.dropGoals,
          carries: advanced.carries,
          metres: advanced.metres,
          tackles: advanced.tackles,
          turnoversWon: advanced.turnoversWon,
          sections: {
            scoring: { match_points: matchPoints },
            attack: {
              offloads: advanced.offloads,
              clean_breaks: advanced.cleanBreaks,
              defenders_beaten: advanced.defendersBeaten,
            },
          },
        },
      });
      upserted += 1;
    }
  }

  return { year, fixtures: realFixtures.length, upserted, skippedIncomplete };
}

export async function syncRugbyChampionshipTeamMatchStatsRange(
  fromYear: number,
  toYear: number,
): Promise<RugbyChampionshipTeamStatsSyncResult[]> {
  const results: RugbyChampionshipTeamStatsSyncResult[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    results.push(await syncRugbyChampionshipTeamMatchStats(year));
  }
  return results;
}
