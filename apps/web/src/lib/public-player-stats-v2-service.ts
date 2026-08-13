/**
 * Player Stats V2 — central source of truth.
 * `getPlayerStats(playerId, filters)` aggregates match-level Rugby365 data.
 * UI must not recalculate intelligence or invent missing stats.
 */
import "server-only";

import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  playerMatchRatings,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { buildMatchDetailPath } from "./match-schedule-utils";
import {
  formatPeerAverageLabel,
  getPositionIntelligenceConfig,
  resolveIntelligencePositionGroup,
  type IntelligencePositionGroup,
} from "./player-intelligence-position-config";
import { isEligibleRecentAppearance } from "./player-recent-matches-utils";
import { performanceBandFor, type PerformanceBand } from "./match-rating-math";
import {
  getPlayerSpatialStats,
  mapSpatialToKickingZones,
  mapSpatialToPassingZones,
} from "./public-player-spatial-stats-service";
import { isInternationalCompetitionType } from "./public-player-filters";
import { pluralizePositionLabel } from "./player-ranking-engine";
import {
  aggregateDefensiveStats,
  averagePerAppearance,
  buildAvailableSeasons,
  buildKickingAccuracy,
  buildPointsBreakdown,
  CONVERSION_ATTEMPT_EXTRAS_KEYS,
  CONVERSION_MISS_EXTRAS_KEYS,
  DROP_GOAL_ATTEMPT_EXTRAS_KEYS,
  DROP_GOAL_MISS_EXTRAS_KEYS,
  extraNumber,
  formatAccuracyDetail,
  formatRankLabel,
  formatRankTooltip,
  formatStatNumber,
  isCompletedMatchStatus,
  isGoalKickRolePosition,
  kickMissAttributedToPlayer,
  knownValue,
  MISSED_GOAL_KICK_EXTRAS_KEYS,
  passSuccessPct,
  PENALTY_ATTEMPT_EXTRAS_KEYS,
  PENALTY_MISS_EXTRAS_KEYS,
  per80,
  rankAmongDetailed,
  resolveDefaultSeasonStart,
  resolveGoalKickAttempts,
  rugbySeasonLabelFromStart,
  rugbySeasonSlugFromKickoff,
  rugbySeasonStartFromKickoff,
  sharePct,
  successPct,
  sumKnown,
  tackleSuccessPct,
} from "./public-player-stats-v2-math";
import {
  currentDomesticSeasonStartYear,
  seasonDateRange,
  seasonSlugFromStartYear,
} from "./season-label-utils";
import type {
  ContributionRing,
  DefensiveStats,
  GameLogRow,
  GameLogRatingBand,
  KickingAccuracy,
  Per80Comparison,
  PlayerStatsCoverage,
  PlayerStatsFilters,
  PlayerStatsKpi,
  PlayerStatsV2Dto,
  SeasonAverageItem,
  StatsSlice,
  SummaryTableRow,
} from "./public-player-stats-v2-types";

type MatchGrain = {
  fixtureId: string;
  fixtureSlug: string | null;
  kickoffAt: Date | null;
  status: string;
  seasonStart: number | null;
  seasonSlug: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionName: string | null;
  competitionSlug: string | null;
  competitionType: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string | null;
  opponentName: string | null;
  opponentSlug: string | null;
  homeAway: "H" | "A" | "N" | null;
  homeScore: number | null;
  awayScore: number | null;
  result: "W" | "D" | "L" | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  squadRole: string | null;
  jerseyNumber: number | null;
  positionName: string | null;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  minutes: number | null;
  metres: number | null;
  tacklesMade: number | null;
  tacklesCompleted: number | null;
  dominantTackles: number | null;
  turnoversWon: number | null;
  assists: number | null;
  cleanBreaks: number | null;
  defendersBeaten: number | null;
  passes: number | null;
  offloads: number | null;
  missedTackles: number | null;
  badPasses: number | null;
  kicks: number | null;
  conversionAttempts: number | null;
  penaltyAttempts: number | null;
  dropGoalAttempts: number | null;
  missedGoalKicks: number | null;
  tackleBreaks: number | null;
  rating: number | null;
  ratingBand: PerformanceBand | null;
  ratingBreakdown: { attack: number | null; defence: number | null } | null;
  yellowCards: number;
  redCards: number;
  isInternational: boolean;
  eligible: boolean;
  href: string | null;
  hasPerf: boolean;
  syncedAt: string | null;
};

type Totals = {
  matches: number;
  minutes: Known;
  points: Known;
  tries: Known;
  conversions: Known;
  penalties: Known;
  dropGoals: Known;
  assists: Known;
  metres: Known;
  cleanBreaks: Known;
  defendersBeaten: Known;
  turnoversWon: Known;
  tacklesMade: Known;
  tacklesCompleted: Known;
  missedTackles: Known;
  dominantTackles: Known;
  offloads: Known;
  passes: Known;
  badPasses: Known;
  tackleBreaks: Known;
  yellowCards: Known;
  redCards: Known;
  conversionAttempts: Known;
  penaltyAttempts: Known;
  dropGoalAttempts: Known;
  missedGoalKicks: Known;
  ratingSum: number;
  rated: number;
};

type Known = { total: number; sample: number } | null;

type PeerAgg = {
  playerId: string;
  appearances: number;
  minutes: number;
  points: number | null;
  metres: number | null;
  passes: number | null;
  passMinutes: number;
  defendersBeaten: number | null;
  turnoversWon: number | null;
  tackleBreaks: number | null;
};

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeRating(r: number | null | undefined): number | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (r > 10) return Math.round((r / 10) * 10) / 10;
  return Math.round(r * 10) / 10;
}

function val(k: Known): number | null {
  return knownValue(k);
}

function resultFromScores(
  teamId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
  homeScore: number | null,
  awayScore: number | null,
  isNeutral: boolean,
): {
  venue: "H" | "A" | "N" | null;
  result: "W" | "D" | "L" | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
} {
  const isHome = teamId === homeTeamId;
  const isAway = teamId === awayTeamId;
  const venue: "H" | "A" | "N" | null = isNeutral ? "N" : isHome ? "H" : isAway ? "A" : null;
  if (homeScore == null || awayScore == null || (!isHome && !isAway)) {
    return { venue, result: null, scoreFor: null, scoreAgainst: null };
  }
  const scoreFor = isHome ? homeScore : awayScore;
  const scoreAgainst = isHome ? awayScore : homeScore;
  const result: "W" | "D" | "L" = scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D";
  return { venue, result, scoreFor, scoreAgainst };
}

function buildHref(input: {
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  competitionName: string | null;
  competitionCode: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  kickoffAt: Date | null;
}): string | null {
  if (input.planetRugbyUrl) {
    try {
      const path = new URL(input.planetRugbyUrl).pathname;
      const parts = path.split("/").filter(Boolean);
      const matchesIdx = parts.indexOf("matches");
      if (matchesIdx >= 0 && parts.length >= matchesIdx + 6) {
        return `/${parts.slice(matchesIdx).join("/")}`;
      }
    } catch {
      /* ignore */
    }
  }
  const matchId = input.externalMatchId?.trim() || null;
  const homeSlug = input.homeTeamSlug?.trim() || (input.homeTeamName ? slugify(input.homeTeamName) : "");
  const awaySlug = input.awayTeamSlug?.trim() || (input.awayTeamName ? slugify(input.awayTeamName) : "");
  const matchDate = input.kickoffAt ? input.kickoffAt.toISOString().slice(0, 10) : null;
  const competitionCode = input.competitionCode?.trim() || null;
  const competitionName = input.competitionName?.trim() || null;
  if (!matchId || !homeSlug || !awaySlug || !matchDate || !competitionCode || !competitionName) {
    return null;
  }
  return buildMatchDetailPath({
    matchId,
    competitionName,
    competitionId: competitionCode,
    homeTeamSlug: homeSlug,
    awayTeamSlug: awaySlug,
    matchDate,
  });
}

