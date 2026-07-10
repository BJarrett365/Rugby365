import {
  competitionSeasons,
  competitions,
  fixtures,
  matchEvents,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { detectNeutralVenueFromSnapshot, resolveHemisphereFromDb, normalizeTeamType } from "../team-hemisphere-utils";
import { kickoffInSeason, parseSeasonStartYear, usesDomesticSeasonCatalog } from "../season-label-utils";
import {
  getCompetitionById,
  getSeasonStandings,
  syncDomesticSeasonCatalog,
  type StandingView,
} from "../competition-admin-service";
import { assessFixtureCoverage, isTableAvailable } from "./table-confidence-service";
import { assessTableDataLevels } from "./table-lab-data-levels";
import { getRugbyTableDefinition } from "./table-definition-service";
import { getScoringRulesForCompetition } from "./competition-scoring-rules";
import { dedupeSeasonsByYear, decorateSeasonPickerRows } from "../season-list-utils";
import {
  assessHemisphereConfidence,
  buildHemisphereTable,
} from "./hemisphere-table-service";
import { HEMISPHERE_RULE_EXPLANATION } from "../team-hemisphere-utils";
import {
  buildFormTableStandings,
  DEFAULT_FORM_MATCH_COUNT,
  parseFormMatchCount,
} from "./form-table-service";
import {
  applyHomeTablePostProcessing,
  buildHomeTableStandings,
  parseMinMatchesPlayed,
} from "./home-table-service";
import {
  applyAwayTablePostProcessing,
  buildAwayTableStandings,
} from "./away-table-service";
import {
  buildAllTimePremiershipTable,
  parseAllTimeSeasonRangeMode,
  parseAllTimeSortBy,
  parseAllTimeTeamStatus,
  parseSeasonYearParam,
  resolveSeasonStartYearFromKickoff,
} from "./all-time-premiership-service";
import {
  buildCalendarYearTableStandings,
  parseCalendarYear,
} from "./calendar-year-table-service";
import {
  buildOnThisDateTableStandings,
  parseAsOfDateParam,
  resolveScoringRulesForSeasonTable,
} from "./on-this-date-table-service";
import {
  buildBetweenDatesTableStandings,
  defaultBetweenDatesRange,
  parseDateOnlyParam,
} from "./between-dates-table-service";
import {
  buildFirstHalfTableStandings,
  resolveFirstHalfScores,
} from "./first-half-table-service";
import {
  buildSecondHalfTableStandings,
  resolveSecondHalfScores,
} from "./second-half-table-service";
import {
  buildFinalTwentyTableStandings,
  parseIncludeExtraTime,
  resolveFinalTwentyScores,
} from "./final-twenty-minutes-table-service";
import {
  buildVBottomHalfTableStandings,
  buildVTopHalfTableStandings,
  parseOppositionPositionRule,
} from "./v-top-half-table-service";
import {
  buildPointsLostWinningTableStandings,
  parsePointsLostWinningSortBy,
  parseWinningPositionFilter,
} from "./points-lost-winning-table-service";
import {
  buildPointsGainedLosingTableStandings,
  parseLosingPositionFilter,
  parsePointsGainedLosingSortBy,
} from "./points-gained-losing-table-service";
import {
  buildComebackTableStandings,
  parseComebackFromFilter,
  parseComebackSortBy,
  parseMinimumDeficitPoints,
  parseMinimumDeficitPreset,
} from "./comeback-table-service";
import {
  buildLeadProtectionTableStandings,
  parseLeadPositionFilter,
  parseLeadProtectionSortBy,
  parseMinimumLeadPoints,
  parseMinimumLeadPreset,
} from "./lead-protection-table-service";
import {
  buildTriesScoredTableStandings,
  parseTriesMatchRangeCount,
  parseTriesMatchRangePreset,
  parseTriesScoredPeriod,
  parseTriesScoredSortBy,
} from "./tries-scored-table-service";
import {
  buildTriesConcededTableStandings,
  parseTriesConcededPeriod,
  parseTriesConcededSortBy,
} from "./tries-conceded-table-service";
import {
  buildBothTeamsScoredTriesTableStandings,
  parseBothTeamsScoredTriesSortBy,
} from "./both-teams-scored-tries-table-service";
import {
  buildWinningBonusPointsTableStandings,
  parseWinningBonusPointsSortBy,
  parseWinningBonusTypeFilter,
} from "./winning-bonus-points-table-service";
import { buildTryBonusPointStandings } from "./try-bonus-point-table-service";
import { bettingTableScopeWarnings } from "./table-stat-data-warnings";
import {
  buildScoringFirstTableStandings,
  parseFirstScoreTypeFilter,
  parseScoringFirstSortBy,
} from "./scoring-first-table-service";
import {
  buildConcedingFirstTableStandings,
  parseConcedingFirstSortBy,
} from "./conceding-first-table-service";
import { resolveFirstScoringEvent } from "./first-score-utils";
import { resolveFixtureLosingPositionState } from "./losing-position-utils";
import {
  buildLiveTableStandings,
  formatMatchClock,
  isLiveFixtureStatus,
  isScheduledFixtureStatus,
  liveTableCalculationNote,
  parseLiveTableBoolean,
} from "./live-table-service";
import { canonicalKeyFromName } from "./premiership-team-identity";
import { DEFAULT_TABLE_COMPETITION_SLUG } from "../competition-list-utils";
import { currentDomesticSeasonStartYear } from "../season-label-utils";
import {
  addMatchToAccumulator,
  addMetric,
  buildLeagueStandingsFromPerspectives,
  buildMetricStandings,
  createStandingsAccumulator,
  filterByCalendarYear,
  filterByKickoffRange,
  filterBySide,
  filterPerspectives,
  finalizeStandingsRows,
  lineoutSuccessPct,
  matchLeaguePoints,
  ratioPct,
  sectionNumber,
} from "./rugby-table-metrics-service";
import { standingViewForTableView, tableViewLabel } from "./table-view-utils";
import type {
  HemisphereMatchType,
  HemisphereTableMode,
  RugbyTableBuildContext,
  RugbyTableResult,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

const COMPLETED_STATUSES = new Set(["full_time", "finished", "completed", "ft"]);

function isCompletedFixture(status: string, homeScore: number, awayScore: number) {
  const normalized = status.toLowerCase();
  if (COMPLETED_STATUSES.has(normalized)) return true;
  return normalized === "live" && homeScore + awayScore > 0;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function scoringPointsFromEvent(payload: Record<string, unknown>): number {
  const points = Number(payload.points ?? payload.scoreValue ?? 0);
  if (Number.isFinite(points) && points > 0) return points;
  const eventType = String(payload.eventType ?? payload.type ?? "").toLowerCase();
  if (eventType.includes("try")) return 5;
  if (eventType.includes("conversion")) return 2;
  if (eventType.includes("penalty")) return 3;
  if (eventType.includes("drop")) return 3;
  return 0;
}

async function loadPerspectives(input: {
  seasonId?: string;
  competitionId?: string;
  allTimePremiership?: boolean;
  competitionSeasonCatalog?: boolean;
  liveTable?: {
    includeLiveMatches: boolean;
    includeScheduledMatches: boolean;
  };
  finalTwentyIncludeExtraTime?: boolean;
}): Promise<TeamFixturePerspective[]> {
  const db = getDb();
  const conditions = [sql`${fixtures.homeTeamId} is not null`, sql`${fixtures.awayTeamId} is not null`];
  let season: (typeof competitionSeasons.$inferSelect) | null = null;
  let seasonYearCatalog: number[] = [];

  if (input.allTimePremiership) {
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.slug, DEFAULT_TABLE_COMPETITION_SLUG))
      .limit(1);
    if (competition) {
      conditions.push(eq(fixtures.competitionId, competition.id));
      const seasonRows = await db
        .select()
        .from(competitionSeasons)
        .where(eq(competitionSeasons.competitionId, competition.id));
      seasonYearCatalog = seasonRows
        .map((row) => row.year ?? parseSeasonStartYear(row.label))
        .filter((year): year is number => year != null);
    }
  } else if (input.seasonId) {
    const [seasonRow] = await db
      .select()
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, input.seasonId))
      .limit(1);
    season = seasonRow ?? null;
    if (season) {
      conditions.push(eq(fixtures.competitionId, season.competitionId));
    }
  } else if (input.competitionId) {
    conditions.push(eq(fixtures.competitionId, input.competitionId));
    if (input.competitionSeasonCatalog) {
      const seasonRows = await db
        .select()
        .from(competitionSeasons)
        .where(eq(competitionSeasons.competitionId, input.competitionId));
      seasonYearCatalog = seasonRows
        .map((row) => row.year ?? parseSeasonStartYear(row.label))
        .filter((year): year is number => year != null);
    }
  }

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(and(...conditions))
    .orderBy(desc(fixtures.kickoffAt));

  let completed = fixtureRows.filter((row) => {
    const status = row.status.toLowerCase();
    if (COMPLETED_STATUSES.has(status)) return true;
    if (input.liveTable?.includeLiveMatches && isLiveFixtureStatus(row.status)) return true;
    if (input.liveTable?.includeScheduledMatches && isScheduledFixtureStatus(row.status)) return true;
    if (!input.liveTable) {
      return isCompletedFixture(row.status, row.homeScore, row.awayScore);
    }
    return false;
  });

  if (season) {
    const startYear = season.year ?? parseSeasonStartYear(season.label);
    if (startYear != null) {
      completed = completed.filter((row) => kickoffInSeason(row.kickoffAt, startYear));
    }
  }

  const fixtureIds = completed.map((row) => row.id);
  if (fixtureIds.length === 0) return [];

  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((row) => [row.id, row]));
  const teamNameById = Object.fromEntries(teamRows.map((row) => [row.id, row.name]));

  const statsRows = await db
    .select()
    .from(teamMatchStats)
    .where(inArray(teamMatchStats.fixtureId, fixtureIds));

  const statsByFixtureTeam = new Map<string, typeof teamMatchStats.$inferSelect>();
  for (const row of statsRows) {
    statsByFixtureTeam.set(`${row.fixtureId}:${row.teamId}`, row);
  }

  const eventRows = await db
    .select()
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, fixtureIds));

  const eventsByFixture = new Map<string, Array<typeof matchEvents.$inferSelect>>();
  for (const event of eventRows) {
    const list = eventsByFixture.get(event.fixtureId) ?? [];
    list.push(event);
    eventsByFixture.set(event.fixtureId, list);
  }

  const perspectives: TeamFixturePerspective[] = [];

  for (const fixture of completed) {
    if (!fixture.homeTeamId || !fixture.awayTeamId) continue;
    const events = eventsByFixture.get(fixture.id) ?? [];
    const firstHalfResolved = resolveFirstHalfScores({
      events,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
    });
    const firstHalfHome = firstHalfResolved.homeScore;
    const firstHalfAway = firstHalfResolved.awayScore;

    const firstScore = resolveFirstScoringEvent(
      events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        minute: event.minute,
        second: event.second,
        sequenceNo: event.sequenceNo,
        teamId: event.teamId,
      })),
    );

    const losingPosition = resolveFixtureLosingPositionState({
      events: events.map((event) => ({
        eventType: event.eventType,
        teamId: event.teamId,
        minute: event.minute,
        second: event.second,
        sequenceNo: event.sequenceNo,
        payload: (event.payload ?? {}) as Record<string, unknown>,
      })),
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
    });

    const yellowCards = events.filter((event) => event.eventType === "yellow_card");
    const redCards = events.filter((event) => event.eventType === "red_card");

    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
      const opponentId = side === "home" ? fixture.awayTeamId : fixture.homeTeamId;
      const teamRow = teamById[teamId];
      const opponentRow = teamById[opponentId];
      const pointsFor = side === "home" ? fixture.homeScore : fixture.awayScore;
      const pointsAgainst = side === "home" ? fixture.awayScore : fixture.homeScore;
      const normalizedStatus = fixture.status.toLowerCase();
      const fixtureCompleted = COMPLETED_STATUSES.has(normalizedStatus);
      const isLive =
        !fixtureCompleted && isLiveFixtureStatus(fixture.status);
      const isScheduled = isScheduledFixtureStatus(fixture.status);
      const stat = statsByFixtureTeam.get(`${fixture.id}:${teamId}`);
      const oppStat = statsByFixtureTeam.get(`${fixture.id}:${opponentId}`);
      const sections = (stat?.sections ?? {}) as Record<string, Record<string, number>>;

      const firstHalfFor = side === "home" ? firstHalfHome : firstHalfAway;
      const firstHalfAgainst = side === "home" ? firstHalfAway : firstHalfHome;
      const firstHalfTriesFor =
        side === "home" ? firstHalfResolved.homeTries : firstHalfResolved.awayTries;
      const firstHalfTriesAgainst =
        side === "home" ? firstHalfResolved.awayTries : firstHalfResolved.homeTries;
      const secondHalfResolved = resolveSecondHalfScores({
        events,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeFullScore: fixture.homeScore,
        awayFullScore: fixture.awayScore,
        firstHalfHome,
        firstHalfAway,
        firstHalfSource: firstHalfResolved.source,
      });
      const secondHalfFor =
        side === "home" ? secondHalfResolved.homeScore : secondHalfResolved.awayScore;
      const secondHalfAgainst =
        side === "home" ? secondHalfResolved.awayScore : secondHalfResolved.homeScore;
      const secondHalfTriesFor =
        side === "home" ? secondHalfResolved.homeTries : secondHalfResolved.awayTries;
      const secondHalfTriesAgainst =
        side === "home" ? secondHalfResolved.awayTries : secondHalfResolved.homeTries;
      const finalTwentyResolved = resolveFinalTwentyScores({
        events,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeFullScore: fixture.homeScore,
        awayFullScore: fixture.awayScore,
        includeExtraTime: input.finalTwentyIncludeExtraTime === true,
      });
      const finalTwentyFor =
        side === "home" ? finalTwentyResolved.homeScore : finalTwentyResolved.awayScore;
      const finalTwentyAgainst =
        side === "home" ? finalTwentyResolved.awayScore : finalTwentyResolved.homeScore;
      const finalTwentyTriesFor =
        side === "home" ? finalTwentyResolved.homeTries : finalTwentyResolved.awayTries;
      const finalTwentyTriesAgainst =
        side === "home" ? finalTwentyResolved.awayTries : finalTwentyResolved.homeTries;
      const scoreAtSixtyFor =
        side === "home" ? finalTwentyResolved.scoreAtSixtyHome : finalTwentyResolved.scoreAtSixtyAway;
      const scoreAtSixtyAgainst =
        side === "home" ? finalTwentyResolved.scoreAtSixtyAway : finalTwentyResolved.scoreAtSixtyHome;

      perspectives.push({
        fixtureId: fixture.id,
        kickoffAt: fixture.kickoffAt,
        teamId,
        teamName: teamNameById[teamId] ?? "Unknown",
        teamSlug: teamRow?.slug ?? null,
        seasonStartYear: resolveSeasonStartYearFromKickoff(fixture.kickoffAt, seasonYearCatalog),
        opponentId,
        opponentName: teamNameById[opponentId] ?? "Unknown",
        side,
        teamHemisphere: resolveHemisphereFromDb(teamRow?.hemisphere),
        opponentHemisphere: resolveHemisphereFromDb(opponentRow?.hemisphere),
        teamType: normalizeTeamType(teamRow?.teamType),
        isNeutralVenue:
          fixture.isNeutralVenue === true ||
          detectNeutralVenueFromSnapshot(fixture.providerSnapshot),
        pointsFor,
        pointsAgainst,
        triesFor: stat?.tries ?? null,
        triesAgainst: oppStat?.tries ?? null,
        firstHalfFor,
        firstHalfAgainst,
        firstHalfTriesFor,
        firstHalfTriesAgainst,
        firstHalfScoreSource: firstHalfResolved.source,
        secondHalfFor,
        secondHalfAgainst,
        secondHalfTriesFor,
        secondHalfTriesAgainst,
        secondHalfScoreSource: secondHalfResolved.source,
        finalTwentyFor,
        finalTwentyAgainst,
        finalTwentyTriesFor,
        finalTwentyTriesAgainst,
        finalTwentyScoreSource: finalTwentyResolved.source,
        scoreAtSixtyFor,
        scoreAtSixtyAgainst,
        scoredFirst:
          firstScore.verified && firstScore.teamId ? firstScore.teamId === teamId : null,
        concededFirst:
          firstScore.verified && firstScore.teamId ? firstScore.teamId === opponentId : null,
        firstScoreEventType: firstScore.verified ? firstScore.eventType : null,
        firstScoreMinute: firstScore.verified ? firstScore.minute : null,
        firstScoreVerified: firstScore.verified,
        everTrailing: losingPosition.scoreTimelineVerified
          ? side === "home"
            ? losingPosition.homeEverTrailing
            : losingPosition.awayEverTrailing
          : null,
        behindAtHalfTime:
          side === "home" ? losingPosition.homeBehindAtHalfTime : losingPosition.awayBehindAtHalfTime,
        behindAfterSixty:
          side === "home" ? losingPosition.homeBehindAfterSixty : losingPosition.awayBehindAfterSixty,
        scoreTimelineVerified: losingPosition.scoreTimelineVerified,
        halfTimeScoreVerified: losingPosition.halfTimeScoreVerified,
        sixtyMinuteScoreVerified: losingPosition.sixtyMinuteScoreVerified,
        minuteFirstBehind:
          side === "home"
            ? losingPosition.homeMinuteFirstBehind
            : losingPosition.awayMinuteFirstBehind,
        maxDeficitWhileTrailing:
          side === "home" ? losingPosition.homeMaxDeficit : losingPosition.awayMaxDeficit,
        minuteLastTookLead:
          side === "home"
            ? losingPosition.homeMinuteLastTookLead
            : losingPosition.awayMinuteLastTookLead,
        everLeading: losingPosition.scoreTimelineVerified
          ? side === "home"
            ? losingPosition.homeEverLeading
            : losingPosition.awayEverLeading
          : null,
        aheadAtHalfTime:
          side === "home" ? losingPosition.homeAheadAtHalfTime : losingPosition.awayAheadAtHalfTime,
        aheadAfterSixty:
          side === "home" ? losingPosition.homeAheadAfterSixty : losingPosition.awayAheadAfterSixty,
        minuteFirstAhead:
          side === "home"
            ? losingPosition.homeMinuteFirstAhead
            : losingPosition.awayMinuteFirstAhead,
        maxLeadMargin: side === "home" ? losingPosition.homeMaxLead : losingPosition.awayMaxLead,
        latestLeadLostMinute:
          side === "home"
            ? losingPosition.homeLatestLeadLostMinute
            : losingPosition.awayLatestLeadLostMinute,
        wasWinning: pointsFor > pointsAgainst ? true : pointsFor < pointsAgainst ? false : null,
        wasLosing: pointsFor < pointsAgainst ? true : pointsFor > pointsAgainst ? false : null,
        wasDrawn: pointsFor === pointsAgainst ? true : null,
        possessionPct: sectionNumber(sections, "possession", "overall_percentage"),
        territoryPct: sectionNumber(sections, "territory", "overall_percentage"),
        lineoutsWon: sectionNumber(sections, "set_piece", "lineouts_won"),
        lineoutsLost: sectionNumber(sections, "set_piece", "lineouts_lost"),
        scrumSuccessPct: sectionNumber(sections, "set_piece", "scrum_success_percentage"),
        scrumPenaltiesWon: sectionNumber(sections, "set_piece", "scrum_penalties_won"),
        scrumPenaltiesConceded: sectionNumber(sections, "set_piece", "scrum_penalties_conceded"),
        carries: stat?.carries ?? null,
        metres: stat?.metres ?? null,
        lineBreaks: sectionNumber(sections, "attack", "line_breaks"),
        defendersBeaten: sectionNumber(sections, "attack", "defenders_beaten"),
        postContactMetres: sectionNumber(sections, "attack", "post_contact_metres"),
        tryAssists: sectionNumber(sections, "attack", "try_assists"),
        turnoversWon: stat?.turnoversWon ?? null,
        tacklesMade: stat?.tackles ?? null,
        tacklesCompleted: sectionNumber(sections, "defence", "tackles_completed"),
        dominantTackles: sectionNumber(sections, "defence", "dominant_tackles"),
        missedTackles: sectionNumber(sections, "defence", "tackles_missed"),
        penaltiesConceded: sectionNumber(sections, "discipline", "penalties_conceded"),
        yellowCards: yellowCards.filter((event) => event.teamId === teamId).length,
        redCards: redCards.filter((event) => event.teamId === teamId).length,
        opponentLeagueRank: null,
        isLive,
        isScheduled,
        countsTowardStandings: !isScheduled,
        matchClockLabel: formatMatchClock(fixture.matchMinute, fixture.period),
        fixtureStatus: fixture.status,
      });
    }
  }

  return perspectives;
}

