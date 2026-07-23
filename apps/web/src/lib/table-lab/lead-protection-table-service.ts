import { formatFormDateRange } from "./form-table-service";
import {
  filterByMinimumMatchesPlayed,
  parseMinMatchesPlayed,
} from "./home-table-service";
import {
  filterByKickoffRange,
  matchLeaguePoints,
} from "./rugby-table-metrics-service";
import {
  pointsLostFromWinningPosition,
  perspectiveQualifiesForWinningPositionFilter,
  winningPositionFilterLabel,
} from "./points-lost-winning-table-service";
import { uniqueFixtureCount } from "./scoring-first-table-service";
import {
  parseLeadPositionFilter,
  parseLeadProtectionSortBy,
  parseMinimumLeadPoints,
  parseMinimumLeadPreset,
  minimumLeadLabel,
  type LeadPositionFilter,
  type LeadProtectionSortBy,
  type MinimumLeadPreset,
} from "./table-lab-param-parsers";
import type {
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type { LeadPositionFilter, LeadProtectionSortBy, MinimumLeadPreset };
export {
  parseLeadPositionFilter,
  parseLeadProtectionSortBy,
  parseMinimumLeadPoints,
  parseMinimumLeadPreset,
  minimumLeadLabel,
};

export function perspectiveQualifiesForLeadProtectionTable(
  row: TeamFixturePerspective,
  leadPosition: LeadPositionFilter,
  minimumLead: number,
): boolean {
  if (!perspectiveQualifiesForWinningPositionFilter(row, leadPosition)) {
    return false;
  }
  if (minimumLead > 0 && (row.maxLeadMargin ?? 0) < minimumLead) {
    return false;
  }
  return true;
}

export function filterLeadProtectionPerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  leadPosition: LeadPositionFilter;
  minimumLead: number;
}): TeamFixturePerspective[] {
  return input.perspectives.filter((row) => {
    if (!perspectiveQualifiesForLeadProtectionTable(row, input.leadPosition, input.minimumLead)) {
      return false;
    }
    if (input.tableView === "home" && row.side !== "home") return false;
    if (input.tableView === "away" && row.side !== "away") return false;
    return true;
  });
}