function grainFromRow(input: {
  row: {
    fixtureId: string;
    fixtureSlug: string | null;
    kickoffAt: Date | null;
    status: string;
    isNeutralVenue: boolean;
    competitionId: string | null;
    competitionNameStored: string | null;
    competitionName: string | null;
    competitionSlug: string | null;
    competitionType: string | null;
    competitionCode: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeScore: number | null;
    awayScore: number | null;
    planetRugbyUrl: string | null;
    externalMatchId: string | null;
    teamId: string;
    teamName: string;
    teamSlug: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    homeTeamSlug: string | null;
    awayTeamSlug: string | null;
    squadRole: string | null;
    jerseyNumber: number | null;
    positionName: string | null;
    tries: number;
    conversions: number;
    penalties: number;
    dropGoals: number;
    points: number;
  };
  perf: {
    minutesPlayed: number;
    metresCarried: number;
    tacklesMade: number;
    tacklesCompleted: number;
    dominantTackles: number;
    turnoversWon: number;
    tryAssists: number;
    lineBreaks: number;
    defendersBeaten: number;
    extras: unknown;
    syncedAt: Date | null;
  } | null;
  rating: { rating: number | null; minutesPlayed: number; performanceBand: string | null; attackContribution: number | null; defenceContribution: number | null } | null;
  cards: { yellow: number; red: number };
  kickMisses?: { conversions: number; penalties: number; dropGoals: number };
  internationalTeamId: string | null;
}): MatchGrain {
  const { row, perf, rating, cards, internationalTeamId } = input;
  const kickMisses = input.kickMisses ?? { conversions: 0, penalties: 0, dropGoals: 0 };
  const extras = perf?.extras ?? null;
  const minutesFromPerf = perf ? perf.minutesPlayed : null;
  const minutesFromRating =
    rating && rating.minutesPlayed > 0 ? rating.minutesPlayed : null;
  const minutes = minutesFromPerf != null ? minutesFromPerf : minutesFromRating;
  const ratingVal = normalizeRating(rating?.rating ?? null);
  const storedBand = rating?.performanceBand?.trim() || null;
  const ratingBand: PerformanceBand | null =
    storedBand &&
    [
      "exceptional",
      "outstanding",
      "very_good",
      "solid",
      "below_average",
      "poor",
    ].includes(storedBand)
      ? (storedBand as PerformanceBand)
      : ratingVal != null
        ? performanceBandFor(ratingVal)
        : null;
  const attackContribution =
    rating?.attackContribution != null && Number.isFinite(rating.attackContribution)
      ? Math.round(rating.attackContribution * 10) / 10
      : null;
  const defenceContribution =
    rating?.defenceContribution != null && Number.isFinite(rating.defenceContribution)
      ? Math.round(rating.defenceContribution * 10) / 10
      : null;
  const ratingBreakdown =
    attackContribution != null || defenceContribution != null
      ? { attack: attackContribution, defence: defenceContribution }
      : null;
  const eligible = isEligibleRecentAppearance({
    squadRole: row.squadRole,
    jerseyNumber: row.jerseyNumber,
    minutesPlayed: minutes,
    rating: ratingVal,
  });
  const { venue, result, scoreFor, scoreAgainst } = resultFromScores(
    row.teamId,
    row.homeTeamId,
    row.awayTeamId,
    row.homeScore,
    row.awayScore,
    row.isNeutralVenue,
  );
  const opponentIsHome = row.teamId === row.awayTeamId;
  const opponentName = opponentIsHome ? row.homeTeamName : row.awayTeamName;
  const opponentSlug = opponentIsHome ? row.homeTeamSlug : row.awayTeamSlug;
  const seasonStart = rugbySeasonStartFromKickoff(row.kickoffAt);
  const competitionName = row.competitionName ?? row.competitionNameStored;
  const isIntl =
    isInternationalCompetitionType(row.competitionType) ||
    (internationalTeamId != null && row.teamId === internationalTeamId);

  return {
    fixtureId: row.fixtureId,
    fixtureSlug: row.fixtureSlug,
    kickoffAt: row.kickoffAt,
    status: row.status,
    seasonStart,
    seasonSlug: seasonStart != null ? seasonSlugFromStartYear(seasonStart) : rugbySeasonSlugFromKickoff(row.kickoffAt),
    seasonLabel: seasonStart != null ? rugbySeasonLabelFromStart(seasonStart) : null,
    competitionId: row.competitionId,
    competitionName,
    competitionSlug: row.competitionSlug,
    competitionType: row.competitionType,
    teamId: row.teamId,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    opponentName: opponentName ?? null,
    opponentSlug: opponentSlug ?? null,
    homeAway: venue,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    result,
    scoreFor,
    scoreAgainst,
    squadRole: row.squadRole,
    jerseyNumber: row.jerseyNumber,
    positionName: row.positionName,
    tries: row.tries,
    conversions: row.conversions,
    penalties: row.penalties,
    dropGoals: row.dropGoals,
    points: row.points,
    minutes,
    metres: perf ? perf.metresCarried : null,
    tacklesMade: perf ? perf.tacklesMade : null,
    tacklesCompleted: perf ? perf.tacklesCompleted : null,
    dominantTackles: perf ? perf.dominantTackles : null,
    turnoversWon: perf ? perf.turnoversWon : null,
    assists: perf ? perf.tryAssists : null,
    cleanBreaks: perf ? perf.lineBreaks : null,
    defendersBeaten: perf ? perf.defendersBeaten : null,
    passes: extraNumber(extras, "passes"),
    offloads: extraNumber(extras, "offloads"),
    missedTackles: extraNumber(extras, "missedTackles", "missed_tackles"),
    badPasses: extraNumber(extras, "badPasses", "bad_passes"),
    kicks: extraNumber(extras, "kicks"),
    conversionAttempts: resolveGoalKickAttempts(
      extraNumber(extras, ...CONVERSION_ATTEMPT_EXTRAS_KEYS),
      row.conversions,
      kickMisses.conversions > 0 ? kickMisses.conversions : null,
      extraNumber(extras, ...CONVERSION_MISS_EXTRAS_KEYS),
    ),
    penaltyAttempts: resolveGoalKickAttempts(
      extraNumber(extras, ...PENALTY_ATTEMPT_EXTRAS_KEYS),
      row.penalties,
      kickMisses.penalties > 0 ? kickMisses.penalties : null,
      extraNumber(extras, ...PENALTY_MISS_EXTRAS_KEYS),
    ),
    dropGoalAttempts: resolveGoalKickAttempts(
      extraNumber(extras, ...DROP_GOAL_ATTEMPT_EXTRAS_KEYS),
      row.dropGoals,
      kickMisses.dropGoals > 0 ? kickMisses.dropGoals : null,
      extraNumber(extras, ...DROP_GOAL_MISS_EXTRAS_KEYS),
    ),
    missedGoalKicks: extraNumber(extras, ...MISSED_GOAL_KICK_EXTRAS_KEYS),
    tackleBreaks: extraNumber(extras, "tackleBreaks", "tackle_breaks", "brokenTackles"),
    rating: ratingVal,
    ratingBand,
    ratingBreakdown,
    yellowCards: cards.yellow,
    redCards: cards.red,
    isInternational: isIntl,
    eligible,
    href: buildHref({
      planetRugbyUrl: row.planetRugbyUrl,
      externalMatchId: row.externalMatchId,
      competitionName,
      competitionCode: row.competitionCode,
      homeTeamSlug: row.homeTeamSlug,
      awayTeamSlug: row.awayTeamSlug,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      kickoffAt: row.kickoffAt,
    }),
    hasPerf: Boolean(perf),
    syncedAt: perf?.syncedAt?.toISOString() ?? null,
  };
}