function parseStandingFormMeta(form: string | null | undefined): {
  tryBonusPoints?: number;
  losingBonusPoints?: number;
} {
  if (!form?.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(form) as { tbp?: number; lbp?: number };
    return {
      tryBonusPoints: parsed.tbp,
      losingBonusPoints: parsed.lbp,
    };
  } catch {
    return {};
  }
}

function buildStandingsFromPerspectives(
  perspectives: TeamFixturePerspective[],
  metricFn?: (row: TeamFixturePerspective) => number | null,
  rules?: import("./table-types").RugbyScoringRules,
): RugbyTableStandingRow[] {
  const accumulators = new Map<string, ReturnType<typeof createStandingsAccumulator>>();
  for (const row of perspectives) {
    const acc = accumulators.get(row.teamId) ?? createStandingsAccumulator(row.teamId, row.teamName);
    addMatchToAccumulator(acc, row, rules);
    if (metricFn) addMetric(acc, metricFn(row));
    accumulators.set(row.teamId, acc);
  }
  return finalizeStandingsRows(accumulators, {
    sortByMetric: Boolean(metricFn),
    sortLeagueTable: !metricFn,
    scoringRules: rules,
  });
}

async function trySyncedStandings(
  seasonId: string | undefined,
  view: StandingView,
): Promise<RugbyTableStandingRow[] | null> {
  if (!seasonId) return null;
  const rows = await getSeasonStandings(seasonId, view);
  if (!rows.length) return null;
  return rows.map((row) => {
    const bonusMeta = parseStandingFormMeta(row.form);
    const tryBonusPoints = bonusMeta.tryBonusPoints ?? null;
    const losingBonusPoints = bonusMeta.losingBonusPoints ?? null;
    return {
      rank: row.rank,
      teamId: row.teamId,
      teamName: row.teamName,
      played: row.played,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointsDiff: row.pointsDiff,
      triesFor: null,
      triesAgainst: null,
      tryBonusPoints,
      losingBonusPoints,
      bonusPoints: row.bonusPoints,
      leaguePoints: row.points,
    };
  });
}