export function buildLeadProtectionFilterSummary(input: {
  tableView: RugbyTableView;
  leadPosition: LeadPositionFilter;
  minimumLeadPreset: MinimumLeadPreset;
  minimumLead: number;
}): string {
  const venue =
    input.tableView === "home"
      ? "home "
      : input.tableView === "away"
        ? "away "
        : "";
  const leadSize =
    input.minimumLead > 0 ? ` with at least a ${input.minimumLead}-point lead` : "";
  return `This table ranks teams by how often they win after taking the lead while ${winningPositionFilterLabel(input.leadPosition).toLowerCase()}${leadSize} in ${venue}matches.`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

type LeadProtectionAccumulator = {
  teamId: string;
  teamName: string;
  matchesLed: number;
  winsAfterLeading: number;
  drawsAfterLeading: number;
  lossesAfterLeading: number;
  pointsLost: number;
  tablePointsEarned: number;
  largestLeads: number[];
  largestLeadLost: number;
  minuteFirstAhead: number[];
  minuteLeadLost: number[];
  halfTimeLeadsProtected: number;
  sixtyMinuteLeadsProtected: number;
  finalTwentyLeadsProtected: number;
  matchesAheadAtSixty: number;
  winsWhenAheadAtSixty: number;
};

function createLeadProtectionAccumulator(
  teamId: string,
  teamName: string,
): LeadProtectionAccumulator {
  return {
    teamId,
    teamName,
    matchesLed: 0,
    winsAfterLeading: 0,
    drawsAfterLeading: 0,
    lossesAfterLeading: 0,
    pointsLost: 0,
    tablePointsEarned: 0,
    largestLeads: [],
    largestLeadLost: 0,
    minuteFirstAhead: [],
    minuteLeadLost: [],
    halfTimeLeadsProtected: 0,
    sixtyMinuteLeadsProtected: 0,
    finalTwentyLeadsProtected: 0,
    matchesAheadAtSixty: 0,
    winsWhenAheadAtSixty: 0,
  };
}

export function sortLeadProtectionRows(
  rows: RugbyTableStandingRow[],
  sortBy: LeadProtectionSortBy,
): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "most_wins_after_leading") {
      if (b.won !== a.won) return b.won - a.won;
    } else if (sortBy === "fewest_points_lost") {
      const av = Number(a.extra?.pointsLost ?? 0);
      const bv = Number(b.extra?.pointsLost ?? 0);
      if (av !== bv) return av - bv;
    } else if (sortBy === "fewest_losses_after_leading") {
      if (a.lost !== b.lost) return a.lost - b.lost;
    } else if (sortBy === "largest_lead_lost") {
      const av = Number(a.extra?.largestLeadLost ?? 0);
      const bv = Number(b.extra?.largestLeadLost ?? 0);
      if (bv !== av) return bv - av;
    } else if (sortBy === "sixty_minute_lead_protection_pct") {
      const av = Number(a.extra?.sixtyMinuteLeadProtectionPct ?? 0);
      const bv = Number(b.extra?.sixtyMinuteLeadProtectionPct ?? 0);
      if (bv !== av) return bv - av;
    } else {
      const av = Number(a.extra?.leadProtectionPct ?? 0);
      const bv = Number(b.extra?.leadProtectionPct ?? 0);
      if (bv !== av) return bv - av;
    }

    const aProtection = Number(a.extra?.leadProtectionPct ?? 0);
    const bProtection = Number(b.extra?.leadProtectionPct ?? 0);
    if (bProtection !== aProtection) return bProtection - aProtection;
    if (b.won !== a.won) return b.won - a.won;
    const aLost = Number(a.extra?.pointsLost ?? 0);
    const bLost = Number(b.extra?.pointsLost ?? 0);
    if (aLost !== bLost) return aLost - bLost;
    if (a.lost !== b.lost) return a.lost - b.lost;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildLeadProtectionTableStandings(input: {
  seasonPerspectives: TeamFixturePerspective[];
  rules: RugbyScoringRules;
  tableView: RugbyTableView;
  leadPosition?: LeadPositionFilter;
  minimumLead?: number;
  minimumLeadPreset?: MinimumLeadPreset;
  minMatchesPlayed?: number;
  sortBy?: LeadProtectionSortBy;
  dateFrom?: Date;
  dateTo?: Date;
}): {
  rows: RugbyTableStandingRow[];
  scoringPerspectives: TeamFixturePerspective[];
  qualifyingMatchCount: number;
  completedMatchCount: number;
  timelineCoveragePct: number;
  filterSummary: string;
  dateRangeLabel: string | null;
} {
  const leadPosition = input.leadPosition ?? "any_time";
  const minimumLead = input.minimumLead ?? 0;
  const minimumLeadPreset = input.minimumLeadPreset ?? "any";
  let scopedSeason = input.seasonPerspectives;
  if (input.dateFrom || input.dateTo) {
    scopedSeason = filterByKickoffRange(scopedSeason, input.dateFrom, input.dateTo);
  }

  const completedMatchCount = uniqueFixtureCount(scopedSeason);
  const scoringPerspectives = filterLeadProtectionPerspectives({
    perspectives: scopedSeason,
    tableView: input.tableView,
    leadPosition,
    minimumLead,
  });

  const accumulators = new Map<string, LeadProtectionAccumulator>();
  for (const row of scoringPerspectives) {
    const acc =
      accumulators.get(row.teamId) ??
      createLeadProtectionAccumulator(row.teamId, row.teamName);
    const outcome = matchLeaguePoints(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );
    const matchPointsLost = pointsLostFromWinningPosition(
      row.pointsFor,
      row.pointsAgainst,
      row.triesFor,
      input.rules,
    );
    const leadMargin = row.maxLeadMargin ?? 0;

    acc.matchesLed += 1;
    acc.pointsLost += matchPointsLost;
    acc.tablePointsEarned += outcome.leaguePoints;
    if (leadMargin > 0) {
      acc.largestLeads.push(leadMargin);
    }

    if (outcome.result === "won") {
      acc.winsAfterLeading += 1;
      if (row.aheadAtHalfTime === true) acc.halfTimeLeadsProtected += 1;
      if (row.aheadAfterSixty === true) {
        acc.sixtyMinuteLeadsProtected += 1;
        acc.finalTwentyLeadsProtected += 1;
      }
    } else if (outcome.result === "drawn") {
      acc.drawsAfterLeading += 1;
    } else {
      acc.lossesAfterLeading += 1;
      if (leadMargin > acc.largestLeadLost) {
        acc.largestLeadLost = leadMargin;
      }
    }

    if (row.aheadAfterSixty === true) {
      acc.matchesAheadAtSixty += 1;
      if (outcome.result === "won") {
        acc.winsWhenAheadAtSixty += 1;
      }
    }

    if (row.minuteFirstAhead != null) {
      acc.minuteFirstAhead.push(row.minuteFirstAhead);
    }
    if (row.latestLeadLostMinute != null) {
      acc.minuteLeadLost.push(row.latestLeadLostMinute);
    }

    accumulators.set(row.teamId, acc);
  }

  let rows: RugbyTableStandingRow[] = [...accumulators.values()].map((acc) => {
    const leadProtectionPct =
      acc.matchesLed > 0
        ? Math.round((acc.winsAfterLeading / acc.matchesLed) * 1000) / 10
        : null;
    const sixtyMinuteLeadProtectionPct =
      acc.matchesAheadAtSixty > 0
        ? Math.round((acc.winsWhenAheadAtSixty / acc.matchesAheadAtSixty) * 1000) / 10
        : null;

    return {
      rank: 0,
      teamId: acc.teamId,
      teamName: acc.teamName,
      played: acc.matchesLed,
      won: acc.winsAfterLeading,
      drawn: acc.drawsAfterLeading,
      lost: acc.lossesAfterLeading,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: 0,
      leaguePoints: acc.tablePointsEarned,
      extra: {
        leadProtectionPct,
        pointsLost: acc.pointsLost,
        averageLargestLead: average(acc.largestLeads),
        largestLeadLost: acc.largestLeadLost > 0 ? acc.largestLeadLost : null,
        tablePointsEarned: acc.tablePointsEarned,
        halfTimeLeadsProtected:
          acc.halfTimeLeadsProtected > 0 ? acc.halfTimeLeadsProtected : null,
        sixtyMinuteLeadsProtected:
          acc.sixtyMinuteLeadsProtected > 0 ? acc.sixtyMinuteLeadsProtected : null,
        finalTwentyLeadsProtected:
          acc.finalTwentyLeadsProtected > 0 ? acc.finalTwentyLeadsProtected : null,
        avgMinuteFirstAhead: average(acc.minuteFirstAhead),
        avgMinuteLeadLost: average(acc.minuteLeadLost),
        sixtyMinuteLeadProtectionPct,
      },
    };
  });

  rows = sortLeadProtectionRows(rows, input.sortBy ?? "lead_protection_pct");

  const minimum = parseMinMatchesPlayed(input.minMatchesPlayed);
  if (minimum > 1) {
    rows = filterByMinimumMatchesPlayed(rows, minimum);
  }

  const fixturesWithCoverageData = new Set(
    scopedSeason
      .filter((row) => {
        if (leadPosition === "half_time") {
          return row.halfTimeScoreVerified !== false;
        }
        if (leadPosition === "after_sixty") {
          return row.sixtyMinuteScoreVerified !== false;
        }
        return row.scoreTimelineVerified !== false;
      })
      .map((row) => row.fixtureId),
  );
  const qualifyingFixtures = new Set(scoringPerspectives.map((row) => row.fixtureId));

  return {
    rows,
    scoringPerspectives,
    qualifyingMatchCount: qualifyingFixtures.size,
    completedMatchCount,
    timelineCoveragePct:
      completedMatchCount > 0
        ? Math.round((fixturesWithCoverageData.size / completedMatchCount) * 100)
        : 0,
    filterSummary: buildLeadProtectionFilterSummary({
      tableView: input.tableView,
      leadPosition,
      minimumLeadPreset,
      minimumLead,
    }),
    dateRangeLabel: formatFormDateRange(scoringPerspectives),
  };
}