function applyFilters(grains: MatchGrain[], filters: PlayerStatsFilters): MatchGrain[] {
  const scope = filters.scope ?? "all";
  const positionGroup = filters.position
    ? resolveIntelligencePositionGroup(filters.position)
    : null;
  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;

  return grains.filter((g) => {
    if (!g.eligible) return false;
    if (!isCompletedMatchStatus(g.status) && g.kickoffAt && g.kickoffAt > new Date()) return false;
    if (scope === "club" && g.isInternational) return false;
    if (scope === "international" && !g.isInternational) return false;
    if (filters.competitionId && g.competitionId !== filters.competitionId) return false;
    if (filters.teamId && g.teamId !== filters.teamId) return false;
    if (positionGroup && positionGroup !== "generic") {
      const grainGroup = resolveIntelligencePositionGroup(g.positionName);
      if (grainGroup !== positionGroup && grainGroup !== "generic") return false;
    }
    if (from && g.kickoffAt && g.kickoffAt < from) return false;
    if (to && g.kickoffAt && g.kickoffAt > to) return false;
    return true;
  });
}

function aggregate(grains: MatchGrain[]): Totals {
  const pick = (fn: (g: MatchGrain) => number | null | undefined) => sumKnown(grains.map(fn));
  const rated = grains.filter((g) => g.rating != null);
  return {
    matches: grains.length,
    minutes: pick((g) => g.minutes),
    points: pick((g) => g.points),
    tries: pick((g) => g.tries),
    conversions: pick((g) => g.conversions),
    penalties: pick((g) => g.penalties),
    dropGoals: pick((g) => g.dropGoals),
    assists: pick((g) => g.assists),
    metres: pick((g) => g.metres),
    cleanBreaks: pick((g) => g.cleanBreaks),
    defendersBeaten: pick((g) => g.defendersBeaten),
    turnoversWon: pick((g) => g.turnoversWon),
    tacklesMade: pick((g) => g.tacklesMade),
    tacklesCompleted: pick((g) => g.tacklesCompleted),
    missedTackles: pick((g) => g.missedTackles),
    dominantTackles: pick((g) => g.dominantTackles),
    offloads: pick((g) => g.offloads),
    passes: pick((g) => g.passes),
    badPasses: pick((g) => g.badPasses),
    tackleBreaks: pick((g) => g.tackleBreaks),
    yellowCards: pick((g) => g.yellowCards),
    redCards: pick((g) => g.redCards),
    conversionAttempts: pick((g) => g.conversionAttempts),
    penaltyAttempts: pick((g) => g.penaltyAttempts),
    dropGoalAttempts: pick((g) => g.dropGoalAttempts),
    missedGoalKicks: pick((g) => g.missedGoalKicks),
    ratingSum: rated.reduce((s, g) => s + (g.rating as number), 0),
    rated: rated.length,
  };
}

function kpiList(t: Totals): PlayerStatsKpi[] {
  const item = (key: PlayerStatsKpi["key"], label: string, value: number | null): PlayerStatsKpi => ({
    key,
    label,
    value,
  });
  return [
    item("matches", "Matches", t.matches),
    item("points", "Points", val(t.points)),
    item("tries", "Tries", val(t.tries)),
    item("conversions", "Conversions", val(t.conversions)),
    item("penalties", "Penalties", val(t.penalties)),
    item("dropGoals", "Drop Goals", val(t.dropGoals)),
    item("tackleBreaks", "Tackle Breaks", val(t.tackleBreaks)),
    item("assists", "Assists", val(t.assists)),
    item("metresRun", "Metres Run", val(t.metres)),
    item("cleanBreaks", "Clean Breaks", val(t.cleanBreaks)),
    item("defendersBeaten", "Defenders Beaten", val(t.defendersBeaten)),
    item("turnoversWon", "Turnovers Won", val(t.turnoversWon)),
  ];
}

function kickingFromTotals(
  t: Totals,
  opts: {
    goalKickRole: boolean;
    periodLabel: string;
    matchesWithAttemptData: number;
  },
): KickingAccuracy {
  return buildKickingAccuracy({
    conversions: val(t.conversions),
    conversionAttempts: val(t.conversionAttempts),
    penalties: val(t.penalties),
    penaltyAttempts: val(t.penaltyAttempts),
    dropGoals: val(t.dropGoals),
    dropGoalAttempts: val(t.dropGoalAttempts),
    missedGoalKicks: val(t.missedGoalKicks),
    matches: t.matches,
    matchesWithAttemptData: opts.matchesWithAttemptData,
    goalKickRole: opts.goalKickRole,
    periodLabel: opts.periodLabel,
  });
}

function countMatchesWithAttemptData(grains: MatchGrain[]): number {
  return grains.filter(
    (g) =>
      g.conversionAttempts != null ||
      g.penaltyAttempts != null ||
      g.dropGoalAttempts != null ||
      g.missedGoalKicks != null,
  ).length;
}

function defenceFromGrains(grains: MatchGrain[]): DefensiveStats {
  return aggregateDefensiveStats(
    grains.map((g) => ({
      tacklesCompleted: g.tacklesCompleted,
      tacklesMade: g.tacklesMade,
      missedTackles: g.missedTackles,
      dominantTackles: g.dominantTackles,
      turnoversWon: g.turnoversWon,
      hasPerf: g.hasPerf,
    })),
  );
}

function averagesFromTotals(t: Totals, defence: DefensiveStats): SeasonAverageItem[] {
  const apps = t.matches;
  const passPct = passSuccessPct(val(t.passes), val(t.badPasses));
  // Use defence-card paired success % — never unpaired totals that mix unmatched grains.
  const tackPct = defence.tackleSuccessPct;
  return [
    { key: "points", label: "Points", value: averagePerAppearance(val(t.points), apps), isPercent: false },
    { key: "metres", label: "Metres", value: averagePerAppearance(val(t.metres), apps), isPercent: false },
    { key: "passes", label: "Passes", value: averagePerAppearance(val(t.passes), apps), isPercent: false },
    { key: "passPct", label: "Pass %", value: passPct, isPercent: true },
    { key: "tacklePct", label: "Tackle %", value: tackPct, isPercent: true },
    {
      key: "tackleBreaks",
      label: "Tackle Breaks",
      value: averagePerAppearance(val(t.tackleBreaks), apps),
      isPercent: false,
    },
    {
      key: "defendersBeaten",
      label: "Defenders Beaten",
      value: averagePerAppearance(val(t.defendersBeaten), apps),
      isPercent: false,
    },
    {
      key: "turnoversWon",
      label: "Turnovers Won",
      value: averagePerAppearance(val(t.turnoversWon), apps),
      isPercent: false,
    },
  ];
}