async function buildTableMetadata(
  context: RugbyTableBuildContext,
  tableView: RugbyTableView,
  options?: {
    formMatchCount?: number;
    minMatchesPlayed?: number;
    homeTable?: boolean;
    awayTable?: boolean;
    allTimeSeasonsLabel?: string | null;
    calendarYear?: number;
    seasonsIncludedLabel?: string | null;
    asOfDateLabel?: string | null;
    betweenDatesRangeLabel?: string | null;
    hemisphereMode?: HemisphereTableMode;
    hemisphereMatchType?: HemisphereMatchType;
    includeUnknownHemisphere?: boolean;
  },
): Promise<{
  filterSummary: string;
  lastUpdated: string | null;
  scoringRules: Awaited<ReturnType<typeof getScoringRulesForCompetition>>;
  competition?: { slug: string; name: string };
}> {
  const scoringRules = await getScoringRulesForCompetition(context.competitionId);
  let competitionName = "Competition";
  let seasonLabel = "All seasons";
  let lastUpdated: string | null = null;

  if (options?.allTimeSeasonsLabel) {
    competitionName = "Premiership Rugby";
    seasonLabel = options.allTimeSeasonsLabel;
  } else if (options?.calendarYear != null) {
    seasonLabel = `${options.calendarYear} calendar year`;
    if (options.seasonsIncludedLabel) {
      seasonLabel = `${seasonLabel} · ${options.seasonsIncludedLabel}`;
    }
  } else if (options?.asOfDateLabel) {
    seasonLabel = `As of ${options.asOfDateLabel}`;
  } else if (options?.betweenDatesRangeLabel) {
    seasonLabel = options.betweenDatesRangeLabel;
    if (options.seasonsIncludedLabel) {
      seasonLabel = `${seasonLabel} · ${options.seasonsIncludedLabel}`;
    }
  } else if (context.competitionId) {
    const competition = await getCompetitionById(context.competitionId);
    if (competition) competitionName = competition.name;
  }
  if (context.seasonId) {
    const db = getDb();
    const [season] = await db
      .select()
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, context.seasonId))
      .limit(1);
    if (season) {
      seasonLabel = season.label;
      lastUpdated = season.syncedAt?.toISOString() ?? null;
    }
  }

  const competition =
    context.competitionId != null
      ? await getCompetitionById(context.competitionId).then((row) =>
          row ? { slug: row.slug, name: row.name } : undefined,
        )
      : undefined;

  const viewPart =
    options?.hemisphereMode != null
      ? `${options.hemisphereMode === "summary" ? "Hemisphere summary" : "Team breakdown"} · ${options.hemisphereMatchType ?? "all"} matches · ${tableViewLabel(tableView)}${options.includeUnknownHemisphere ? " · incl. unknown" : ""}`
      : options?.homeTable
        ? `Home matches only${options.minMatchesPlayed != null && options.minMatchesPlayed > 1 ? ` · min ${options.minMatchesPlayed} home games` : ""}`
        : options?.awayTable
          ? `Away matches only · neutral venues excluded${options.minMatchesPlayed != null && options.minMatchesPlayed > 1 ? ` · min ${options.minMatchesPlayed} away games` : ""}`
          : options?.allTimeSeasonsLabel
        ? `All-time · ${options.allTimeSeasonsLabel}`
        : options?.calendarYear != null
          ? `${options.calendarYear} calendar year${options.minMatchesPlayed != null && options.minMatchesPlayed > 1 ? ` · min ${options.minMatchesPlayed} matches` : ""}`
          : options?.formMatchCount != null
          ? `Last ${options.formMatchCount} matches · ${tableViewLabel(tableView)}`
          : `${tableViewLabel(tableView)} view`;

  return {
    filterSummary: `${competitionName} · ${seasonLabel} · ${viewPart}`,
    lastUpdated,
    scoringRules,
    competition,
  };
}

function applyDataLevels(
  result: RugbyTableResult,
  perspectives: TeamFixturePerspective[],
): RugbyTableResult {
  const seasonYears = [
    ...new Set(
      perspectives
        .map((row) => row.seasonStartYear)
        .filter((year): year is number => year != null),
    ),
  ].sort((a, b) => a - b);
  const levels = assessTableDataLevels(perspectives, result.definition, { seasonYears });
  return {
    ...result,
    dataCoverageNote: result.dataCoverageNote ?? levels.coverageNote,
    dataLevel: levels.level,
    dataCoveragePct: levels.level1CoveragePct,
  };
}

async function attachTableLabMetadata(
  result: RugbyTableResult,
  context: RugbyTableBuildContext,
  tableView: RugbyTableView,
  perspectives: TeamFixturePerspective[],
  extras?: {
    formMatchCount?: number;
    minMatchesPlayed?: number;
    dateRangeLabel?: string | null;
    allTimeSeasonsLabel?: string | null;
    allTimeCoverage?: import("./table-types").AllTimePremiershipCoverage;
    calendarYear?: number;
    seasonsIncludedLabel?: string | null;
    calendarYearCalculationNote?: string | null;
    calendarYearMatchCount?: number;
    asOfDateLabel?: string | null;
    tableOnDateStatus?: "official" | "calculated";
    tableOnDateCalculationNote?: string | null;
    onThisDateMatchCount?: number;
    tableOnDateDeductionNotice?: string | null;
    betweenDatesStartLabel?: string | null;
    betweenDatesEndLabel?: string | null;
    betweenDatesCalculationNote?: string | null;
    betweenDatesMatchCount?: number;
    allTimeTeamCount?: number;
    allTimeMatchCount?: number;
    allTimeIdentityReviewCount?: number;
    historicScoringNotice?: string | null;
    hemisphereMode?: HemisphereTableMode;
    hemisphereMatchType?: HemisphereMatchType;
    includeUnknownHemisphere?: boolean;
    unknownTeamCount?: number;
    hemisphereRuleNote?: string;
  },
): Promise<RugbyTableResult> {
  const meta = await buildTableMetadata(context, tableView, {
    formMatchCount: extras?.formMatchCount,
    minMatchesPlayed: extras?.minMatchesPlayed,
    homeTable: result.definition.id === "home_table",
    awayTable: result.definition.id === "away_table",
    allTimeSeasonsLabel: extras?.allTimeSeasonsLabel,
    calendarYear: extras?.calendarYear,
    seasonsIncludedLabel: extras?.seasonsIncludedLabel,
    asOfDateLabel: extras?.asOfDateLabel,
    betweenDatesRangeLabel: extras?.dateRangeLabel,
    hemisphereMode: extras?.hemisphereMode,
    hemisphereMatchType: extras?.hemisphereMatchType,
    includeUnknownHemisphere: extras?.includeUnknownHemisphere,
  });
  return applyDataLevels(
    {
      ...result,
      ...meta,
      tableView,
      formMatchCount: extras?.formMatchCount,
      minMatchesPlayed: extras?.minMatchesPlayed,
      dateRangeLabel: extras?.dateRangeLabel ?? result.dateRangeLabel,
      allTimeSeasonsLabel: extras?.allTimeSeasonsLabel,
      calendarYear: extras?.calendarYear ?? result.calendarYear,
      seasonsIncludedLabel: extras?.seasonsIncludedLabel ?? result.seasonsIncludedLabel,
      calendarYearCalculationNote:
        extras?.calendarYearCalculationNote ?? result.calendarYearCalculationNote,
      calendarYearMatchCount: extras?.calendarYearMatchCount ?? result.calendarYearMatchCount,
      asOfDateLabel: extras?.asOfDateLabel ?? result.asOfDateLabel,
      tableOnDateStatus: extras?.tableOnDateStatus ?? result.tableOnDateStatus,
      tableOnDateCalculationNote:
        extras?.tableOnDateCalculationNote ?? result.tableOnDateCalculationNote,
      onThisDateMatchCount: extras?.onThisDateMatchCount ?? result.onThisDateMatchCount,
      tableOnDateDeductionNotice:
        extras?.tableOnDateDeductionNotice ?? result.tableOnDateDeductionNotice,
      betweenDatesStartLabel: extras?.betweenDatesStartLabel ?? result.betweenDatesStartLabel,
      betweenDatesEndLabel: extras?.betweenDatesEndLabel ?? result.betweenDatesEndLabel,
      betweenDatesCalculationNote:
        extras?.betweenDatesCalculationNote ?? result.betweenDatesCalculationNote,
      betweenDatesMatchCount: extras?.betweenDatesMatchCount ?? result.betweenDatesMatchCount,
      allTimeCoverage: extras?.allTimeCoverage,
      allTimeTeamCount: extras?.allTimeTeamCount,
      allTimeMatchCount: extras?.allTimeMatchCount,
      allTimeIdentityReviewCount: extras?.allTimeIdentityReviewCount,
      historicScoringNotice: extras?.historicScoringNotice,
      hemisphereMode: extras?.hemisphereMode,
      hemisphereMatchType: extras?.hemisphereMatchType,
      includeUnknownHemisphere: extras?.includeUnknownHemisphere,
      unknownTeamCount: extras?.unknownTeamCount,
      hemisphereRuleNote: extras?.hemisphereRuleNote,
      context: {
        ...context,
        tableView,
        ...(extras?.formMatchCount != null ? { formMatchCount: extras.formMatchCount } : {}),
        ...(extras?.minMatchesPlayed != null ? { minMatchesPlayed: extras.minMatchesPlayed } : {}),
        ...(extras?.calendarYear != null ? { calendarYear: extras.calendarYear } : {}),
      },
    },
    perspectives,
  );
}

function emptyResult(
  definition: NonNullable<ReturnType<typeof getRugbyTableDefinition>>,
  context: RugbyTableBuildContext,
  warnings: string[],
  perspectives: TeamFixturePerspective[] = [],
): RugbyTableResult {
  return applyDataLevels(
    {
      definition,
      available: false,
      confidence: "unavailable",
      dataCoveragePct: 0,
      rows: [],
      warnings,
      fixtureCount: 0,
      evaluatedFixtureCount: 0,
      context,
    },
    perspectives,
  );
}