function dedupeGrainsByFixture(grains: MatchGrain[]): MatchGrain[] {
  const byFixture = new Map<string, MatchGrain>();
  const grainScore = (g: MatchGrain) =>
    (g.hasPerf ? 4 : 0) + (g.rating != null ? 2 : 0) + (g.minutes != null ? 1 : 0);
  for (const g of grains) {
    const existing = byFixture.get(g.fixtureId);
    if (!existing || grainScore(g) > grainScore(existing)) {
      byFixture.set(g.fixtureId, g);
    }
  }
  return [...byFixture.values()];
}

function gameLogRows(grains: MatchGrain[]): GameLogRow[] {
  return [...grains]
    .sort((a, b) => {
      const ta = a.kickoffAt?.getTime() ?? 0;
      const tb = b.kickoffAt?.getTime() ?? 0;
      return tb - ta;
    })
    .map((g) => ({
      fixtureId: g.fixtureId,
      href: g.href,
      kickoffAt: g.kickoffAt?.toISOString() ?? null,
      seasonSlug: g.seasonSlug,
      teamName: g.teamName,
      teamHref: g.teamSlug ? `/teams/${g.teamSlug}` : null,
      competitionName: g.competitionName,
      competitionSlug: g.competitionSlug,
      competitionHref: g.competitionSlug ? `/competitions/${g.competitionSlug}` : null,
      opponentName: g.opponentName,
      opponentHref: g.opponentSlug ? `/teams/${g.opponentSlug}` : null,
      venue: g.homeAway,
      result: g.result,
      scoreFor: g.scoreFor,
      scoreAgainst: g.scoreAgainst,
      minutes: g.minutes,
      points: g.points,
      tries: g.tries,
      conversions: g.conversions,
      conversionAttempts: g.conversionAttempts,
      penalties: g.penalties,
      penaltyAttempts: g.penaltyAttempts,
      dropGoals: g.dropGoals,
      dropGoalAttempts: g.dropGoalAttempts,
      tackleBreaks: g.tackleBreaks,
      metres: g.metres,
      offloads: g.offloads,
      // Successful tackles only (completed); same grain as DEFENSIVE STATS card.
      tacklesMade:
        g.tacklesCompleted != null && Number.isFinite(g.tacklesCompleted)
          ? g.tacklesCompleted
          : g.tacklesMade,
      missedTackles: g.missedTackles,
      dominantTackles: g.dominantTackles,
      turnoversWon: g.turnoversWon,
      rating: g.rating,
      ratingBand: g.ratingBand as GameLogRatingBand | null,
      ratingBreakdown: g.ratingBreakdown,
    }));
}

function lastUpdated(grains: MatchGrain[]): string | null {
  let max: string | null = null;
  for (const g of grains) {
    if (g.syncedAt && (!max || g.syncedAt > max)) max = g.syncedAt;
    if (g.kickoffAt) {
      const iso = g.kickoffAt.toISOString();
      if (!max || iso > max) max = iso;
    }
  }
  return max;
}

function cohortPer80(peers: PeerAgg[], key: keyof Pick<PeerAgg, "points" | "metres" | "defendersBeaten" | "turnoversWon" | "tackleBreaks" | "passes">): number | null {
  let total = 0;
  let minutes = 0;
  for (const p of peers) {
    const v = p[key];
    const mins = key === "passes" ? p.passMinutes : p.minutes;
    if (v == null || mins < 80) continue;
    total += v;
    minutes += mins;
  }
  return per80(minutes > 0 ? total : null, minutes > 0 ? minutes : null);
}

function buildPer80(
  t: Totals,
  peers: PeerAgg[],
  peerLabel: string,
  competitionName: string | null,
  source: Per80Comparison["cohortSource"],
): Per80Comparison {
  const mins = val(t.minutes);
  const kicking = kickingFromTotals(t, {
    goalKickRole: false,
    periodLabel: "period",
    matchesWithAttemptData: 0,
  });
  const overallKick = kicking.rows.find((r) => r.key === "overall")?.percent ?? null;
  const label =
    source === "insufficient"
      ? `Avg ${peerLabel}`
      : formatPeerAverageLabel({
          peerLabel,
          competitionName,
          source: source === "competition" ? "cohort" : "global",
        });
  const rows: Per80Comparison["rows"] = [
    { key: "points", label: "Points", player: per80(val(t.points), mins), cohort: cohortPer80(peers, "points"), isPercent: false },
    { key: "metres", label: "Metres Run", player: per80(val(t.metres), mins), cohort: cohortPer80(peers, "metres"), isPercent: false },
    { key: "passes", label: "Passes", player: per80(val(t.passes), mins), cohort: cohortPer80(peers, "passes"), isPercent: false },
    {
      key: "tackleBreaks",
      label: "Tackle Breaks",
      player: per80(val(t.tackleBreaks), mins),
      cohort: cohortPer80(peers, "tackleBreaks"),
      isPercent: false,
    },
    {
      key: "defendersBeaten",
      label: "Defenders Beaten",
      player: per80(val(t.defendersBeaten), mins),
      cohort: cohortPer80(peers, "defendersBeaten"),
      isPercent: false,
    },
    {
      key: "turnoversWon",
      label: "Turnovers Won",
      player: per80(val(t.turnoversWon), mins),
      cohort: cohortPer80(peers, "turnoversWon"),
      isPercent: false,
    },
    { key: "kicking", label: "Kicking Accuracy (%)", player: overallKick, cohort: null, isPercent: true },
  ];
  return { cohortLabel: label, cohortSource: source, rows };
}

function emptySpatialCoverage() {
  return {
    totalEvents: 0,
    eventsWithCoords: 0,
    coveragePct: null,
    matchesInScope: 0,
    matchesWithCoords: 0,
    matchesUsed: 0,
    sources: [] as string[],
    notes: [] as string[],
    method: null as "spatial" | "position" | null,
  };
}

function emptyPassingZones(): StatsSlice["passingZones"] {
  return {
    available: false,
    method: null,
    cells: null,
    totalPasses: null,
    passesWithCoords: null,
    passesWithPosition: null,
    message: "Spatial passing data not yet available for this player/period.",
    coverage: emptySpatialCoverage(),
  };
}

function emptyKickingZones(): StatsSlice["kickingZones"] {
  return {
    available: false,
    origin: null,
    destination: null,
    hasDestinationCoords: false,
    totalKicksFromHand: null,
    message: "Spatial kicking data not yet available for this player/period.",
    coverage: emptySpatialCoverage(),
  };
}

function accuracyDetail(made: number | null, attempts: number | null, pct: number | null): string | null {
  return formatAccuracyDetail(made, attempts, pct);
}

export async function getPlayerStats(
  playerId: string,
  filters: PlayerStatsFilters = {},
): Promise<PlayerStatsV2Dto | null> {
  const db = getDb();
  const [player] = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      positionName: players.positionName,
      internationalTeamId: players.internationalTeamId,
      externalProviderId: players.externalProviderId,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) return null;

  const homeTeams = alias(teams, "pstats_home");
  const awayTeams = alias(teams, "pstats_away");
  const playerTeam = alias(teams, "pstats_side");

  const fpRows = await db
    .select({
      fixtureId: fixtures.id,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      isNeutralVenue: fixtures.isNeutralVenue,
      competitionId: fixtures.competitionId,
      competitionNameStored: fixtures.competitionName,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.competitionType,
      competitionCode: competitions.sdmsCompCode,
      teamId: fixturePlayers.teamId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
      positionName: fixturePlayers.positionName,
      tries: fixturePlayers.tries,
      conversions: fixturePlayers.conversions,
      penalties: fixturePlayers.penalties,
      dropGoals: fixturePlayers.dropGoals,
      points: fixturePlayers.points,
      teamName: playerTeam.name,
      teamSlug: playerTeam.slug,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .innerJoin(playerTeam, eq(fixturePlayers.teamId, playerTeam.id))
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt));

  const fixtureIds = fpRows.map((r) => r.fixtureId);
  const [perfRows, ratingRows, cardRows, kickMissRows] = fixtureIds.length
    ? await Promise.all([
        db
          .select({
            fixtureId: playerMatchPerformanceStats.fixtureId,
            minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
            metresCarried: playerMatchPerformanceStats.metresCarried,
            tacklesMade: playerMatchPerformanceStats.tacklesMade,
            tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
            dominantTackles: playerMatchPerformanceStats.dominantTackles,
            turnoversWon: playerMatchPerformanceStats.turnoversWon,
            tryAssists: playerMatchPerformanceStats.tryAssists,
            lineBreaks: playerMatchPerformanceStats.lineBreaks,
            defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
            extras: playerMatchPerformanceStats.extras,
            syncedAt: playerMatchPerformanceStats.syncedAt,
            teamId: playerMatchPerformanceStats.teamId,
            tries: playerMatchPerformanceStats.tries,
            points: playerMatchPerformanceStats.points,
          })
          .from(playerMatchPerformanceStats)
          .where(
            and(
              eq(playerMatchPerformanceStats.playerId, playerId),
              inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
            ),
          ),
        db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            rating: playerMatchRatings.rating,
            minutesPlayed: playerMatchRatings.minutesPlayed,
            performanceBand: playerMatchRatings.performanceBand,
            attackContribution: playerMatchRatings.attackContribution,
            defenceContribution: playerMatchRatings.defenceContribution,
          })
          .from(playerMatchRatings)
          .where(
            and(
              eq(playerMatchRatings.playerId, playerId),
              inArray(playerMatchRatings.fixtureId, fixtureIds),
            ),
          ),
        db
          .select({
            fixtureId: matchEvents.fixtureId,
            eventType: matchEvents.eventType,
          })
          .from(matchEvents)
          .where(
            and(
              eq(matchEvents.playerId, playerId),
              inArray(matchEvents.fixtureId, fixtureIds),
              or(
                sql`lower(${matchEvents.eventType}) like '%yellow%'`,
                sql`lower(${matchEvents.eventType}) like '%red%'`,
                sql`lower(${matchEvents.eventType}) like '%sin%bin%'`,
                sql`lower(${matchEvents.eventType}) like '%sin_bin%'`,
              ),
            ),
          ),
        db
          .select({
            fixtureId: matchEvents.fixtureId,
            eventType: matchEvents.eventType,
            playerId: matchEvents.playerId,
            payload: matchEvents.payload,
          })
          .from(matchEvents)
          .where(
            and(
              inArray(matchEvents.fixtureId, fixtureIds),
              or(
                sql`lower(${matchEvents.eventType}) in ('conversion_missed','missed_conversion','penalty_missed','missed_penalty','penalty_goal_missed','drop_goal_missed','missed_drop_goal')`,
                sql`lower(${matchEvents.eventType}) like '%missed%conversion%'`,
                sql`lower(${matchEvents.eventType}) like '%missed%penalty%'`,
                sql`lower(${matchEvents.eventType}) like '%missed%drop%'`,
              ),
            ),
          ),
      ])
    : [[], [], [], []];

  const perfByFixture = new Map(perfRows.map((p) => [p.fixtureId, p]));
  const ratingByFixture = new Map(ratingRows.map((r) => [r.fixtureId, r]));
  const cardsByFixture = new Map<string, { yellow: number; red: number }>();
  for (const e of cardRows) {
    const prev = cardsByFixture.get(e.fixtureId) ?? { yellow: 0, red: 0 };
    const t = (e.eventType || "").toLowerCase();
    if (t.includes("red")) prev.red += 1;
    else prev.yellow += 1;
    cardsByFixture.set(e.fixtureId, prev);
  }
  const kickMissByFixture = new Map<
    string,
    { conversions: number; penalties: number; dropGoals: number }
  >();
  for (const e of kickMissRows) {
    if (
      !kickMissAttributedToPlayer(e, {
        id: player.id,
        name: player.name,
        externalProviderId: player.externalProviderId,
      })
    ) {
      continue;
    }
    const prev = kickMissByFixture.get(e.fixtureId) ?? {
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
    };
    const t = (e.eventType || "").toLowerCase();
    if (t.includes("drop")) prev.dropGoals += 1;
    else if (t.includes("penalt")) prev.penalties += 1;
    else prev.conversions += 1;
    kickMissByFixture.set(e.fixtureId, prev);
  }

  const allGrains = dedupeGrainsByFixture(
    fpRows.map((row) =>
      grainFromRow({
        row,
        perf: perfByFixture.get(row.fixtureId) ?? null,
        rating: ratingByFixture.get(row.fixtureId) ?? null,
        cards: cardsByFixture.get(row.fixtureId) ?? { yellow: 0, red: 0 },
        kickMisses: kickMissByFixture.get(row.fixtureId),
        internationalTeamId: player.internationalTeamId,
      }),
    ),
  );

  const filtered = applyFilters(allGrains, filters);
  const seasonStarts = [
    ...new Set(filtered.map((g) => g.seasonStart).filter((n): n is number => n != null)),
  ];
  const appearanceCountsByStart: Record<number, number> = {};
  for (const g of filtered) {
    if (g.seasonStart == null) continue;
    appearanceCountsByStart[g.seasonStart] = (appearanceCountsByStart[g.seasonStart] ?? 0) + 1;
  }
  const defaultStart = resolveDefaultSeasonStart({
    appearanceSeasonStarts: seasonStarts,
    appearanceCountsByStart,
  });
  const requestedSlug = filters.season?.trim() || null;
  const selectedStart = requestedSlug
    ? seasonStarts.find((y) => seasonSlugFromStartYear(y) === requestedSlug) ?? defaultStart
    : defaultStart;
  const selectedSeasonSlug =
    selectedStart != null ? seasonSlugFromStartYear(selectedStart) : requestedSlug ?? "";
  const selectedSeasonLabel =
    selectedStart != null ? rugbySeasonLabelFromStart(selectedStart) : "Season";

  const seasonGrains = filtered.filter((g) => g.seasonStart === selectedStart);
  const careerGrains = filtered;
  const seasonTotals = aggregate(seasonGrains);
  const careerTotals = aggregate(careerGrains);

  const posCfg = getPositionIntelligenceConfig(player.positionName);
  const positionGroup = posCfg.group;

  const seasonCompIds = [
    ...new Set(seasonGrains.map((g) => g.competitionId).filter((id): id is string => Boolean(id))),
  ];
  const careerCompIds = [
    ...new Set(careerGrains.map((g) => g.competitionId).filter((id): id is string => Boolean(id))),
  ];
  const primarySeasonComp = mostCommon(
    seasonGrains.map((g) => g.competitionName).filter((n): n is string => Boolean(n)),
  );

  const { from: seasonFrom, to: seasonTo } =
    selectedStart != null
      ? seasonDateRange(selectedStart)
      : { from: new Date(0), to: new Date() };

  const [seasonPeers, careerPeers, teamMates, seasonSpatial, careerSpatial] = await Promise.all([
    loadPeerAggregates({
      competitionIds: seasonCompIds,
      from: seasonFrom,
      to: seasonTo,
      positionGroup,
      excludePlayerId: playerId,
    }),
    loadPeerAggregates({
      competitionIds: careerCompIds,
      from: null,
      to: null,
      positionGroup,
      excludePlayerId: playerId,
    }),
    loadTeamContribution(seasonGrains, playerId),
    getPlayerSpatialStats(playerId, {
      seasonSlug: selectedSeasonSlug || null,
      scope: filters.scope ?? null,
      competitionId: filters.competitionId ?? null,
      teamId: filters.teamId ?? null,
    }),
    getPlayerSpatialStats(playerId, {
      seasonSlug: null,
      scope: filters.scope ?? null,
      competitionId: filters.competitionId ?? null,
      teamId: filters.teamId ?? null,
    }),
  ]);

  const seasonPer80 = buildPer80(
    seasonTotals,
    seasonPeers.peers,
    posCfg.peerLabel,
    primarySeasonComp,
    seasonPeers.source,
  );
  const careerPer80 = buildPer80(
    careerTotals,
    careerPeers.peers,
    posCfg.peerLabel,
    mostCommon(careerGrains.map((g) => g.competitionName).filter((n): n is string => Boolean(n))),
    careerPeers.source,
  );

  const seasonSlice = buildSlice({
    period: "season",
    seasonLabel: selectedSeasonLabel,
    seasonSlug: selectedSeasonSlug || null,
    grains: seasonGrains,
    totals: seasonTotals,
    per80: seasonPer80,
    contribution: teamMates,
    passingZones: seasonSpatial ? mapSpatialToPassingZones(seasonSpatial.passing) : emptyPassingZones(),
    kickingZones: seasonSpatial ? mapSpatialToKickingZones(seasonSpatial.kicking) : emptyKickingZones(),
    goalKickRole: isGoalKickRolePosition(positionGroup),
  });
  const careerSlice = buildSlice({
    period: "career",
    seasonLabel: "Career",
    seasonSlug: null,
    grains: careerGrains,
    totals: careerTotals,
    per80: careerPer80,
    contribution: await loadTeamContribution(careerGrains, playerId),
    passingZones: careerSpatial ? mapSpatialToPassingZones(careerSpatial.passing) : emptyPassingZones(),
    kickingZones: careerSpatial ? mapSpatialToKickingZones(careerSpatial.kicking) : emptyKickingZones(),
    goalKickRole: isGoalKickRolePosition(positionGroup),
  });

  const summaryTable = buildSummaryTable({
    season: seasonTotals,
    career: careerTotals,
    seasonPeers: seasonPeers.peers,
    playerId,
    peerLabel: posCfg.peerLabel,
    seasonLabel: selectedSeasonLabel,
    seasonGrains,
    careerGrains,
    goalKickRole: isGoalKickRolePosition(positionGroup),
  });

  const availableSeasons = buildAvailableSeasons({
    appearanceCountsByStart,
    currentStartYear: currentDomesticSeasonStartYear(),
    selectedStartYear: selectedStart,
  });

  const coverage: PlayerStatsCoverage = {
    linkedFixtures: allGrains.length,
    eligibleAppearances: filtered.length,
    performanceRows: allGrains.filter((g) => g.hasPerf).length,
    ratedAppearances: allGrains.filter((g) => g.rating != null).length,
    minutesKnown: allGrains.filter((g) => g.minutes != null).length,
    scoringSource: "fixture_players",
    kickingAttempts: seasonSlice.kickingAccuracy.available
      ? seasonSlice.kickingAccuracy.matchesWithAttemptData >= seasonSlice.matches
        ? "available"
        : "partial"
      : "unavailable",
    passingZones: seasonSlice.passingZones.available ? "available" : "unavailable",
    kickingZones: seasonSlice.kickingZones.available
      ? seasonSlice.kickingZones.hasDestinationCoords
        ? "available"
        : "partial"
      : "unavailable",
    notes: coverageNotes(allGrains, filtered, seasonSlice, careerSlice),
  };

  return {
    playerId: player.id,
    slug: player.slug,
    positionName: player.positionName,
    positionPeerLabel: posCfg.peerLabel,
    defaultPeriod: "season",
    selectedSeasonSlug,
    selectedSeasonLabel,
    availableSeasons,
    summaryTable,
    season: seasonSlice,
    career: careerSlice,
    coverage,
  };
}