export async function calculateRugbyTable(
  tableId: string,
  context: RugbyTableBuildContext = {},
): Promise<RugbyTableResult> {
  const definition = getRugbyTableDefinition(tableId);
  if (!definition) {
    throw new Error(`Unknown table type: ${tableId}`);
  }

  let perspectives = await loadPerspectives({
    seasonId: context.seasonId,
    competitionId: context.competitionId,
    allTimePremiership: definition.id === "all_time_premiership",
    competitionSeasonCatalog:
      definition.id === "calendar_year" || definition.id === "between_dates",
    finalTwentyIncludeExtraTime: parseIncludeExtraTime(context.includeExtraTime, false),
  });

  if (context.calendarYear && definition.id !== "calendar_year") {
    perspectives = filterByCalendarYear(perspectives, parseCalendarYear(context.calendarYear));
  }

  const asOf = parseDate(context.asOfDate);
  const from = parseDate(context.dateFrom);
  const to = parseDate(context.dateTo);
  const seasonPerspectivesForOppositionHalf =
    definition.id === "v_top_half" || definition.id === "v_bottom_half"
      ? perspectives.slice()
      : null;
  const seasonPerspectivesForScoringFirst =
    definition.id === "scoring_first" ||
    definition.id === "conceding_first" ||
    definition.id === "points_gained_losing" ||
    definition.id === "points_lost_winning" ||
    definition.id === "comeback" ||
    definition.id === "lead_protection"
      ? perspectives.slice()
      : null;
  if (asOf && definition.id !== "on_this_date") {
    perspectives = filterByKickoffRange(perspectives, undefined, asOf);
  }
  if (from || to) {
    if (
      definition.id !== "between_dates" &&
      definition.id !== "v_top_half" &&
      definition.id !== "v_bottom_half" &&
      definition.id !== "scoring_first" &&
      definition.id !== "conceding_first" &&
      definition.id !== "points_gained_losing" &&
      definition.id !== "points_lost_winning" &&
      definition.id !== "comeback" &&
      definition.id !== "lead_protection"
    ) {
      perspectives = filterByKickoffRange(perspectives, from, to);
    }
  }

  const tableView: RugbyTableView = context.tableView ?? "all";
  const coverage = assessFixtureCoverage(perspectives, definition);
  const warnings = [...coverage.warnings];

  if (definition.id === "first_half") {
    const firstHalfWarnings = [...warnings];

    if (!context.seasonId) {
      firstHalfWarnings.push("Season is required for the first half table.");
      return emptyResult(definition, context, firstHalfWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildFirstHalfTableStandings({
      perspectives,
      rules: scoringRules,
      tableView,
      minMatchesPlayed,
    });

    const halfCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    if (built.completedMatchCount > 0 && built.firstHalfMatchCount < built.completedMatchCount) {
      firstHalfWarnings.push(built.coverageLabel);
    }
    if (built.rows.length === 0) {
      firstHalfWarnings.push("No rows could be calculated — half-time score data is missing.");
    }
    if (minMatchesPlayed > 1) {
      firstHalfWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with first-half data.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: halfCoverage.confidence,
        dataCoveragePct: built.firstHalfCoveragePct,
        rows: built.rows,
        warnings: [...halfCoverage.warnings, ...firstHalfWarnings],
        fixtureCount: built.firstHalfMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: { ...context, minMatchesPlayed, tableView },
        firstHalfCalculationNote: built.calculationNote,
        firstHalfCoverageLabel: built.coverageLabel,
        firstHalfMatchCount: built.firstHalfMatchCount,
        firstHalfCompletedMatchCount: built.completedMatchCount,
        firstHalfCoveragePct: built.firstHalfCoveragePct,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "second_half") {
    const secondHalfWarnings = [...warnings];

    if (!context.seasonId) {
      secondHalfWarnings.push("Season is required for the second half table.");
      return emptyResult(definition, context, secondHalfWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildSecondHalfTableStandings({
      perspectives,
      rules: scoringRules,
      tableView,
      minMatchesPlayed,
    });

    const halfCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    if (built.completedMatchCount > 0 && built.secondHalfMatchCount < built.completedMatchCount) {
      secondHalfWarnings.push(built.coverageLabel);
    }
    if (built.rows.length === 0) {
      secondHalfWarnings.push(
        "No rows could be calculated — second-half score data is missing.",
      );
    }
    if (minMatchesPlayed > 1) {
      secondHalfWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with second-half data.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: halfCoverage.confidence,
        dataCoveragePct: built.secondHalfCoveragePct,
        rows: built.rows,
        warnings: [...halfCoverage.warnings, ...secondHalfWarnings],
        fixtureCount: built.secondHalfMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: { ...context, minMatchesPlayed, tableView },
        secondHalfCalculationNote: built.calculationNote,
        secondHalfCoverageLabel: built.coverageLabel,
        secondHalfMatchCount: built.secondHalfMatchCount,
        secondHalfCompletedMatchCount: built.completedMatchCount,
        secondHalfCoveragePct: built.secondHalfCoveragePct,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "final_20_minutes") {
    const finalTwentyWarnings = [...warnings];

    if (!context.seasonId) {
      finalTwentyWarnings.push("Season is required for the final 20 minutes table.");
      return emptyResult(definition, context, finalTwentyWarnings, perspectives);
    }

    const includeExtraTime = parseIncludeExtraTime(context.includeExtraTime, false);
    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildFinalTwentyTableStandings({
      perspectives,
      rules: scoringRules,
      tableView,
      minMatchesPlayed,
    });

    const periodCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    if (built.completedMatchCount > 0 && built.finalTwentyMatchCount < built.completedMatchCount) {
      finalTwentyWarnings.push(built.coverageLabel);
    }
    if (built.rows.length === 0) {
      finalTwentyWarnings.push(
        "No rows could be calculated — final 20 minutes data is missing.",
      );
    }
    if (minMatchesPlayed > 1) {
      finalTwentyWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with final 20 minutes data.`,
      );
    }
    if (includeExtraTime) {
      finalTwentyWarnings.push("Extra-time scoring events are included in this table.");
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: periodCoverage.confidence,
        dataCoveragePct: built.finalTwentyCoveragePct,
        rows: built.rows,
        warnings: [...periodCoverage.warnings, ...finalTwentyWarnings],
        fixtureCount: built.finalTwentyMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: { ...context, minMatchesPlayed, tableView, includeExtraTime },
        finalTwentyCalculationNote: built.calculationNote,
        finalTwentyCoverageLabel: built.coverageLabel,
        finalTwentyMatchCount: built.finalTwentyMatchCount,
        finalTwentyCompletedMatchCount: built.completedMatchCount,
        finalTwentyCoveragePct: built.finalTwentyCoveragePct,
        includeExtraTime,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "v_top_half") {
    const vTopHalfWarnings = [...warnings];

    if (!context.seasonId) {
      vTopHalfWarnings.push("Season is required for the table v top half.");
      return emptyResult(definition, context, vTopHalfWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const oppositionPositionRule = parseOppositionPositionRule(context.oppositionPositionRule);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildVTopHalfTableStandings({
      seasonPerspectives: seasonPerspectivesForOppositionHalf ?? perspectives,
      rules: scoringRules,
      tableView,
      oppositionPositionRule,
      minMatchesPlayed,
      dateFrom: from,
      dateTo: to,
    });

    if (built.provisionalFinalSeason) {
      vTopHalfWarnings.push(
        "Final season position is provisional — the season is not yet complete.",
      );
    }
    if (built.rows.length === 0) {
      vTopHalfWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      vTopHalfWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches against top-half opposition.`,
      );
    }

    const vCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: vCoverage.confidence,
        dataCoveragePct: vCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...vCoverage.warnings, ...vTopHalfWarnings],
        fixtureCount: built.topHalfMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: { ...context, minMatchesPlayed, tableView, oppositionPositionRule },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        oppositionPositionRule,
        topHalfRankRangeLabel: built.topHalfRankRangeLabel,
        topHalfTeamCount: built.topHalfTeamCount,
        topHalfMatchCount: built.topHalfMatchCount,
        topHalfFilterSummary: built.filterSummary,
        provisionalFinalSeason: built.provisionalFinalSeason,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "v_bottom_half") {
    const vBottomHalfWarnings = [...warnings];

    if (!context.seasonId) {
      vBottomHalfWarnings.push("Season is required for the table v bottom half.");
      return emptyResult(definition, context, vBottomHalfWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const oppositionPositionRule = parseOppositionPositionRule(context.oppositionPositionRule);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildVBottomHalfTableStandings({
      seasonPerspectives: seasonPerspectivesForOppositionHalf ?? perspectives,
      rules: scoringRules,
      tableView,
      oppositionPositionRule,
      minMatchesPlayed,
      dateFrom: from,
      dateTo: to,
    });

    if (built.provisionalFinalSeason) {
      vBottomHalfWarnings.push(
        "Final season position is provisional — the season is not yet complete.",
      );
    }
    if (built.rows.length === 0) {
      vBottomHalfWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      vBottomHalfWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches against bottom-half opposition.`,
      );
    }

    const vCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: vCoverage.confidence,
        dataCoveragePct: vCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...vCoverage.warnings, ...vBottomHalfWarnings],
        fixtureCount: built.bottomHalfMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: { ...context, minMatchesPlayed, tableView, oppositionPositionRule },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        oppositionPositionRule,
        bottomHalfRankRangeLabel: built.bottomHalfRankRangeLabel,
        bottomHalfTeamCount: built.bottomHalfTeamCount,
        bottomHalfMatchCount: built.bottomHalfMatchCount,
        bottomHalfFilterSummary: built.filterSummary,
        provisionalFinalSeason: built.provisionalFinalSeason,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "scoring_first") {
    const scoringFirstWarnings = [...warnings];

    if (!context.seasonId) {
      scoringFirstWarnings.push("Season is required for the table when scoring first.");
      return emptyResult(definition, context, scoringFirstWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const firstScoreType = parseFirstScoreTypeFilter(context.firstScoreType);
    const scoringFirstSortBy = parseScoringFirstSortBy(context.scoringFirstSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildScoringFirstTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      firstScoreType,
      minMatchesPlayed,
      sortBy: scoringFirstSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      scoringFirstWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.ambiguousFixtureCount > 0) {
      scoringFirstWarnings.push(
        `${built.ambiguousFixtureCount} fixture(s) excluded because opening score order could not be verified.`,
      );
    }
    if (built.firstScoreCoveragePct < 100 && built.completedMatchCount > 0) {
      scoringFirstWarnings.push(
        "Some fixtures are missing verified first-score event data — this table cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      scoringFirstWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      scoringFirstWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they scored first.`,
      );
    }

    const scoringCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.firstScoreCoveragePct >= 80
            ? scoringCoverage.confidence
            : built.firstScoreCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.firstScoreCoveragePct,
        rows: built.rows,
        warnings: [...scoringCoverage.warnings, ...scoringFirstWarnings],
        fixtureCount: built.firstScoreMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          firstScoreType,
          scoringFirstSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        firstScoreType,
        scoringFirstSortBy,
        scoringFirstMatchCount: built.firstScoreMatchCount,
        scoringFirstCompletedMatchCount: built.completedMatchCount,
        scoringFirstCoveragePct: built.firstScoreCoveragePct,
        scoringFirstFilterSummary: built.filterSummary,
        scoringFirstCalculationNote: built.filterSummary,
        ambiguousFirstScoreFixtureCount: built.ambiguousFixtureCount,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "conceding_first") {
    const concedingFirstWarnings = [...warnings];

    if (!context.seasonId) {
      concedingFirstWarnings.push("Season is required for the table when conceding first.");
      return emptyResult(definition, context, concedingFirstWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const firstScoreConcededType = parseFirstScoreTypeFilter(context.firstScoreType);
    const concedingFirstSortBy = parseConcedingFirstSortBy(context.concedingFirstSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildConcedingFirstTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      firstScoreConcededType,
      minMatchesPlayed,
      sortBy: concedingFirstSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      concedingFirstWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.ambiguousFixtureCount > 0) {
      concedingFirstWarnings.push(
        `${built.ambiguousFixtureCount} fixture(s) excluded because opening score order could not be verified.`,
      );
    }
    if (built.firstScoreCoveragePct < 100 && built.completedMatchCount > 0) {
      concedingFirstWarnings.push(
        "Some fixtures are missing verified first-score event data — this table cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      concedingFirstWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      concedingFirstWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they conceded first.`,
      );
    }

    const concedingCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.firstScoreCoveragePct >= 80
            ? concedingCoverage.confidence
            : built.firstScoreCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.firstScoreCoveragePct,
        rows: built.rows,
        warnings: [...concedingCoverage.warnings, ...concedingFirstWarnings],
        fixtureCount: built.concedingFirstMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          firstScoreType: firstScoreConcededType,
          concedingFirstSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        firstScoreType: firstScoreConcededType,
        concedingFirstSortBy,
        concedingFirstMatchCount: built.concedingFirstMatchCount,
        concedingFirstCompletedMatchCount: built.completedMatchCount,
        concedingFirstCoveragePct: built.firstScoreCoveragePct,
        concedingFirstFilterSummary: built.filterSummary,
        concedingFirstCalculationNote: built.filterSummary,
        ambiguousFirstScoreFixtureCount: built.ambiguousFixtureCount,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "points_gained_losing") {
    const pointsGainedWarnings = [...warnings];

    if (!context.seasonId) {
      pointsGainedWarnings.push("Season is required for points gained from losing positions.");
      return emptyResult(definition, context, pointsGainedWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const losingPositionFilter = parseLosingPositionFilter(context.losingPositionFilter);
    const pointsGainedLosingSortBy = parsePointsGainedLosingSortBy(context.pointsGainedLosingSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildPointsGainedLosingTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      losingPositionFilter,
      minMatchesPlayed,
      sortBy: pointsGainedLosingSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      pointsGainedWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.timelineCoveragePct < 100 && built.completedMatchCount > 0) {
      pointsGainedWarnings.push(
        "Some fixtures are missing verified score timeline data — losing positions cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      pointsGainedWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      pointsGainedWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they were behind.`,
      );
    }

    const pointsGainedCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.timelineCoveragePct >= 80
            ? pointsGainedCoverage.confidence
            : built.timelineCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.timelineCoveragePct,
        rows: built.rows,
        warnings: [...pointsGainedCoverage.warnings, ...pointsGainedWarnings],
        fixtureCount: built.qualifyingMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          losingPositionFilter,
          pointsGainedLosingSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        losingPositionFilter,
        pointsGainedLosingSortBy,
        pointsGainedLosingMatchCount: built.qualifyingMatchCount,
        pointsGainedLosingCompletedMatchCount: built.completedMatchCount,
        pointsGainedLosingCoveragePct: built.timelineCoveragePct,
        pointsGainedLosingFilterSummary: built.filterSummary,
        pointsGainedLosingCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "points_lost_winning") {
    const pointsLostWarnings = [...warnings];

    if (!context.seasonId) {
      pointsLostWarnings.push("Season is required for points lost from winning positions.");
      return emptyResult(definition, context, pointsLostWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const winningPositionFilter = parseWinningPositionFilter(context.winningPositionFilter);
    const pointsLostWinningSortBy = parsePointsLostWinningSortBy(context.pointsLostWinningSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildPointsLostWinningTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      winningPositionFilter,
      minMatchesPlayed,
      sortBy: pointsLostWinningSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      pointsLostWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.timelineCoveragePct < 100 && built.completedMatchCount > 0) {
      pointsLostWarnings.push(
        "Some fixtures are missing verified score timeline data — winning positions cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      pointsLostWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      pointsLostWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they held a lead.`,
      );
    }

    const pointsLostCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.timelineCoveragePct >= 80
            ? pointsLostCoverage.confidence
            : built.timelineCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.timelineCoveragePct,
        rows: built.rows,
        warnings: [...pointsLostCoverage.warnings, ...pointsLostWarnings],
        fixtureCount: built.qualifyingMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          winningPositionFilter,
          pointsLostWinningSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        winningPositionFilter,
        pointsLostWinningSortBy,
        pointsLostWinningMatchCount: built.qualifyingMatchCount,
        pointsLostWinningCompletedMatchCount: built.completedMatchCount,
        pointsLostWinningCoveragePct: built.timelineCoveragePct,
        pointsLostWinningFilterSummary: built.filterSummary,
        pointsLostWinningCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "comeback") {
    const comebackWarnings = [...warnings];

    if (!context.seasonId) {
      comebackWarnings.push("Season is required for the comeback table.");
      return emptyResult(definition, context, comebackWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const comebackFrom = parseComebackFromFilter(context.comebackFromFilter);
    const minimumDeficitPreset = parseMinimumDeficitPreset(context.minimumDeficitPreset);
    const minimumDeficit =
      context.minimumDeficitPoints != null
        ? Math.max(0, Math.floor(context.minimumDeficitPoints))
        : parseMinimumDeficitPoints(minimumDeficitPreset, context.minimumDeficitPoints);
    const comebackSortBy = parseComebackSortBy(context.comebackSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildComebackTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      comebackFrom,
      minimumDeficit,
      minimumDeficitPreset,
      minMatchesPlayed,
      sortBy: comebackSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      comebackWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.timelineCoveragePct < 100 && built.completedMatchCount > 0) {
      comebackWarnings.push(
        "Some fixtures are missing verified score timeline data — comebacks cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      comebackWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      comebackWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they were behind.`,
      );
    }

    const comebackCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.timelineCoveragePct >= 80
            ? comebackCoverage.confidence
            : built.timelineCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.timelineCoveragePct,
        rows: built.rows,
        warnings: [...comebackCoverage.warnings, ...comebackWarnings],
        fixtureCount: built.qualifyingMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          comebackFromFilter: comebackFrom,
          minimumDeficitPreset,
          minimumDeficitPoints: minimumDeficit,
          comebackSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        comebackFromFilter: comebackFrom,
        minimumDeficitPreset,
        minimumDeficitPoints: minimumDeficit,
        comebackSortBy,
        comebackMatchCount: built.qualifyingMatchCount,
        comebackCompletedMatchCount: built.completedMatchCount,
        comebackCoveragePct: built.timelineCoveragePct,
        comebackFilterSummary: built.filterSummary,
        comebackCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "lead_protection") {
    const leadProtectionWarnings = [...warnings];

    if (!context.seasonId) {
      leadProtectionWarnings.push("Season is required for the lead protection table.");
      return emptyResult(definition, context, leadProtectionWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const leadPosition = parseLeadPositionFilter(context.leadPositionFilter);
    const minimumLeadPreset = parseMinimumLeadPreset(context.minimumLeadPreset);
    const minimumLead =
      context.minimumLeadPoints != null
        ? Math.max(0, Math.floor(context.minimumLeadPoints))
        : parseMinimumLeadPoints(minimumLeadPreset, context.minimumLeadPoints);
    const leadProtectionSortBy = parseLeadProtectionSortBy(context.leadProtectionSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildLeadProtectionTableStandings({
      seasonPerspectives: seasonPerspectivesForScoringFirst ?? perspectives,
      rules: scoringRules,
      tableView,
      leadPosition,
      minimumLead,
      minimumLeadPreset,
      minMatchesPlayed,
      sortBy: leadProtectionSortBy,
      dateFrom: from,
      dateTo: to,
    });

    if (built.completedMatchCount === 0) {
      leadProtectionWarnings.push("No completed fixtures found for the selected scope.");
    }
    if (built.timelineCoveragePct < 100 && built.completedMatchCount > 0) {
      leadProtectionWarnings.push(
        "Some fixtures are missing verified score timeline data — lead protection cannot be inferred from final scores alone.",
      );
    }
    if (built.rows.length === 0) {
      leadProtectionWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      leadProtectionWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches where they held a lead.`,
      );
    }

    const leadProtectionCoverage = assessFixtureCoverage(built.scoringPerspectives, definition);

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.timelineCoveragePct >= 80
            ? leadProtectionCoverage.confidence
            : built.timelineCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.timelineCoveragePct,
        rows: built.rows,
        warnings: [...leadProtectionCoverage.warnings, ...leadProtectionWarnings],
        fixtureCount: built.qualifyingMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          leadPositionFilter: leadPosition,
          minimumLeadPreset,
          minimumLeadPoints: minimumLead,
          leadProtectionSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        leadPositionFilter: leadPosition,
        minimumLeadPreset,
        minimumLeadPoints: minimumLead,
        leadProtectionSortBy,
        leadProtectionMatchCount: built.qualifyingMatchCount,
        leadProtectionCompletedMatchCount: built.completedMatchCount,
        leadProtectionCoveragePct: built.timelineCoveragePct,
        leadProtectionFilterSummary: built.filterSummary,
        leadProtectionCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "tries_scored") {
    const triesWarnings = [...warnings];

    if (!context.seasonId) {
      triesWarnings.push("Season is required for the tries scored table.");
      return emptyResult(definition, context, triesWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const triesScoredPeriod = parseTriesScoredPeriod(context.triesScoredPeriod);
    const triesMatchRangePreset = parseTriesMatchRangePreset(context.triesMatchRangePreset);
    const triesMatchRangeCount = parseTriesMatchRangeCount(
      triesMatchRangePreset,
      context.triesMatchRangeCustom,
    );
    const triesScoredSortBy = parseTriesScoredSortBy(context.triesScoredSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildTriesScoredTableStandings({
      seasonPerspectives: perspectives,
      rules: scoringRules,
      tableView,
      period: triesScoredPeriod,
      matchRangeCount: triesMatchRangeCount,
      matchRangePreset: triesMatchRangePreset,
      minMatchesPlayed,
      sortBy: triesScoredSortBy,
    });

    if (built.completedMatchCount === 0) {
      triesWarnings.push("No completed fixtures found for the selected scope.");
    } else {
      triesWarnings.push(
        ...bettingTableScopeWarnings({
          completedMatchCount: built.completedMatchCount,
          qualifyingMatchCount: built.qualifyingMatchCount,
          rows: built.rows,
          triesCoveragePct: built.triesCoveragePct,
        }),
      );
    }
    if (triesScoredPeriod !== "full_match" && built.scoringPerspectives.length === 0) {
      triesWarnings.push(
        "Period try counts require timed try events — this filter is unavailable without event timing.",
      );
    }
    if (minMatchesPlayed > 1) {
      triesWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with try data.`,
      );
    }
    if (triesMatchRangeCount != null) {
      const shortTeams = built.rows.filter(
        (row) =>
          row.matchesUsed != null &&
          row.matchesRequested != null &&
          row.matchesUsed < row.matchesRequested,
      );
      if (shortTeams.length > 0) {
        triesWarnings.push(
          `${shortTeams.length} team(s) have fewer than ${triesMatchRangeCount} completed matches in this view — standings use all available matches.`,
        );
      }
    }

    const triesCoverage = assessFixtureCoverage(built.scoringPerspectives, definition, {
      seasonFixtureCount: built.completedMatchCount,
    });

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.triesCoveragePct >= 80
            ? triesCoverage.confidence
            : built.triesCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.triesCoveragePct,
        rows: built.rows,
        warnings: [...new Set([...triesCoverage.warnings, ...triesWarnings])],
        fixtureCount: built.completedMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          triesScoredPeriod,
          triesMatchRangePreset,
          triesMatchRangeCount,
          triesScoredSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        triesScoredPeriod,
        triesMatchRangePreset,
        triesMatchRangeCount,
        triesScoredSortBy,
        triesScoredMatchCount: built.qualifyingMatchCount,
        triesScoredCompletedMatchCount: built.completedMatchCount,
        triesScoredCoveragePct: built.triesCoveragePct,
        triesScoredFilterSummary: built.filterSummary,
        triesScoredCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "tries_conceded") {
    const triesWarnings = [...warnings];

    if (!context.seasonId) {
      triesWarnings.push("Season is required for the tries conceded table.");
      return emptyResult(definition, context, triesWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const triesConcededPeriod = parseTriesConcededPeriod(context.triesScoredPeriod);
    const triesMatchRangePreset = parseTriesMatchRangePreset(context.triesMatchRangePreset);
    const triesMatchRangeCount = parseTriesMatchRangeCount(
      triesMatchRangePreset,
      context.triesMatchRangeCustom,
    );
    const triesConcededSortBy = parseTriesConcededSortBy(context.triesConcededSortBy);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildTriesConcededTableStandings({
      seasonPerspectives: perspectives,
      rules: scoringRules,
      tableView,
      period: triesConcededPeriod,
      matchRangeCount: triesMatchRangeCount,
      matchRangePreset: triesMatchRangePreset,
      minMatchesPlayed,
      sortBy: triesConcededSortBy,
      dateFrom: context.dateFrom,
      dateTo: context.dateTo,
    });

    if (built.completedMatchCount === 0) {
      triesWarnings.push("No completed fixtures found for the selected scope.");
    } else {
      triesWarnings.push(
        ...bettingTableScopeWarnings({
          completedMatchCount: built.completedMatchCount,
          qualifyingMatchCount: built.qualifyingMatchCount,
          rows: built.rows,
          triesCoveragePct: built.triesCoveragePct,
        }),
      );
    }
    if (triesConcededPeriod !== "full_match" && built.scoringPerspectives.length === 0) {
      triesWarnings.push(
        "Period try counts require timed try events — this filter is unavailable without event timing.",
      );
    }
    if (minMatchesPlayed > 1) {
      triesWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with try data.`,
      );
    }
    if (triesMatchRangeCount != null) {
      const shortTeams = built.rows.filter(
        (row) =>
          row.matchesUsed != null &&
          row.matchesRequested != null &&
          row.matchesUsed < row.matchesRequested,
      );
      if (shortTeams.length > 0) {
        triesWarnings.push(
          `${shortTeams.length} team(s) have fewer than ${triesMatchRangeCount} completed matches in this view — standings use all available matches.`,
        );
      }
    }

    const triesCoverage = assessFixtureCoverage(built.scoringPerspectives, definition, {
      seasonFixtureCount: built.completedMatchCount,
    });

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.triesCoveragePct >= 80
            ? triesCoverage.confidence
            : built.triesCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.triesCoveragePct,
        rows: built.rows,
        warnings: [...new Set([...triesCoverage.warnings, ...triesWarnings])],
        fixtureCount: built.completedMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          triesScoredPeriod: triesConcededPeriod,
          triesMatchRangePreset,
          triesMatchRangeCount,
          triesConcededSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        triesConcededPeriod,
        triesMatchRangePreset,
        triesMatchRangeCount,
        triesConcededSortBy,
        triesConcededMatchCount: built.qualifyingMatchCount,
        triesConcededCompletedMatchCount: built.completedMatchCount,
        triesConcededCoveragePct: built.triesCoveragePct,
        triesConcededFilterSummary: built.filterSummary,
        triesConcededCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "both_teams_scored_tries") {
    const btstWarnings = [...warnings];

    if (!context.seasonId) {
      btstWarnings.push("Season is required for the both teams scored tries table.");
      return emptyResult(definition, context, btstWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const triesMatchRangePreset = parseTriesMatchRangePreset(context.triesMatchRangePreset);
    const triesMatchRangeCount = parseTriesMatchRangeCount(
      triesMatchRangePreset,
      context.triesMatchRangeCustom,
    );
    const bothTeamsScoredTriesSortBy = parseBothTeamsScoredTriesSortBy(
      context.bothTeamsScoredTriesSortBy,
    );
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildBothTeamsScoredTriesTableStandings({
      seasonPerspectives: perspectives,
      rules: scoringRules,
      tableView,
      matchRangeCount: triesMatchRangeCount,
      matchRangePreset: triesMatchRangePreset,
      minMatchesPlayed,
      sortBy: bothTeamsScoredTriesSortBy,
      dateFrom: context.dateFrom,
      dateTo: context.dateTo,
    });

    if (built.completedMatchCount === 0) {
      btstWarnings.push("No completed fixtures found for the selected scope.");
    } else {
      btstWarnings.push(
        ...bettingTableScopeWarnings({
          completedMatchCount: built.completedMatchCount,
          qualifyingMatchCount: built.qualifyingMatchCount,
          rows: built.rows,
          triesCoveragePct: built.triesCoveragePct,
        }),
      );
    }
    if (minMatchesPlayed > 1) {
      btstWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with try data.`,
      );
    }
    if (triesMatchRangeCount != null) {
      const shortTeams = built.rows.filter(
        (row) =>
          row.matchesUsed != null &&
          row.matchesRequested != null &&
          row.matchesUsed < row.matchesRequested,
      );
      if (shortTeams.length > 0) {
        btstWarnings.push(
          `${shortTeams.length} team(s) have fewer than ${triesMatchRangeCount} completed matches in this view — standings use all available matches.`,
        );
      }
    }

    const triesCoverage = assessFixtureCoverage(built.scoringPerspectives, definition, {
      seasonFixtureCount: built.completedMatchCount,
    });

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.triesCoveragePct >= 80
            ? triesCoverage.confidence
            : built.triesCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.triesCoveragePct,
        rows: built.rows,
        warnings: [...new Set([...triesCoverage.warnings, ...btstWarnings])],
        fixtureCount: built.completedMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          triesMatchRangePreset,
          triesMatchRangeCount,
          bothTeamsScoredTriesSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        triesMatchRangePreset,
        triesMatchRangeCount,
        bothTeamsScoredTriesSortBy,
        bothTeamsScoredTriesMatchCount: built.qualifyingMatchCount,
        bothTeamsScoredTriesCompletedMatchCount: built.completedMatchCount,
        bothTeamsScoredTriesCoveragePct: built.triesCoveragePct,
        bothTeamsScoredTriesFilterSummary: built.filterSummary,
        bothTeamsScoredTriesCalculationNote: built.filterSummary,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "winning_bonus_points") {
    const bonusWarnings = [...warnings];

    if (!context.seasonId) {
      bonusWarnings.push("Season is required for the winning bonus points table.");
      return emptyResult(definition, context, bonusWarnings, perspectives);
    }

    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const triesMatchRangePreset = parseTriesMatchRangePreset(context.triesMatchRangePreset);
    const triesMatchRangeCount = parseTriesMatchRangeCount(
      triesMatchRangePreset,
      context.triesMatchRangeCustom,
    );
    const winningBonusTypeFilter = parseWinningBonusTypeFilter(context.winningBonusTypeFilter);
    const winningBonusPointsSortBy = parseWinningBonusPointsSortBy(
      context.winningBonusPointsSortBy,
    );
    const competition = context.competitionId
      ? await getCompetitionById(context.competitionId)
      : null;
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildWinningBonusPointsTableStandings({
      seasonPerspectives: perspectives,
      rules: scoringRules,
      competitionSlug: competition?.slug,
      competitionType: competition?.competitionType,
      tableView,
      matchRangeCount: triesMatchRangeCount,
      matchRangePreset: triesMatchRangePreset,
      bonusType: winningBonusTypeFilter,
      minMatchesPlayed,
      sortBy: winningBonusPointsSortBy,
      dateFrom: context.dateFrom,
      dateTo: context.dateTo,
    });

    if (built.bonusNotApplicable) {
      bonusWarnings.push(
        "Bonus points are not applicable for this competition season — the table is unavailable.",
      );
      return attachTableLabMetadata(
        {
          definition,
          available: false,
          confidence: "low",
          dataCoveragePct: 0,
          rows: [],
          warnings: bonusWarnings,
          fixtureCount: built.completedMatchCount,
          evaluatedFixtureCount: 0,
          context: {
            ...context,
            minMatchesPlayed,
            tableView,
            triesMatchRangePreset,
            triesMatchRangeCount,
            winningBonusTypeFilter,
            winningBonusPointsSortBy,
          },
          filterSummary: built.scoringRulesSummary,
          winningBonusTypeFilter,
          winningBonusPointsSortBy,
          winningBonusScoringRulesSummary: built.scoringRulesSummary,
          winningBonusMaximumTablePoints: built.maximumTablePoints,
          winningBonusNotApplicable: true,
          scoringRules,
        },
        context,
        tableView,
        perspectives,
      );
    }

    if (built.completedMatchCount === 0) {
      bonusWarnings.push("No completed fixtures found for the selected scope.");
    } else {
      bonusWarnings.push(
        ...bettingTableScopeWarnings({
          completedMatchCount: built.completedMatchCount,
          qualifyingMatchCount: built.qualifyingMatchCount,
          rows: built.rows,
          triesCoveragePct: built.bonusCoveragePct,
        }),
      );
    }
    if (minMatchesPlayed > 1) {
      bonusWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} matches with bonus data.`,
      );
    }
    if (triesMatchRangeCount != null) {
      const shortTeams = built.rows.filter(
        (row) =>
          row.matchesUsed != null &&
          row.matchesRequested != null &&
          row.matchesUsed < row.matchesRequested,
      );
      if (shortTeams.length > 0) {
        bonusWarnings.push(
          `${shortTeams.length} team(s) have fewer than ${triesMatchRangeCount} completed matches in this view — standings use all available matches.`,
        );
      }
    }

    const bonusCoverage = assessFixtureCoverage(built.scoringPerspectives, definition, {
      seasonFixtureCount: built.completedMatchCount,
    });

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence:
          built.bonusCoveragePct >= 80
            ? bonusCoverage.confidence
            : built.bonusCoveragePct >= 40
              ? "medium"
              : "low",
        dataCoveragePct: built.bonusCoveragePct,
        rows: built.rows,
        warnings: [...new Set([...bonusCoverage.warnings, ...bonusWarnings])],
        fixtureCount: built.completedMatchCount,
        evaluatedFixtureCount: built.scoringPerspectives.length,
        context: {
          ...context,
          minMatchesPlayed,
          tableView,
          triesMatchRangePreset,
          triesMatchRangeCount,
          winningBonusTypeFilter,
          winningBonusPointsSortBy,
        },
        filterSummary: built.filterSummary,
        dateRangeLabel: built.dateRangeLabel,
        triesMatchRangePreset,
        triesMatchRangeCount,
        winningBonusTypeFilter,
        winningBonusPointsSortBy,
        winningBonusPointsMatchCount: built.qualifyingMatchCount,
        winningBonusPointsCompletedMatchCount: built.completedMatchCount,
        winningBonusPointsCoveragePct: built.bonusCoveragePct,
        winningBonusPointsFilterSummary: built.filterSummary,
        winningBonusPointsCalculationNote: built.filterSummary,
        winningBonusScoringRulesSummary: built.scoringRulesSummary,
        winningBonusMaximumTablePoints: built.maximumTablePoints,
        winningBonusNotApplicable: false,
        scoringRules,
      },
      context,
      tableView,
      built.scoringPerspectives,
      {
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
      },
    );
  }

  if (definition.id === "live_table") {
    const liveWarnings = [...warnings];
    if (!context.seasonId) {
      liveWarnings.push("Season is required for the live table.");
      return emptyResult(definition, context, liveWarnings, perspectives);
    }

    const includeLiveMatches = parseLiveTableBoolean(context.includeLiveMatches, true);
    const includeScheduledMatches = parseLiveTableBoolean(context.includeScheduledMatches, false);
    const showMovement = parseLiveTableBoolean(context.showMovement, true);

    const livePerspectives = await loadPerspectives({
      seasonId: context.seasonId,
      competitionId: context.competitionId,
      liveTable: { includeLiveMatches, includeScheduledMatches },
    });

    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildLiveTableStandings({
      perspectives: livePerspectives,
      rules: scoringRules,
      tableView,
      showMovement,
    });

    const coveragePerspectives = livePerspectives.filter(
      (row) => row.countsTowardStandings !== false,
    );
    const liveCoverage = assessFixtureCoverage(coveragePerspectives, definition);

    if (built.rows.length === 0) {
      liveWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (built.liveFixtureCount > 0) {
      liveWarnings.push(
        `${built.liveFixtureCount} live match${built.liveFixtureCount === 1 ? "" : "es"} included in this table.`,
      );
    }
    if (includeScheduledMatches && built.scheduledFixtureCount > 0) {
      liveWarnings.push(
        `${built.scheduledFixtureCount} scheduled match${built.scheduledFixtureCount === 1 ? "" : "es"} listed but not counted in standings.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: liveCoverage.confidence,
        dataCoveragePct: liveCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...liveCoverage.warnings, ...liveWarnings],
        fixtureCount: new Set(coveragePerspectives.map((row) => row.fixtureId)).size,
        evaluatedFixtureCount: coveragePerspectives.length,
        context: {
          ...context,
          tableView,
          includeLiveMatches,
          includeScheduledMatches,
          showMovement,
        },
        liveUpdatedAt: new Date().toISOString(),
        liveMatchCount: built.liveFixtureCount,
        liveTableCalculationNote: liveTableCalculationNote(),
        showMovement,
        includeLiveMatches,
      },
      context,
      tableView,
      coveragePerspectives,
    );
  }

  if (definition.id === "full_table") {
    const standingView = standingViewForTableView(tableView);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const synced = await trySyncedStandings(context.seasonId, standingView);
    if (synced?.length && coverage.fixtureCount > 0) {
      return attachTableLabMetadata(
        {
          definition,
          available: true,
          confidence: "high",
          dataCoveragePct: 100,
          rows: synced,
          warnings: [],
          fixtureCount: coverage.fixtureCount,
          evaluatedFixtureCount: coverage.evaluatedFixtureCount,
          context,
        },
        context,
        tableView,
        perspectives,
      );
    }

    let scoped = perspectives;
    if (tableView === "home") scoped = filterBySide(perspectives, "home");
    if (tableView === "away") scoped = filterBySide(perspectives, "away");

    const rows = buildLeagueStandingsFromPerspectives(scoped, scoringRules);
    if (rows.length === 0) {
      warnings.push("No rows could be calculated for the selected scope.");
    }

    return attachTableLabMetadata(
      {
        definition,
        available: rows.length > 0,
        confidence: coverage.confidence,
        dataCoveragePct: coverage.dataCoveragePct,
        rows,
        warnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: coverage.evaluatedFixtureCount,
        context,
      },
      context,
      tableView,
      perspectives,
    );
  }

  if (definition.id === "form_table") {
    const formMatchCount = parseFormMatchCount(context.formMatchCount ?? DEFAULT_FORM_MATCH_COUNT);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const formWarnings = [...warnings];
    const { rows, dateRangeLabel } = buildFormTableStandings({
      perspectives,
      matchCount: formMatchCount,
      tableView,
      rules: scoringRules,
    });

    if (rows.length === 0) {
      formWarnings.push("No rows could be calculated for the selected scope.");
    }

    const shortTeams = rows.filter(
      (row) =>
        row.matchesUsed != null &&
        row.matchesRequested != null &&
        row.matchesUsed < row.matchesRequested,
    );
    if (shortTeams.length > 0) {
      formWarnings.push(
        `${shortTeams.length} team(s) have fewer than ${formMatchCount} completed matches in this view — standings use all available matches.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: rows.length > 0,
        confidence: coverage.confidence,
        dataCoveragePct: coverage.dataCoveragePct,
        rows,
        warnings: formWarnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: coverage.evaluatedFixtureCount,
        context: { ...context, formMatchCount, tableView },
      },
      context,
      tableView,
      perspectives,
      { formMatchCount, dateRangeLabel },
    );
  }

  if (definition.id === "hemisphere_table") {
    const hemisphereMode = context.hemisphereMode ?? "summary";
    const hemisphereMatchType = context.hemisphereMatchType ?? "all";
    const includeUnknown = context.includeUnknownHemisphere === true;
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildHemisphereTable({
      perspectives,
      mode: hemisphereMode,
      tableView,
      matchType: hemisphereMatchType,
      includeUnknown,
      rules: scoringRules,
    });
    const hemisphereWarnings = [...warnings, ...built.warnings];
    if (built.rows.length === 0) {
      hemisphereWarnings.push("No rows could be calculated for the selected hemisphere scope.");
    }
    const confidence = assessHemisphereConfidence({
      perspectives,
      rows: built.rows,
      unknownTeamCount: built.unknownTeamCount,
    });

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence,
        dataCoveragePct: coverage.dataCoveragePct,
        rows: built.rows,
        warnings: hemisphereWarnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: coverage.evaluatedFixtureCount,
        context: {
          ...context,
          tableView,
          hemisphereMode,
          hemisphereMatchType,
          includeUnknownHemisphere: includeUnknown,
        },
      },
      context,
      tableView,
      perspectives,
      {
        hemisphereMode,
        hemisphereMatchType,
        includeUnknownHemisphere: includeUnknown,
        unknownTeamCount: built.unknownTeamCount,
        hemisphereRuleNote: HEMISPHERE_RULE_EXPLANATION,
      },
    );
  }

  if (definition.id === "home_table") {
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const homeWarnings = [...warnings];

    const synced = await trySyncedStandings(context.seasonId, "home");
    if (synced?.length && coverage.fixtureCount > 0) {
      const rows = applyHomeTablePostProcessing(synced, minMatchesPlayed);
      if (minMatchesPlayed > 1) {
        homeWarnings.push(
          `Showing teams with at least ${minMatchesPlayed} home matches played.`,
        );
      }
      return attachTableLabMetadata(
        {
          definition,
          available: rows.length > 0,
          confidence: "high",
          dataCoveragePct: 100,
          rows,
          warnings: homeWarnings,
          fixtureCount: coverage.fixtureCount,
          evaluatedFixtureCount: coverage.evaluatedFixtureCount,
          context: { ...context, minMatchesPlayed },
        },
        context,
        "home",
        perspectives,
        { minMatchesPlayed },
      );
    }

    const { rows, dateRangeLabel } = buildHomeTableStandings({
      perspectives,
      rules: scoringRules,
      minMatchesPlayed,
    });

    if (rows.length === 0) {
      homeWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      homeWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} home matches played.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: rows.length > 0,
        confidence: coverage.confidence,
        dataCoveragePct: coverage.dataCoveragePct,
        rows,
        warnings: homeWarnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: coverage.evaluatedFixtureCount,
        context: { ...context, minMatchesPlayed },
      },
      context,
      "home",
      perspectives,
      { minMatchesPlayed, dateRangeLabel },
    );
  }

  if (definition.id === "all_time_premiership") {
    const allTimeWarnings = [...warnings];
    const seasonRangeMode = parseAllTimeSeasonRangeMode(context.allTimeSeasonRangeMode);
    const teamStatus = parseAllTimeTeamStatus(context.allTimeTeamStatus);
    const sortBy = parseAllTimeSortBy(context.allTimeSortBy);
    const seasonFromYear = parseSeasonYearParam(context.allTimeSeasonFromYear);
    const seasonToYear = parseSeasonYearParam(context.allTimeSeasonToYear);

    const currentYear = currentDomesticSeasonStartYear();
    const currentTeamCanonicalKeys = new Set(
      perspectives
        .filter((row) => row.seasonStartYear === currentYear)
        .map((row) => canonicalKeyFromName(row.teamName)),
    );

    const built = buildAllTimePremiershipTable({
      perspectives,
      tableView,
      seasonRangeMode,
      seasonFromYear,
      seasonToYear,
      teamStatus,
      currentTeamCanonicalKeys,
      sortBy,
    });

    allTimeWarnings.push(...built.warnings);
    if (built.rows.length === 0) {
      allTimeWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (built.identityReviewCount > 0) {
      allTimeWarnings.push(
        `${built.identityReviewCount} team identity mapping(s) need editor review.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: built.coverage.resultsCoveragePct >= 90 ? "high" : "medium",
        dataCoveragePct: built.coverage.resultsCoveragePct,
        rows: built.rows,
        warnings: allTimeWarnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: built.matchCount,
        context: {
          ...context,
          allTimeSeasonRangeMode: seasonRangeMode,
          allTimeSeasonFromYear: seasonFromYear ?? undefined,
          allTimeSeasonToYear: seasonToYear ?? undefined,
          allTimeTeamStatus: teamStatus,
          allTimeSortBy: sortBy,
          tableView,
        },
      },
      context,
      tableView,
      perspectives,
      {
        allTimeSeasonsLabel: built.seasonsIncludedLabel,
        allTimeCoverage: built.coverage,
        allTimeTeamCount: built.teamCount,
        allTimeMatchCount: built.matchCount,
        allTimeIdentityReviewCount: built.identityReviewCount,
        historicScoringNotice: built.historicScoringNotice,
      },
    );
  }

  if (definition.id === "on_this_date") {
    const asOfDateOnly = parseAsOfDateParam(context.asOfDate);
    const onDateWarnings = [...warnings];

    if (!context.seasonId) {
      onDateWarnings.push("Season is required to build a table on this date.");
      return emptyResult(definition, context, onDateWarnings, perspectives);
    }

    const db = getDb();
    const [seasonRow] = await db
      .select()
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, context.seasonId))
      .limit(1);
    const seasonStartYear = seasonRow?.year ?? parseSeasonStartYear(seasonRow?.label ?? "");
    const competition = context.competitionId
      ? await getCompetitionById(context.competitionId)
      : null;
    const rules = resolveScoringRulesForSeasonTable({
      competitionSlug: competition?.slug,
      competitionType: competition?.competitionType,
      seasonStartYear,
    });

    const built = buildOnThisDateTableStandings({
      perspectives,
      rules,
      asOfDateOnly,
      tableView,
      seasonStartYear,
      applyPremiershipDeductions: competition?.slug === "premiership",
    });
    const dateCoverage = assessFixtureCoverage(built.scopedPerspectives, definition);

    if (built.deductionNotice) onDateWarnings.push(built.deductionNotice);
    if (built.rows.length === 0) {
      onDateWarnings.push("No rows could be calculated for the selected scope.");
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: dateCoverage.confidence,
        dataCoveragePct: dateCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...dateCoverage.warnings, ...onDateWarnings],
        fixtureCount: built.matchCount,
        evaluatedFixtureCount: built.teamFixtureCount,
        context: { ...context, asOfDate: asOfDateOnly, tableView },
        asOfDateLabel: built.asOfDateLabel,
        tableOnDateStatus: built.tableStatus,
        tableOnDateCalculationNote: built.calculationNote,
        onThisDateMatchCount: built.matchCount,
        tableOnDateDeductionNotice: built.deductionNotice,
      },
      context,
      tableView,
      built.scopedPerspectives,
      {
        asOfDateLabel: built.asOfDateLabel,
        tableOnDateStatus: built.tableStatus,
        tableOnDateCalculationNote: built.calculationNote,
        onThisDateMatchCount: built.matchCount,
        tableOnDateDeductionNotice: built.deductionNotice,
      },
    );
  }

  if (definition.id === "between_dates") {
    const defaults = defaultBetweenDatesRange();
    const startDate = parseDateOnlyParam(context.dateFrom, defaults.startDate);
    const endDate = parseDateOnlyParam(context.dateTo, defaults.endDate);
    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const betweenWarnings = [...warnings];

    const competition = context.competitionId
      ? await getCompetitionById(context.competitionId)
      : null;
    let seasonStartYear: number | null = null;
    if (context.seasonId) {
      const db = getDb();
      const [seasonRow] = await db
        .select()
        .from(competitionSeasons)
        .where(eq(competitionSeasons.id, context.seasonId))
        .limit(1);
      seasonStartYear = seasonRow?.year ?? parseSeasonStartYear(seasonRow?.label ?? "");
    }
    const rules =
      seasonStartYear != null
        ? resolveScoringRulesForSeasonTable({
            competitionSlug: competition?.slug,
            competitionType: competition?.competitionType,
            seasonStartYear,
          })
        : await getScoringRulesForCompetition(context.competitionId);

    const built = buildBetweenDatesTableStandings({
      perspectives,
      rules,
      startDate,
      endDate,
      tableView,
      minMatchesPlayed,
    });

    if (!built.rangeValid) {
      betweenWarnings.push(built.rangeError ?? "Invalid date range.");
      return emptyResult(definition, context, betweenWarnings, perspectives);
    }

    const rangeCoverage = assessFixtureCoverage(built.scopedPerspectives, definition);
    if (built.rows.length === 0) {
      betweenWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      betweenWarnings.push(`Showing teams with at least ${minMatchesPlayed} matches played.`);
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: rangeCoverage.confidence,
        dataCoveragePct: rangeCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...rangeCoverage.warnings, ...betweenWarnings],
        fixtureCount: built.matchCount,
        evaluatedFixtureCount: built.teamFixtureCount,
        context: { ...context, dateFrom: startDate, dateTo: endDate, minMatchesPlayed, tableView },
        seasonsIncludedLabel: built.seasonsIncludedLabel,
        betweenDatesStartLabel: startDate,
        betweenDatesEndLabel: endDate,
        betweenDatesCalculationNote: built.calculationNote,
        betweenDatesMatchCount: built.matchCount,
        dateRangeLabel: built.dateRangeLabel,
      },
      context,
      tableView,
      built.scopedPerspectives,
      {
        seasonsIncludedLabel: built.seasonsIncludedLabel,
        minMatchesPlayed,
        dateRangeLabel: built.dateRangeLabel,
        betweenDatesStartLabel: startDate,
        betweenDatesEndLabel: endDate,
        betweenDatesCalculationNote: built.calculationNote,
        betweenDatesMatchCount: built.matchCount,
      },
    );
  }

  if (definition.id === "calendar_year") {
    const calendarYear = parseCalendarYear(context.calendarYear);
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const calendarWarnings = [...warnings];

    const built = buildCalendarYearTableStandings({
      perspectives,
      rules: scoringRules,
      calendarYear,
      tableView,
      minMatchesPlayed,
    });
    const yearCoverage = assessFixtureCoverage(built.scopedPerspectives, definition);

    if (built.rows.length === 0) {
      calendarWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      calendarWarnings.push(`Showing teams with at least ${minMatchesPlayed} matches played.`);
    }

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: yearCoverage.confidence,
        dataCoveragePct: yearCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...yearCoverage.warnings, ...calendarWarnings],
        fixtureCount: built.matchCount,
        evaluatedFixtureCount: built.teamFixtureCount,
        context: { ...context, calendarYear, minMatchesPlayed, tableView },
        calendarYear,
        calendarYearCalculationNote: built.calculationNote,
        seasonsIncludedLabel: built.seasonsIncludedLabel,
        calendarYearMatchCount: built.matchCount,
        dateRangeLabel: built.dateRangeLabel,
      },
      context,
      tableView,
      built.scopedPerspectives,
      {
        calendarYear,
        seasonsIncludedLabel: built.seasonsIncludedLabel,
        minMatchesPlayed,
        calendarYearCalculationNote: built.calculationNote,
        calendarYearMatchCount: built.matchCount,
      },
    );
  }

  if (definition.id === "away_table") {
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const minMatchesPlayed = parseMinMatchesPlayed(context.minMatchesPlayed);
    const includeNeutralVenue = context.includeNeutralVenueForAwayTable === true;
    const awayWarnings = [...warnings];

    const synced = await trySyncedStandings(context.seasonId, "away");
    if (synced?.length && coverage.fixtureCount > 0) {
      const rows = applyAwayTablePostProcessing(synced, minMatchesPlayed);
      if (minMatchesPlayed > 1) {
        awayWarnings.push(
          `Showing teams with at least ${minMatchesPlayed} away matches played.`,
        );
      }
      return attachTableLabMetadata(
        {
          definition,
          available: rows.length > 0,
          confidence: "high",
          dataCoveragePct: 100,
          rows,
          warnings: awayWarnings,
          fixtureCount: coverage.fixtureCount,
          evaluatedFixtureCount: coverage.evaluatedFixtureCount,
          context: { ...context, minMatchesPlayed, includeNeutralVenueForAwayTable: includeNeutralVenue },
        },
        context,
        "away",
        perspectives,
        { minMatchesPlayed },
      );
    }

    const { rows, dateRangeLabel, excludedNeutralMatchCount } = buildAwayTableStandings({
      perspectives,
      rules: scoringRules,
      minMatchesPlayed,
      includeNeutralVenue,
    });

    if (!includeNeutralVenue && excludedNeutralMatchCount > 0) {
      awayWarnings.push(
        excludedNeutralMatchCount === 1
          ? "1 neutral-venue away match excluded from this table."
          : `${excludedNeutralMatchCount} neutral-venue away matches excluded from this table.`,
      );
    }
    if (rows.length === 0) {
      awayWarnings.push("No rows could be calculated for the selected scope.");
    }
    if (minMatchesPlayed > 1) {
      awayWarnings.push(
        `Showing teams with at least ${minMatchesPlayed} away matches played.`,
      );
    }

    return attachTableLabMetadata(
      {
        definition,
        available: rows.length > 0,
        confidence: coverage.confidence,
        dataCoveragePct: coverage.dataCoveragePct,
        rows,
        warnings: awayWarnings,
        fixtureCount: coverage.fixtureCount,
        evaluatedFixtureCount: coverage.evaluatedFixtureCount,
        context: { ...context, minMatchesPlayed, includeNeutralVenueForAwayTable: includeNeutralVenue },
      },
      context,
      "away",
      perspectives,
      { minMatchesPlayed, dateRangeLabel },
    );
  }

  if (definition.id === "try_bonus_point") {
    const tryBonusWarnings = [...warnings];
    const scoringRules = await getScoringRulesForCompetition(context.competitionId);
    const built = buildTryBonusPointStandings({ perspectives, rules: scoringRules });
    tryBonusWarnings.push(
      ...bettingTableScopeWarnings({
        completedMatchCount: built.seasonFixtureCount,
        qualifyingMatchCount: built.qualifyingFixtureCount,
        rows: built.rows,
      }),
    );

    const tryBonusCoverage = assessFixtureCoverage(
      perspectives.filter((row) => row.triesFor != null),
      definition,
      { seasonFixtureCount: built.seasonFixtureCount },
    );

    return attachTableLabMetadata(
      {
        definition,
        available: built.rows.length > 0,
        confidence: built.rows.length > 0 ? tryBonusCoverage.confidence : "unavailable",
        dataCoveragePct: tryBonusCoverage.dataCoveragePct,
        rows: built.rows,
        warnings: [...new Set([...tryBonusCoverage.warnings, ...tryBonusWarnings])],
        fixtureCount: built.seasonFixtureCount,
        evaluatedFixtureCount: built.qualifyingFixtureCount,
        context,
        scoringRules,
      },
      context,
      tableView,
      perspectives,
    );
  }

  const available = isTableAvailable(definition, coverage);
  if (!available) {
    return emptyResult(definition, context, warnings, perspectives);
  }

  let rows: RugbyTableStandingRow[] = [];

  switch (definition.id) {
    case "custom_match_period":
      warnings.push("Custom period scoring requires timed match events; using final 20 minutes proxy when events exist.");
      rows = buildStandingsFromPerspectives(
        filterPerspectives(perspectives, (row) => row.finalTwentyFor != null),
        (row) => row.finalTwentyFor,
      );
      break;
    case "tries_conceded_defence":
      rows = buildMetricStandings(
        filterPerspectives(perspectives, (row) => row.triesAgainst != null),
        (row) => row.triesAgainst!,
      );
      break;
    case "losing_bonus_point": {
      rows = buildMetricStandings(perspectives, (row) => {
        const { bonusPoints, result } = matchLeaguePoints(row.pointsFor, row.pointsAgainst, row.triesFor);
        return result === "lost" ? bonusPoints : 0;
      });
      break;
    }
    case "bonus_points":
      rows = buildMetricStandings(perspectives, (row) =>
        matchLeaguePoints(row.pointsFor, row.pointsAgainst, row.triesFor).bonusPoints,
      );
      break;
    case "points_scored":
      rows = buildMetricStandings(perspectives, (row) => row.pointsFor);
      break;
    case "points_conceded":
      rows = buildMetricStandings(perspectives, (row) => row.pointsAgainst, { sortAscending: true });
      break;
    case "wins_to_nil":
      rows = buildMetricStandings(
        filterPerspectives(perspectives, (row) => row.pointsFor > row.pointsAgainst && row.pointsAgainst === 0),
        () => 1,
      );
      break;
    case "scoreless_matches":
      rows = buildMetricStandings(
        filterPerspectives(perspectives, (row) => row.pointsFor === 0),
        () => 1,
      );
      break;
    case "tryless_opponent":
      rows = buildMetricStandings(
        filterPerspectives(perspectives, (row) => row.triesAgainst != null && row.triesAgainst === 0),
        () => 1,
      );
      break;
    case "lineout_won":
      rows = buildMetricStandings(perspectives, (row) => row.lineoutsWon);
      break;
    case "lineout_lost":
      rows = buildMetricStandings(perspectives, (row) => row.lineoutsLost, { sortAscending: true });
      break;
    case "lineout_success_pct":
      rows = buildMetricStandings(perspectives, (row) =>
        lineoutSuccessPct(row.lineoutsWon, row.lineoutsLost),
      );
      break;
    case "scrum_success_pct":
      rows = buildMetricStandings(perspectives, (row) => row.scrumSuccessPct);
      break;
    case "scrum_penalties_won":
      rows = buildMetricStandings(perspectives, (row) => row.scrumPenaltiesWon);
      break;
    case "scrum_penalties_conceded":
      rows = buildMetricStandings(perspectives, (row) => row.scrumPenaltiesConceded, {
        sortAscending: true,
      });
      break;
    case "set_piece_dominance":
      rows = buildMetricStandings(perspectives, (row) => {
        const lineout = lineoutSuccessPct(row.lineoutsWon, row.lineoutsLost);
        const scrum = row.scrumSuccessPct;
        if (lineout == null && scrum == null) return null;
        if (lineout == null) return scrum;
        if (scrum == null) return lineout;
        return Math.round(((lineout + scrum) / 2) * 10) / 10;
      });
      break;
    case "carries":
      rows = buildMetricStandings(perspectives, (row) => row.carries);
      break;
    case "metres_carried":
      rows = buildMetricStandings(perspectives, (row) => row.metres);
      break;
    case "metres_per_carry":
      rows = buildMetricStandings(perspectives, (row) =>
        row.metres != null && row.carries ? row.metres / row.carries : null,
      );
      break;
    case "line_breaks":
      rows = buildMetricStandings(perspectives, (row) => row.lineBreaks);
      break;
    case "defenders_beaten":
      rows = buildMetricStandings(perspectives, (row) => row.defendersBeaten);
      break;
    case "post_contact_metres":
      rows = buildMetricStandings(perspectives, (row) => row.postContactMetres);
      break;
    case "try_assists":
      rows = buildMetricStandings(perspectives, (row) => row.tryAssists);
      break;
    case "turnovers_won_attack":
    case "turnovers_won_defence":
      rows = buildMetricStandings(perspectives, (row) => row.turnoversWon);
      break;
    case "attacking_efficiency":
      rows = buildMetricStandings(perspectives, (row) =>
        row.carries ? row.pointsFor / row.carries : null,
      );
      break;
    case "tackles_made":
      rows = buildMetricStandings(perspectives, (row) => row.tacklesMade);
      break;
    case "tackle_completion_pct":
      rows = buildMetricStandings(perspectives, (row) =>
        ratioPct(row.tacklesCompleted, row.tacklesMade),
      );
      break;
    case "dominant_tackles":
      rows = buildMetricStandings(perspectives, (row) => row.dominantTackles);
      break;
    case "missed_tackles":
      rows = buildMetricStandings(perspectives, (row) => row.missedTackles, { sortAscending: true });
      break;
    case "defensive_efficiency":
      rows = buildMetricStandings(perspectives, (row) =>
        row.tacklesMade ? row.pointsAgainst / row.tacklesMade : null,
      );
      break;
    case "possession":
      rows = buildMetricStandings(perspectives, (row) =>
        row.possessionPct != null ? row.possessionPct * 100 : null,
      );
      break;
    case "territory":
      rows = buildMetricStandings(perspectives, (row) =>
        row.territoryPct != null ? row.territoryPct * 100 : null,
      );
      break;
    case "winning_less_possession":
      rows = buildMetricStandings(
        filterPerspectives(
          perspectives,
          (row) => row.possessionPct != null && row.possessionPct < 0.5 && row.pointsFor > row.pointsAgainst,
        ),
        () => 1,
      );
      break;
    case "losing_more_possession":
      rows = buildMetricStandings(
        filterPerspectives(
          perspectives,
          (row) => row.possessionPct != null && row.possessionPct > 0.5 && row.pointsFor < row.pointsAgainst,
        ),
        () => 1,
      );
      break;
    case "penalties_conceded":
      rows = buildMetricStandings(perspectives, (row) => row.penaltiesConceded, { sortAscending: true });
      break;
    case "yellow_cards":
      rows = buildMetricStandings(perspectives, (row) => row.yellowCards, { sortAscending: true });
      break;
    case "red_cards":
      rows = buildMetricStandings(perspectives, (row) => row.redCards, { sortAscending: true });
      break;
    case "cards_per_match":
      rows = buildMetricStandings(
        perspectives,
        (row) => (row.yellowCards ?? 0) + (row.redCards ?? 0),
        { sortAscending: true },
      );
      break;
    case "discipline_score":
      rows = buildMetricStandings(
        perspectives,
        (row) =>
          (row.penaltiesConceded ?? 0) + (row.yellowCards ?? 0) * 2 + (row.redCards ?? 0) * 5,
        { sortAscending: true },
      );
      break;
    default:
      rows = buildStandingsFromPerspectives(perspectives);
  }

  if (rows.length === 0) {
    warnings.push("No rows could be calculated for the selected scope.");
  }

  return applyDataLevels(
    {
      definition,
      available: rows.length > 0,
      confidence: coverage.confidence,
      dataCoveragePct: coverage.dataCoveragePct,
      rows,
      warnings,
      fixtureCount: coverage.fixtureCount,
      evaluatedFixtureCount: coverage.evaluatedFixtureCount,
      context,
    },
    perspectives,
  );
}

export async function listTableLabSeasons(competitionId?: string) {
  if (competitionId) {
    const competition = await getCompetitionById(competitionId);
    if (competition && usesDomesticSeasonCatalog(competition.competitionType)) {
      await syncDomesticSeasonCatalog(competitionId);
    }
  }

  const db = getDb();
  const query = db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .orderBy(desc(competitionSeasons.year), asc(competitionSeasons.label));

  const rows = competitionId
    ? await query.where(
        and(
          eq(competitionSeasons.competitionId, competitionId),
          eq(competitionSeasons.isDeprecated, false),
        ),
      )
    : await query.where(eq(competitionSeasons.isDeprecated, false));

  return decorateSeasonPickerRows(dedupeSeasonsByYear(rows));
}