export async function getPlayerStatsBySlug(
  slug: string,
  filters: PlayerStatsFilters = {},
): Promise<PlayerStatsV2Dto | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);
  if (!row) return null;
  return getPlayerStats(row.id, filters);
}

function buildSlice(input: {
  period: StatsSlice["period"];
  seasonLabel: string;
  seasonSlug: string | null;
  grains: MatchGrain[];
  totals: Totals;
  per80: Per80Comparison;
  contribution: ContributionRing[];
  passingZones: StatsSlice["passingZones"];
  kickingZones: StatsSlice["kickingZones"];
  goalKickRole: boolean;
}): StatsSlice {
  const t = input.totals;
  const periodLabel =
    input.period === "career" ? "career" : `season ${input.seasonLabel.replace(/–/g, "/")}`;
  const defence = defenceFromGrains(input.grains);
  return {
    period: input.period,
    seasonLabel: input.seasonLabel,
    seasonSlug: input.seasonSlug,
    matches: t.matches,
    minutes: val(t.minutes),
    kpis: kpiList(t),
    pointsBreakdown: buildPointsBreakdown({
      storedPoints: val(t.points),
      tries: val(t.tries),
      conversions: val(t.conversions),
      penalties: val(t.penalties),
      dropGoals: val(t.dropGoals),
    }),
    per80: input.per80,
    attackingContribution: input.contribution,
    passingZones: input.passingZones,
    kickingZones: input.kickingZones,
    kickingAccuracy: kickingFromTotals(t, {
      goalKickRole: input.goalKickRole,
      periodLabel,
      matchesWithAttemptData: countMatchesWithAttemptData(input.grains),
    }),
    defence,
    gameLog: gameLogRows(input.grains),
    averages: averagesFromTotals(t, defence),
    ratingAverage: t.rated > 0 ? Math.round((t.ratingSum / t.rated) * 10) / 10 : null,
    lastUpdatedIso: lastUpdated(input.grains),
  };
}

function buildSummaryTable(input: {
  season: Totals;
  career: Totals;
  seasonPeers: PeerAgg[];
  playerId: string;
  peerLabel: string;
  seasonLabel: string;
  seasonGrains: MatchGrain[];
  careerGrains: MatchGrain[];
  goalKickRole: boolean;
}): SummaryTableRow[] {
  const s = input.season;
  const c = input.career;
  const mins = val(s.minutes);
  const playerSample = { minutes: mins, appearances: s.matches };
  const peerPlural = pluralizePositionLabel(input.peerLabel);
  const careerCoverageTip =
    "Career totals from Rugby365-linked eligible appearances only — coverage may be incomplete vs full career.";
  const kickS = kickingFromTotals(s, {
    goalKickRole: input.goalKickRole,
    periodLabel: `season ${input.seasonLabel.replace(/–/g, "/")}`,
    matchesWithAttemptData: countMatchesWithAttemptData(input.seasonGrains),
  });
  const kickC = kickingFromTotals(c, {
    goalKickRole: input.goalKickRole,
    periodLabel: "career",
    matchesWithAttemptData: countMatchesWithAttemptData(input.careerGrains),
  });
  const defenceS = defenceFromGrains(input.seasonGrains);
  const defenceC = defenceFromGrains(input.careerGrains);

  const rankPer80 = (
    playerTotal: number | null,
    peerKey: keyof Pick<PeerAgg, "points" | "metres" | "defendersBeaten" | "turnoversWon" | "passes">,
  ) => {
    const playerPer80 = per80(playerTotal, mins);
    const result = rankAmongDetailed(
      playerPer80,
      input.seasonPeers.map((p) => ({
        value: per80(p[peerKey], p.minutes),
        minutes: p.minutes,
        appearances: p.appearances,
      })),
      playerSample,
    );
    return {
      rank: result.rank,
      provisional: result.provisional,
      tooltip: formatRankTooltip({
        rank: result.rank,
        eligibleCount: result.eligibleCount,
        provisional: result.provisional,
        peerPlural,
        periodLabel: `season ${input.seasonLabel}`,
        metricBasis: "per-80 vs same-position peers",
      }),
    };
  };

  const row = (
    key: SummaryTableRow["key"],
    label: string,
    seasonVal: number | null,
    careerVal: number | null,
    per80Val: number | null,
    rankMeta: { rank: number | null; tooltip: string | null; provisional?: boolean } | null,
    opts: {
      isPercent?: boolean;
      seasonDetail?: string | null;
      careerDetail?: string | null;
      careerTooltip?: string | null;
    } = {},
  ): SummaryTableRow => ({
    key,
    label,
    season: seasonVal,
    career: careerVal,
    per80: per80Val,
    rank: rankMeta?.rank ?? null,
    rankLabel: formatRankLabel(rankMeta?.rank ?? null, rankMeta?.provisional ?? false),
    rankTooltip: rankMeta?.tooltip ?? null,
    careerTooltip: opts.careerTooltip ?? careerCoverageTip,
    seasonDetail: opts.seasonDetail ?? null,
    careerDetail: opts.careerDetail ?? null,
    isPercent: Boolean(opts.isPercent),
  });

  const convS = kickS.rows.find((r) => r.key === "conversions");
  const convC = kickC.rows.find((r) => r.key === "conversions");
  const penS = kickS.rows.find((r) => r.key === "penalties");
  const penC = kickC.rows.find((r) => r.key === "penalties");
  const dgS = kickS.rows.find((r) => r.key === "dropGoals");
  const dgC = kickC.rows.find((r) => r.key === "dropGoals");

  const passPctS = passSuccessPct(val(s.passes), val(s.badPasses));
  const passPctC = passSuccessPct(val(c.passes), val(c.badPasses));
  const tackPctS = defenceS.tackleSuccessPct;
  const tackPctC = defenceC.tackleSuccessPct;

  const pointsRank = rankPer80(val(s.points), "points");
  const metresRank = rankPer80(val(s.metres), "metres");
  const beatenRank = rankPer80(val(s.defendersBeaten), "defendersBeaten");
  const turnoversRank = rankPer80(val(s.turnoversWon), "turnoversWon");
  const passesRank = rankPer80(val(s.passes), "passes");

  return [
    row("matches", "Matches Played", s.matches, c.matches, null, null),
    row("points", "Points", val(s.points), val(c.points), per80(val(s.points), mins), pointsRank),
    row("tries", "Tries", val(s.tries), val(c.tries), per80(val(s.tries), mins), null),
    row("conversions", "Conversions", val(s.conversions), val(c.conversions), per80(val(s.conversions), mins), null, {
      seasonDetail: accuracyDetail(convS?.made ?? null, convS?.attempts ?? null, convS?.percent ?? null),
      careerDetail: accuracyDetail(convC?.made ?? null, convC?.attempts ?? null, convC?.percent ?? null),
    }),
    row("penalties", "Penalties", val(s.penalties), val(c.penalties), per80(val(s.penalties), mins), null, {
      seasonDetail: accuracyDetail(penS?.made ?? null, penS?.attempts ?? null, penS?.percent ?? null),
      careerDetail: accuracyDetail(penC?.made ?? null, penC?.attempts ?? null, penC?.percent ?? null),
    }),
    row("dropGoals", "Drop Goals", val(s.dropGoals), val(c.dropGoals), per80(val(s.dropGoals), mins), null, {
      seasonDetail: accuracyDetail(dgS?.made ?? null, dgS?.attempts ?? null, dgS?.percent ?? null),
      careerDetail: accuracyDetail(dgC?.made ?? null, dgC?.attempts ?? null, dgC?.percent ?? null),
    }),
    row("tackleBreaks", "Tackle Breaks", val(s.tackleBreaks), val(c.tackleBreaks), per80(val(s.tackleBreaks), mins), null),
    row("cleanBreaks", "Clean Breaks", val(s.cleanBreaks), val(c.cleanBreaks), per80(val(s.cleanBreaks), mins), null),
    row("metresRun", "Metres Run", val(s.metres), val(c.metres), per80(val(s.metres), mins), metresRank),
    row(
      "defendersBeaten",
      "Defenders Beaten",
      val(s.defendersBeaten),
      val(c.defendersBeaten),
      per80(val(s.defendersBeaten), mins),
      beatenRank,
    ),
    row("offloads", "Offloads", val(s.offloads), val(c.offloads), per80(val(s.offloads), mins), null),
    row(
      "turnoversWon",
      "Turnovers Won",
      val(s.turnoversWon),
      val(c.turnoversWon),
      per80(val(s.turnoversWon), mins),
      turnoversRank,
    ),
    row("passes", "Passes", val(s.passes), val(c.passes), per80(val(s.passes), mins), passesRank),
    row("passSuccessPct", "Pass Success %", passPctS, passPctC, null, null, { isPercent: true }),
    row(
      "tackles",
      "Tackles",
      defenceS.tacklesMade ?? val(s.tacklesCompleted) ?? val(s.tacklesMade),
      defenceC.tacklesMade ?? val(c.tacklesCompleted) ?? val(c.tacklesMade),
      per80(defenceS.tacklesMade ?? val(s.tacklesCompleted) ?? val(s.tacklesMade), mins),
      null,
    ),
    row("tackleSuccessPct", "Tackle Success %", tackPctS, tackPctC, null, null, { isPercent: true }),
    row("yellowCards", "Yellow Cards", val(s.yellowCards), val(c.yellowCards), null, null),
    row("redCards", "Red Cards", val(s.redCards), val(c.redCards), null, null),
  ];
}

function mostCommon(values: string[]): string | null {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of map) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

async function loadPeerAggregates(input: {
  competitionIds: string[];
  from: Date | null;
  to: Date | null;
  positionGroup: IntelligencePositionGroup;
  excludePlayerId: string;
}): Promise<{ peers: PeerAgg[]; source: Per80Comparison["cohortSource"] }> {
  if (input.competitionIds.length === 0) return { peers: [], source: "insufficient" };
  const db = getDb();
  const conditions = [inArray(fixtures.competitionId, input.competitionIds)];
  if (input.from) conditions.push(gte(fixtures.kickoffAt, input.from));
  if (input.to) conditions.push(lte(fixtures.kickoffAt, input.to));

  const rows = await db
    .select({
      playerId: playerMatchPerformanceStats.playerId,
      positionName: players.positionName,
      minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
      points: playerMatchPerformanceStats.points,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      extras: playerMatchPerformanceStats.extras,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(fixtures, eq(playerMatchPerformanceStats.fixtureId, fixtures.id))
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .where(and(...conditions));

  const grouped = new Map<string, PeerAgg & { group: IntelligencePositionGroup }>();
  for (const row of rows) {
    if (row.playerId === input.excludePlayerId) continue;
    const group = resolveIntelligencePositionGroup(row.positionName);
    if (input.positionGroup !== "generic" && group !== input.positionGroup) continue;
    const prev = grouped.get(row.playerId) ?? {
      playerId: row.playerId,
      appearances: 0,
      minutes: 0,
      points: 0,
      metres: 0,
      passes: 0,
      passMinutes: 0,
      defendersBeaten: 0,
      turnoversWon: 0,
      tackleBreaks: null as number | null,
      group,
    };
    prev.appearances += 1;
    prev.minutes += row.minutesPlayed ?? 0;
    prev.points = (prev.points ?? 0) + (row.points ?? 0);
    prev.metres = (prev.metres ?? 0) + (row.metresCarried ?? 0);
    prev.defendersBeaten = (prev.defendersBeaten ?? 0) + (row.defendersBeaten ?? 0);
    prev.turnoversWon = (prev.turnoversWon ?? 0) + (row.turnoversWon ?? 0);
    const passes = extraNumber(row.extras, "passes");
    if (passes != null) {
      prev.passes = (prev.passes ?? 0) + passes;
      prev.passMinutes += row.minutesPlayed ?? 0;
    }
    const breaks = extraNumber(row.extras, "tackleBreaks", "tackle_breaks", "brokenTackles");
    if (breaks != null) {
      prev.tackleBreaks = (prev.tackleBreaks ?? 0) + breaks;
    }
    grouped.set(row.playerId, prev);
  }

  const peers = [...grouped.values()];
  return {
    peers,
    source: peers.length >= 3 ? (input.from ? "competition" : "season") : "insufficient",
  };
}

async function loadTeamContribution(
  grains: MatchGrain[],
  playerId: string,
): Promise<ContributionRing[]> {
  const empty: ContributionRing[] = [
    { key: "points", label: "Points", percent: null, player: null, team: null, sample: 0 },
    { key: "tries", label: "Tries", percent: null, player: null, team: null, sample: 0 },
    { key: "assists", label: "Assists", percent: null, player: null, team: null, sample: 0 },
    { key: "lineBreaks", label: "Line Breaks", percent: null, player: null, team: null, sample: 0 },
  ];
  const qualifying = grains.filter((g) => g.hasPerf && g.eligible);
  if (qualifying.length === 0) return empty;
  const fixtureIds = qualifying.map((g) => g.fixtureId);
  const teamByFixture = new Map(qualifying.map((g) => [g.fixtureId, g.teamId]));
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: playerMatchPerformanceStats.fixtureId,
      playerId: playerMatchPerformanceStats.playerId,
      teamId: playerMatchPerformanceStats.teamId,
      tries: playerMatchPerformanceStats.tries,
      points: playerMatchPerformanceStats.points,
      tryAssists: playerMatchPerformanceStats.tryAssists,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
    })
    .from(playerMatchPerformanceStats)
    .where(inArray(playerMatchPerformanceStats.fixtureId, fixtureIds));

  let playerPoints = 0;
  let teamPoints = 0;
  let playerTries = 0;
  let teamTries = 0;
  let playerAssists = 0;
  let teamAssists = 0;
  let playerBreaks = 0;
  let teamBreaks = 0;
  let sample = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const teamId = teamByFixture.get(row.fixtureId);
    if (!teamId || row.teamId !== teamId) continue;
    const key = row.fixtureId;
    if (!seen.has(key)) {
      seen.add(key);
      sample += 1;
    }
    teamPoints += row.points ?? 0;
    teamTries += row.tries ?? 0;
    teamAssists += row.tryAssists ?? 0;
    teamBreaks += row.lineBreaks ?? 0;
    if (row.playerId === playerId) {
      playerPoints += row.points ?? 0;
      playerTries += row.tries ?? 0;
      playerAssists += row.tryAssists ?? 0;
      playerBreaks += row.lineBreaks ?? 0;
    }
  }

  const ring = (
    key: ContributionRing["key"],
    label: string,
    player: number,
    team: number,
  ): ContributionRing => ({
    key,
    label,
    player,
    team,
    percent: sharePct(player, team),
    sample,
  });

  return [
    ring("points", "Points", playerPoints, teamPoints),
    ring("tries", "Tries", playerTries, teamTries),
    ring("assists", "Assists", playerAssists, teamAssists),
    ring("lineBreaks", "Line Breaks", playerBreaks, teamBreaks),
  ];
}

function coverageNotes(
  all: MatchGrain[],
  filtered: MatchGrain[],
  season: StatsSlice,
  career: StatsSlice,
): string[] {
  const notes: string[] = [];
  notes.push(
    `${filtered.length} eligible appearances from ${all.length} linked fixture rows.`,
  );
  const perf = all.filter((g) => g.hasPerf).length;
  notes.push(`Match performance stats on ${perf} of ${all.length} linked fixtures.`);
  if (!season.kickingAccuracy.available && !career.kickingAccuracy.available) {
    notes.push("Goal-kick attempts are not stored — accuracy is not inferred from successes.");
  }
  if (!season.passingZones.available) {
    notes.push("No spatial pass coordinates — passing heatmap shown empty.");
  } else if (season.passingZones.method === "position") {
    notes.push("Passing heatmap uses playing-position zones until pass coordinates are available.");
  }
  if (!season.kickingZones.available) {
    notes.push("No spatial kick-from-hand coordinates — kicking heatmap shown empty.");
  }
  const breaks = season.kpis.find((k) => k.key === "tackleBreaks");
  if (breaks?.value == null) {
    notes.push("Tackle breaks are not stored as a distinct metric.");
  }
  if (season.pointsBreakdown.mismatch || career.pointsBreakdown.mismatch) {
    notes.push("Stored points differ from tries×5 + conversions×2 + penalties×3 + drop goals×3.");
  }
  return notes;
}

export { formatStatNumber };
