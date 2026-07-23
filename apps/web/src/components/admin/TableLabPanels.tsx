"use client";

import { CompetitionLiveTable } from "@/components/competitions/CompetitionLiveTable";
import { hemisphereLabel } from "@/lib/team-hemisphere-utils";
import type { FormResult, RugbyTableHemisphereGroup, RugbyTableResult } from "@/lib/table-lab/table-types";
import { confidenceLabel } from "@/lib/table-lab/table-confidence-service";
import { leagueTableOptionalColumns } from "@/lib/table-lab/table-lab-column-utils";
import { exportStandingsCsv } from "@/lib/table-lab/table-view-utils";
import { oppositionPositionRuleLabel } from "@/lib/table-lab/table-lab-param-parsers";
import { isNationsChampionshipSlug } from "@/lib/nations-championship-hemisphere";

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return "Not synced";
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHemisphereDateRange(dateFrom?: string, dateTo?: string): string | null {
  if (!dateFrom && !dateTo) return null;
  if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
  return dateFrom ? `From ${dateFrom}` : `Until ${dateTo ?? ""}`;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function TableLabMetaPanel({ result }: { result: RugbyTableResult }) {
  const { definition } = result;
  const isExtendedLeagueTable =
    definition.id === "full_table" ||
    definition.id === "form_table" ||
    definition.id === "home_table" ||
    definition.id === "away_table" ||
    definition.id === "calendar_year" ||
    definition.id === "on_this_date" ||
    definition.id === "between_dates" ||
    definition.id === "live_table" ||
    definition.id === "first_half" ||
    definition.id === "second_half" ||
    definition.id === "final_20_minutes" ||
    definition.id === "v_top_half" ||
    definition.id === "v_bottom_half" ||
    definition.id === "scoring_first" ||
    definition.id === "conceding_first" ||
    definition.id === "points_gained_losing" ||
    definition.id === "points_lost_winning" ||
    definition.id === "comeback" ||
    definition.id === "lead_protection" ||
    definition.id === "tries_scored" ||
    definition.id === "tries_conceded" ||
    definition.id === "both_teams_scored_tries" ||
    definition.id === "winning_bonus_points" ||
    definition.id === "all_time_premiership" ||
    definition.id === "hemisphere_table";
  const isFormTable = definition.id === "form_table";
  const isHomeTable = definition.id === "home_table";
  const isAwayTable = definition.id === "away_table";
  const isCalendarYearTable = definition.id === "calendar_year";
  const isOnThisDateTable = definition.id === "on_this_date";
  const isBetweenDatesTable = definition.id === "between_dates";
  const isLiveTable = definition.id === "live_table";
  const isFirstHalfTable = definition.id === "first_half";
  const isSecondHalfTable = definition.id === "second_half";
  const isFinalTwentyTable = definition.id === "final_20_minutes";
  const isVTopHalfTable = definition.id === "v_top_half";
  const isVBottomHalfTable = definition.id === "v_bottom_half";
  const isOppositionHalfTable = isVTopHalfTable || isVBottomHalfTable;
  const isScoringFirstTable = definition.id === "scoring_first";
  const isConcedingFirstTable = definition.id === "conceding_first";
  const isPointsGainedLosingTable = definition.id === "points_gained_losing";
  const isPointsLostWinningTable = definition.id === "points_lost_winning";
  const isComebackTable = definition.id === "comeback";
  const isLeadProtectionTable = definition.id === "lead_protection";
  const isTriesScoredTable = definition.id === "tries_scored";
  const isTriesConcededTable = definition.id === "tries_conceded";
  const isBothTeamsScoredTriesTable = definition.id === "both_teams_scored_tries";
  const isWinningBonusPointsTable = definition.id === "winning_bonus_points";
  const isFirstScoreTable = isScoringFirstTable || isConcedingFirstTable;
  const isAllTimeTable = definition.id === "all_time_premiership";
  const isHemisphereTable = definition.id === "hemisphere_table";
  const isVenueSplitTable = isHomeTable || isAwayTable;

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold m-0">{definition.label}</h2>
          <p className="text-sm text-zinc-500 m-0 mt-1 capitalize">{definition.category.replaceAll("_", " ")}</p>
          {result.filterSummary ? (
            <p className="text-sm text-zinc-400 m-0 mt-2">{result.filterSummary}</p>
          ) : null}
          {result.dataCoverageNote ? (
            <p className="text-xs text-zinc-500 m-0 mt-2">{result.dataCoverageNote}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <span className={`cms-status cms-status--${statusTone(result.confidence)}`}>
            {confidenceLabel(result.confidence)}
          </span>
          <span className="cms-status cms-status--neutral">
            Coverage {result.dataCoveragePct}%
          </span>
          <span className="cms-status cms-status--neutral">
            {result.fixtureCount} fixtures
          </span>
          {isExtendedLeagueTable ? (
            <button
              type="button"
              className="cms-btn cms-btn--secondary text-xs py-1 px-2"
              onClick={() => {
                if (isPointsLostWinningTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Matches Led" },
                    { key: "won", label: "Wins" },
                    { key: "drawn", label: "Draws After Leading" },
                    { key: "lost", label: "Losses After Leading" },
                    { key: "pointsLost", label: "Points Lost" },
                    { key: "avgPointsLostPerMatch", label: "Average Points Lost Per Match" },
                    { key: "leadProtectionPct", label: "Lead Protection %" },
                    { key: "wonAfterLeadingPct", label: "Matches Won After Leading %" },
                    { key: "losingBonusRecovered", label: "Losing Bonus Points Recovered" },
                    { key: "avgMinuteFirstAhead", label: "Average Minute First Ahead" },
                    { key: "avgMinuteLeadLost", label: "Average Minute Lead Lost" },
                    { key: "latestLeadLost", label: "Latest Lead Lost" },
                    { key: "largestLeadLost", label: "Largest Lead Lost" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    won: row.won,
                    drawn: row.drawn,
                    lost: row.lost,
                    pointsLost: row.extra?.pointsLost ?? row.leaguePoints,
                    avgPointsLostPerMatch: row.extra?.avgPointsLostPerMatch ?? "",
                    leadProtectionPct: row.extra?.leadProtectionPct ?? "",
                    wonAfterLeadingPct: row.extra?.wonAfterLeadingPct ?? "",
                    losingBonusRecovered: row.extra?.losingBonusRecovered ?? "",
                    avgMinuteFirstAhead: row.extra?.avgMinuteFirstAhead ?? "",
                    avgMinuteLeadLost: row.extra?.avgMinuteLeadLost ?? "",
                    latestLeadLost: row.extra?.latestLeadLost ?? "",
                    largestLeadLost: row.extra?.largestLeadLost ?? "",
                  }));
                  downloadCsv(
                    "points-lost-from-winning-positions.csv",
                    exportStandingsCsv(rows, headers),
                  );
                  return;
                }

                if (isTriesScoredTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Played" },
                    { key: "triesScored", label: "Tries Scored" },
                    { key: "triesPerMatch", label: "Tries Per Match" },
                    { key: "matchesWithTry", label: "Matches With A Try" },
                    { key: "tryScoringRatePct", label: "Try Scoring Rate %" },
                    { key: "matchesWith2Plus", label: "2+ Tries" },
                    { key: "matchesWith3Plus", label: "3+ Tries" },
                    { key: "matchesWith4Plus", label: "4+ Tries" },
                    { key: "matchesWith5Plus", label: "5+ Tries" },
                    { key: "firstHalfTries", label: "First-Half Tries" },
                    { key: "secondHalfTries", label: "Second-Half Tries" },
                    { key: "finalTwentyTries", label: "Final 20 Tries" },
                    { key: "tryBonusPointsTotal", label: "Try Bonus Points" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    triesScored: row.extra?.triesScored ?? row.leaguePoints,
                    triesPerMatch: row.extra?.triesPerMatch ?? "",
                    matchesWithTry: row.extra?.matchesWithTry ?? "",
                    tryScoringRatePct: row.extra?.tryScoringRatePct ?? "",
                    matchesWith2Plus: row.extra?.matchesWith2Plus ?? "",
                    matchesWith3Plus: row.extra?.matchesWith3Plus ?? "",
                    matchesWith4Plus: row.extra?.matchesWith4Plus ?? "",
                    matchesWith5Plus: row.extra?.matchesWith5Plus ?? "",
                    firstHalfTries: row.extra?.firstHalfTries ?? "",
                    secondHalfTries: row.extra?.secondHalfTries ?? "",
                    finalTwentyTries: row.extra?.finalTwentyTries ?? "",
                    tryBonusPointsTotal: row.extra?.tryBonusPointsTotal ?? "",
                  }));
                  downloadCsv("tries-scored-table.csv", exportStandingsCsv(rows, headers));
                  return;
                }

                if (isTriesConcededTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Played" },
                    { key: "triesConceded", label: "Tries Conceded" },
                    { key: "triesConcededPerMatch", label: "Tries Conceded Per Match" },
                    { key: "matchesConcedingTry", label: "Matches Conceding A Try" },
                    { key: "tryConcedingRatePct", label: "Try Conceding Rate %" },
                    { key: "matchesConceding2Plus", label: "Conceded 2+ Tries" },
                    { key: "matchesConceding3Plus", label: "Conceded 3+ Tries" },
                    { key: "matchesConceding4Plus", label: "Conceded 4+ Tries" },
                    { key: "matchesConceding5Plus", label: "Conceded 5+ Tries" },
                    { key: "firstHalfTriesConceded", label: "First-Half Tries Conceded" },
                    { key: "secondHalfTriesConceded", label: "Second-Half Tries Conceded" },
                    { key: "finalTwentyTriesConceded", label: "Final 20 Tries Conceded" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    triesConceded: row.extra?.triesConceded ?? row.leaguePoints,
                    triesConcededPerMatch: row.extra?.triesConcededPerMatch ?? "",
                    matchesConcedingTry: row.extra?.matchesConcedingTry ?? "",
                    tryConcedingRatePct: row.extra?.tryConcedingRatePct ?? "",
                    matchesConceding2Plus: row.extra?.matchesConceding2Plus ?? "",
                    matchesConceding3Plus: row.extra?.matchesConceding3Plus ?? "",
                    matchesConceding4Plus: row.extra?.matchesConceding4Plus ?? "",
                    matchesConceding5Plus: row.extra?.matchesConceding5Plus ?? "",
                    firstHalfTriesConceded: row.extra?.firstHalfTriesConceded ?? "",
                    secondHalfTriesConceded: row.extra?.secondHalfTriesConceded ?? "",
                    finalTwentyTriesConceded: row.extra?.finalTwentyTriesConceded ?? "",
                  }));
                  downloadCsv("tries-conceded-table.csv", exportStandingsCsv(rows, headers));
                  return;
                }

                if (isBothTeamsScoredTriesTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Played" },
                    { key: "bothTeamsScoredYes", label: "Yes" },
                    { key: "bothTeamsScoredNo", label: "No" },
                    { key: "bothTeamsScoredYesPct", label: "Yes %" },
                    { key: "bothTeamsScoredNoPct", label: "No %" },
                    { key: "bothTeams2Plus", label: "Both Teams 2+ Tries" },
                    { key: "bothTeams2PlusPct", label: "Both Teams 2+ Tries %" },
                    { key: "bothTeams3Plus", label: "Both Teams 3+ Tries" },
                    { key: "bothTeams3PlusPct", label: "Both Teams 3+ Tries %" },
                    { key: "bothTeams4Plus", label: "Both Teams 4+ Tries" },
                    { key: "bothTeams4PlusPct", label: "Both Teams 4+ Tries %" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    bothTeamsScoredYes: row.extra?.bothTeamsScoredYes ?? row.leaguePoints,
                    bothTeamsScoredNo: row.extra?.bothTeamsScoredNo ?? "",
                    bothTeamsScoredYesPct: row.extra?.bothTeamsScoredYesPct ?? "",
                    bothTeamsScoredNoPct: row.extra?.bothTeamsScoredNoPct ?? "",
                    bothTeams2Plus: row.extra?.bothTeams2Plus ?? "",
                    bothTeams2PlusPct: row.extra?.bothTeams2PlusPct ?? "",
                    bothTeams3Plus: row.extra?.bothTeams3Plus ?? "",
                    bothTeams3PlusPct: row.extra?.bothTeams3PlusPct ?? "",
                    bothTeams4Plus: row.extra?.bothTeams4Plus ?? "",
                    bothTeams4PlusPct: row.extra?.bothTeams4PlusPct ?? "",
                  }));
                  downloadCsv(
                    "both-teams-scored-tries.csv",
                    exportStandingsCsv(rows, headers),
                  );
                  return;
                }

                if (isWinningBonusPointsTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Played" },
                    { key: "won", label: "Wins" },
                    { key: "tryBonusPointsTotal", label: "Try Bonus Points" },
                    { key: "losingBonusPointsTotal", label: "Losing Bonus Points" },
                    { key: "totalBonusPoints", label: "Total Bonus Points" },
                    { key: "bonusPointMatches", label: "Bonus Point Matches" },
                    { key: "bonusPointRatePct", label: "Bonus Point Rate %" },
                    { key: "maximumPointWins", label: "Maximum-Point Wins" },
                    { key: "maximumPointWinPct", label: "Maximum-Point Win %" },
                    { key: "tryBonusPointsPerMatch", label: "Try Bonus Points Per Match" },
                    { key: "bonusPointsPerMatch", label: "Bonus Points Per Match" },
                    { key: "homeBonusPoints", label: "Home Bonus Points" },
                    { key: "awayBonusPoints", label: "Away Bonus Points" },
                    { key: "currentBonusStreak", label: "Current Bonus Point Streak" },
                    { key: "longestBonusStreak", label: "Longest Bonus Point Streak" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    won: row.won,
                    tryBonusPointsTotal: row.extra?.tryBonusPointsTotal ?? row.tryBonusPoints ?? "",
                    losingBonusPointsTotal:
                      row.extra?.losingBonusPointsTotal ?? row.losingBonusPoints ?? "",
                    totalBonusPoints: row.extra?.totalBonusPoints ?? row.bonusPoints,
                    bonusPointMatches: row.extra?.bonusPointMatches ?? "",
                    bonusPointRatePct: row.extra?.bonusPointRatePct ?? "",
                    maximumPointWins: row.extra?.maximumPointWins ?? "",
                    maximumPointWinPct: row.extra?.maximumPointWinPct ?? "",
                    tryBonusPointsPerMatch: row.extra?.tryBonusPointsPerMatch ?? "",
                    bonusPointsPerMatch: row.extra?.bonusPointsPerMatch ?? "",
                    homeBonusPoints: row.extra?.homeBonusPoints ?? "",
                    awayBonusPoints: row.extra?.awayBonusPoints ?? "",
                    currentBonusStreak: row.extra?.currentBonusStreak ?? "",
                    longestBonusStreak: row.extra?.longestBonusStreak ?? "",
                  }));
                  downloadCsv(
                    "winning-bonus-points-table.csv",
                    exportStandingsCsv(rows, headers),
                  );
                  return;
                }

                if (isLeadProtectionTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Matches Led" },
                    { key: "won", label: "Wins After Leading" },
                    { key: "drawn", label: "Draws After Leading" },
                    { key: "lost", label: "Losses After Leading" },
                    { key: "leadProtectionPct", label: "Lead Protection %" },
                    { key: "pointsLost", label: "Points Lost" },
                    { key: "averageLargestLead", label: "Average Largest Lead" },
                    { key: "largestLeadLost", label: "Largest Lead Lost" },
                    { key: "tablePointsEarned", label: "Table Points Earned" },
                    { key: "halfTimeLeadsProtected", label: "Half-Time Leads Protected" },
                    { key: "sixtyMinuteLeadsProtected", label: "60-Minute Leads Protected" },
                    { key: "finalTwentyLeadsProtected", label: "Final 20 Leads Protected" },
                    { key: "avgMinuteFirstAhead", label: "Average Minute First Ahead" },
                    { key: "avgMinuteLeadLost", label: "Average Minute Lead Lost" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    won: row.won,
                    drawn: row.drawn,
                    lost: row.lost,
                    leadProtectionPct: row.extra?.leadProtectionPct ?? "",
                    pointsLost: row.extra?.pointsLost ?? "",
                    averageLargestLead: row.extra?.averageLargestLead ?? "",
                    largestLeadLost: row.extra?.largestLeadLost ?? "",
                    tablePointsEarned: row.extra?.tablePointsEarned ?? row.leaguePoints,
                    halfTimeLeadsProtected: row.extra?.halfTimeLeadsProtected ?? "",
                    sixtyMinuteLeadsProtected: row.extra?.sixtyMinuteLeadsProtected ?? "",
                    finalTwentyLeadsProtected: row.extra?.finalTwentyLeadsProtected ?? "",
                    avgMinuteFirstAhead: row.extra?.avgMinuteFirstAhead ?? "",
                    avgMinuteLeadLost: row.extra?.avgMinuteLeadLost ?? "",
                  }));
                  downloadCsv("lead-protection-table.csv", exportStandingsCsv(rows, headers));
                  return;
                }

                if (isComebackTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Matches Behind" },
                    { key: "won", label: "Comeback Wins" },
                    { key: "drawn", label: "Comeback Draws" },
                    { key: "totalSuccessfulComebacks", label: "Total Successful Comebacks" },
                    { key: "comebackSuccessPct", label: "Comeback Success %" },
                    { key: "comebackWinPct", label: "Comeback Win %" },
                    { key: "comebackDrawPct", label: "Comeback Draw %" },
                    { key: "largestDeficitOvercome", label: "Largest Deficit Overcome" },
                    { key: "averageDeficitOvercome", label: "Average Deficit Overcome" },
                    { key: "tablePointsGained", label: "Table Points Gained" },
                    { key: "comebacksFrom7Plus", label: "Comebacks From 7+ Behind" },
                    { key: "comebacksFrom10Plus", label: "Comebacks From 10+ Behind" },
                    { key: "comebacksFrom14Plus", label: "Comebacks From 14+ Behind" },
                    { key: "secondHalfComebacks", label: "Second-Half Comebacks" },
                    { key: "finalTwentyComebacks", label: "Final 20 Comebacks" },
                    { key: "latestWinningScoreMinute", label: "Latest Winning Score Minute" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    won: row.won,
                    drawn: row.drawn,
                    totalSuccessfulComebacks: row.extra?.totalSuccessfulComebacks ?? "",
                    comebackSuccessPct: row.extra?.comebackSuccessPct ?? "",
                    comebackWinPct: row.extra?.comebackWinPct ?? "",
                    comebackDrawPct: row.extra?.comebackDrawPct ?? "",
                    largestDeficitOvercome: row.extra?.largestDeficitOvercome ?? "",
                    averageDeficitOvercome: row.extra?.averageDeficitOvercome ?? "",
                    tablePointsGained: row.extra?.tablePointsGained ?? row.leaguePoints,
                    comebacksFrom7Plus: row.extra?.comebacksFrom7Plus ?? "",
                    comebacksFrom10Plus: row.extra?.comebacksFrom10Plus ?? "",
                    comebacksFrom14Plus: row.extra?.comebacksFrom14Plus ?? "",
                    secondHalfComebacks: row.extra?.secondHalfComebacks ?? "",
                    finalTwentyComebacks: row.extra?.finalTwentyComebacks ?? "",
                    latestWinningScoreMinute: row.extra?.latestWinningScoreMinute ?? "",
                  }));
                  downloadCsv("comeback-table.csv", exportStandingsCsv(rows, headers));
                  return;
                }

                if (isPointsGainedLosingTable) {
                  const headers = [
                    { key: "rank", label: "Position" },
                    { key: "teamName", label: "Team" },
                    { key: "played", label: "Matches Behind" },
                    { key: "won", label: "Comeback Wins" },
                    { key: "drawn", label: "Comeback Draws" },
                    { key: "comebackLossesWithBonus", label: "Comeback Losses With Bonus" },
                    { key: "pointsGained", label: "Points Gained" },
                    { key: "avgPointsGainedPerMatch", label: "Average Points Gained Per Match" },
                    { key: "comebackWinPct", label: "Comeback Win %" },
                    { key: "bestComebackMargin", label: "Best Comeback Margin" },
                    { key: "tryBonusPointsGained", label: "Try Bonus Points Gained" },
                    { key: "losingBonusPointsGained", label: "Losing Bonus Points Gained" },
                    { key: "avgMinuteFirstBehind", label: "Average Minute First Behind" },
                  ];
                  const rows = result.rows.map((row) => ({
                    rank: row.rank,
                    teamName: row.teamName,
                    played: row.played,
                    won: row.won,
                    drawn: row.drawn,
                    comebackLossesWithBonus: row.extra?.comebackLossesWithBonus ?? "",
                    pointsGained: row.extra?.pointsGained ?? row.leaguePoints,
                    avgPointsGainedPerMatch: row.extra?.avgPointsGainedPerMatch ?? "",
                    comebackWinPct: row.extra?.comebackWinPct ?? "",
                    bestComebackMargin: row.extra?.bestComebackMargin ?? "",
                    tryBonusPointsGained: row.extra?.tryBonusPointsGained ?? "",
                    losingBonusPointsGained: row.extra?.losingBonusPointsGained ?? "",
                    avgMinuteFirstBehind: row.extra?.avgMinuteFirstBehind ?? "",
                  }));
                  downloadCsv(
                    "points-gained-from-losing-positions.csv",
                    exportStandingsCsv(rows, headers),
                  );
                  return;
                }

                const optional = leagueTableOptionalColumns(result.rows);
                const headers = extendedLeagueCsvHeaders({
                  includeForm: isFormTable,
                  includeSeasons: isAllTimeTable,
                  includeHemisphere: isHemisphereTable && result.hemisphereMode === "breakdown",
                  includeWinPct:
                    isHemisphereTable || isVenueSplitTable || isAllTimeTable || isOppositionHalfTable || isFirstScoreTable || isPointsGainedLosingTable,
                  winPctLabel: isHomeTable
                    ? "Home Win %"
                    : isAwayTable
                      ? "Away Win %"
                      : undefined,
                  ...optional,
                });
                const rows = result.rows.map((row) =>
                  extendedLeagueCsvRow(row, {
                    includeForm: isFormTable,
                    includeSeasons: isAllTimeTable,
                    includeHemisphere: isHemisphereTable && result.hemisphereMode === "breakdown",
                    includeWinPct:
                    isHemisphereTable || isVenueSplitTable || isAllTimeTable || isOppositionHalfTable || isFirstScoreTable || isPointsGainedLosingTable,
                    ...optional,
                  }),
                );
                const filename = isFormTable
                  ? "form-table.csv"
                  : isHomeTable
                    ? "home-table.csv"
                      : isAwayTable
                        ? "away-table.csv"
                        : isCalendarYearTable
                          ? "calendar-year-table.csv"
                          : isOnThisDateTable
                            ? "table-on-this-date.csv"
                            : isBetweenDatesTable
                              ? "table-between-dates.csv"
                              : isLiveTable
                                ? "live-table.csv"
                                : isFirstHalfTable
                                  ? "first-half-table.csv"
                                  : isSecondHalfTable
                                    ? "second-half-table.csv"
                                    : isFinalTwentyTable
                                      ? "final-20-minutes-table.csv"
                                      : isVTopHalfTable
                                        ? "table-v-top-half.csv"
                                        : isVBottomHalfTable
                                          ? "table-v-bottom-half.csv"
                                          : isScoringFirstTable
                                            ? "table-when-scoring-first.csv"
                                            : isConcedingFirstTable
                                              ? "table-when-conceding-first.csv"
                                              : isPointsGainedLosingTable
                                                ? "points-gained-from-losing-positions.csv"
                                                : isPointsLostWinningTable
                                                  ? "points-lost-from-winning-positions.csv"
                                                  : isComebackTable
                                                    ? "comeback-table.csv"
                                                    : isLeadProtectionTable
                                                      ? "lead-protection-table.csv"
                                                      : isTriesScoredTable
                                                        ? "tries-scored-table.csv"
                                                        : isTriesConcededTable
                                                          ? "tries-conceded-table.csv"
                                                          : isBothTeamsScoredTriesTable
                                                            ? "both-teams-scored-tries.csv"
                                                            : isWinningBonusPointsTable
                                                              ? "winning-bonus-points-table.csv"
                                                              : isAllTimeTable
                        ? "all-time-premiership.csv"
                        : isHemisphereTable
                          ? "hemisphere-table.csv"
                          : "full-table.csv";
                downloadCsv(filename, exportStandingsCsv(rows, headers));
              }}
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">What it means</dt>
          <dd className="m-0 text-zinc-300">{definition.explanation}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Calculation</dt>
          <dd className="m-0 text-zinc-300">{definition.calculationMethod}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Data tiers</dt>
          <dd className="m-0 text-zinc-300">
            <span className="block">
              Minimum: {definition.minimumData.map((item) => item.replaceAll("_", " ")).join(", ")}
            </span>
            {definition.enhancedData.length > 0 ? (
              <span className="block text-zinc-400">
                Enhanced: {definition.enhancedData.map((item) => item.replaceAll("_", " ")).join(", ")}
              </span>
            ) : null}
            {definition.advancedData.length > 0 ? (
              <span className="block text-zinc-400">
                Advanced: {definition.advancedData.map((item) => item.replaceAll("_", " ")).join(", ")}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Availability</dt>
          <dd className="m-0 text-zinc-300">
            {result.available
              ? `Built from ${result.evaluatedFixtureCount} team-fixture rows.`
              : "Unavailable for the current scope — required data is missing."}
          </dd>
        </div>
        {isAllTimeTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Seasons included</dt>
              <dd className="m-0 text-zinc-300">{result.allTimeSeasonsLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Teams / matches</dt>
              <dd className="m-0 text-zinc-300">
                {result.allTimeTeamCount ?? 0} teams · {result.allTimeMatchCount ?? 0} team-fixture rows
              </dd>
            </div>
            {result.allTimeCoverage ? (
              <div>
                <dt className="text-zinc-500">Data coverage</dt>
                <dd className="m-0 text-zinc-300">
                  Results {result.allTimeCoverage.resultsCoveragePct}% · Tries{" "}
                  {result.allTimeCoverage.triesCoveragePct}% · Bonus{" "}
                  {result.allTimeCoverage.bonusCoveragePct}%
                </dd>
              </div>
            ) : null}
            {result.historicScoringNotice ? (
              <div>
                <dt className="text-zinc-500">Historic scoring</dt>
                <dd className="m-0 text-zinc-300">{result.historicScoringNotice}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Last updated</dt>
              <dd className="m-0 text-zinc-300">{formatLastUpdated(result.lastUpdated)}</dd>
            </div>
          </>
        ) : null}
        {isHemisphereTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Hemisphere rule</dt>
              <dd className="m-0 text-zinc-300">
                {result.hemisphereRuleNote ??
                  "Teams need an explicit hemisphere in admin. Unknown values are excluded unless enabled."}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Unknown teams</dt>
              <dd className="m-0 text-zinc-300">{result.unknownTeamCount ?? 0}</dd>
            </div>
            {formatHemisphereDateRange(result.context.dateFrom, result.context.dateTo) ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">
                  {formatHemisphereDateRange(result.context.dateFrom, result.context.dateTo)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Last updated</dt>
              <dd className="m-0 text-zinc-300">{formatLastUpdated(result.lastUpdated)}</dd>
            </div>
          </>
        ) : null}
        {isCalendarYearTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Calendar year</dt>
              <dd className="m-0 text-zinc-300">{result.calendarYear ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Seasons included</dt>
              <dd className="m-0 text-zinc-300">{result.seasonsIncludedLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches</dt>
              <dd className="m-0 text-zinc-300">
                {result.calendarYearMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            {result.calendarYearCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.calendarYearCalculationNote}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isOnThisDateTable ? (
          <>
            <div>
              <dt className="text-zinc-500">As-of date</dt>
              <dd className="m-0 text-zinc-300">{result.asOfDateLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches included</dt>
              <dd className="m-0 text-zinc-300">
                {result.onThisDateMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Table status</dt>
              <dd className="m-0 text-zinc-300 capitalize">
                {result.tableOnDateStatus ?? "calculated"}
              </dd>
            </div>
            {result.tableOnDateCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.tableOnDateCalculationNote}</dd>
              </div>
            ) : null}
            {result.tableOnDateDeductionNotice ? (
              <div>
                <dt className="text-zinc-500">Deductions</dt>
                <dd className="m-0 text-zinc-300">{result.tableOnDateDeductionNotice}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isBetweenDatesTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Date range</dt>
              <dd className="m-0 text-zinc-300">{result.dateRangeLabel ?? "—"}</dd>
            </div>
            {result.seasonsIncludedLabel ? (
              <div>
                <dt className="text-zinc-500">Seasons included</dt>
                <dd className="m-0 text-zinc-300">{result.seasonsIncludedLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Matches included</dt>
              <dd className="m-0 text-zinc-300">
                {result.betweenDatesMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            {result.betweenDatesCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.betweenDatesCalculationNote}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isLiveTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Live updated</dt>
              <dd className="m-0 text-zinc-300">{formatLastUpdated(result.liveUpdatedAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Live matches included</dt>
              <dd className="m-0 text-zinc-300">{result.liveMatchCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Include live matches</dt>
              <dd className="m-0 text-zinc-300">{result.includeLiveMatches === false ? "No" : "Yes"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Show movement</dt>
              <dd className="m-0 text-zinc-300">{result.showMovement === false ? "No" : "Yes"}</dd>
            </div>
            {result.liveTableCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.liveTableCalculationNote}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isFirstHalfTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.firstHalfCoverageLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with first-half data</dt>
              <dd className="m-0 text-zinc-300">
                {result.firstHalfMatchCount ?? 0} of {result.firstHalfCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            {result.firstHalfCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.firstHalfCalculationNote}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isSecondHalfTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.secondHalfCoverageLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with second-half data</dt>
              <dd className="m-0 text-zinc-300">
                {result.secondHalfMatchCount ?? 0} of {result.secondHalfCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            {result.secondHalfCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.secondHalfCalculationNote}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isFinalTwentyTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.finalTwentyCoverageLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with final 20 data</dt>
              <dd className="m-0 text-zinc-300">
                {result.finalTwentyMatchCount ?? 0} of {result.finalTwentyCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Include extra time</dt>
              <dd className="m-0 text-zinc-300">{result.includeExtraTime ? "Yes" : "No"}</dd>
            </div>
            {result.finalTwentyCalculationNote ? (
              <div>
                <dt className="text-zinc-500">Calculation note</dt>
                <dd className="m-0 text-zinc-300">{result.finalTwentyCalculationNote}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isVTopHalfTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Top half definition</dt>
              <dd className="m-0 text-zinc-300">{result.topHalfRankRangeLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Opposition position rule</dt>
              <dd className="m-0 text-zinc-300">
                {oppositionPositionRuleLabel(
                  result.oppositionPositionRule ?? "current_position",
                )}
                {result.provisionalFinalSeason ? " (provisional)" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches included</dt>
              <dd className="m-0 text-zinc-300">
                {result.topHalfMatchCount ?? 0} completed fixtures v top-half opposition
              </dd>
            </div>
            {result.topHalfFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.topHalfFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isVBottomHalfTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Bottom half definition</dt>
              <dd className="m-0 text-zinc-300">{result.bottomHalfRankRangeLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Opposition position rule</dt>
              <dd className="m-0 text-zinc-300">
                {oppositionPositionRuleLabel(
                  result.oppositionPositionRule ?? "current_position",
                )}
                {result.provisionalFinalSeason ? " (provisional)" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches included</dt>
              <dd className="m-0 text-zinc-300">
                {result.bottomHalfMatchCount ?? 0} completed fixtures v bottom-half opposition
              </dd>
            </div>
            {result.bottomHalfFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.bottomHalfFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isPointsLostWinningTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Winning position</dt>
              <dd className="m-0 text-zinc-300">
                {result.winningPositionFilter === "half_time"
                  ? "Ahead at half-time"
                  : result.winningPositionFilter === "after_sixty"
                    ? "Ahead after 60 minutes"
                    : "Ahead at any time"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with score timeline data</dt>
              <dd className="m-0 text-zinc-300">
                {result.pointsLostWinningMatchCount ?? 0} of{" "}
                {result.pointsLostWinningCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.pointsLostWinningCoveragePct ?? 0}%</dd>
            </div>
            {result.pointsLostWinningFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.pointsLostWinningFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isTriesScoredTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Period</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesScoredPeriod === "first_half"
                  ? "First half"
                  : result.triesScoredPeriod === "second_half"
                    ? "Second half"
                    : result.triesScoredPeriod === "final_20"
                      ? "Final 20 minutes"
                      : "Full match"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Match range</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesMatchRangeCount != null
                  ? `Last ${result.triesMatchRangeCount} matches`
                  : "All matches"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with try data</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesScoredMatchCount ?? 0} of {result.triesScoredCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Try data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.triesScoredCoveragePct ?? 0}%</dd>
            </div>
            {result.triesScoredFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.triesScoredFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isTriesConcededTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Period</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesConcededPeriod === "first_half"
                  ? "First half"
                  : result.triesConcededPeriod === "second_half"
                    ? "Second half"
                    : result.triesConcededPeriod === "final_20"
                      ? "Final 20 minutes"
                      : "Full match"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Match range</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesMatchRangeCount != null
                  ? `Last ${result.triesMatchRangeCount} matches`
                  : "All matches"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with try data</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesConcededMatchCount ?? 0} of{" "}
                {result.triesConcededCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Try data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.triesConcededCoveragePct ?? 0}%</dd>
            </div>
            {result.triesConcededFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.triesConcededFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isBothTeamsScoredTriesTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Match range</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesMatchRangeCount != null
                  ? `Last ${result.triesMatchRangeCount} matches`
                  : "All matches"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with try data</dt>
              <dd className="m-0 text-zinc-300">
                {result.bothTeamsScoredTriesMatchCount ?? 0} of{" "}
                {result.bothTeamsScoredTriesCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Try data coverage</dt>
              <dd className="m-0 text-zinc-300">
                {result.bothTeamsScoredTriesCoveragePct ?? 0}%
              </dd>
            </div>
            {result.bothTeamsScoredTriesFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.bothTeamsScoredTriesFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isWinningBonusPointsTable ? (
          <>
            {result.winningBonusNotApplicable ? (
              <div>
                <dt className="text-zinc-500">Bonus points</dt>
                <dd className="m-0 text-zinc-300">Not applicable</dd>
              </div>
            ) : null}
            {result.winningBonusScoringRulesSummary ? (
              <div>
                <dt className="text-zinc-500">Bonus rule used</dt>
                <dd className="m-0 text-zinc-300">{result.winningBonusScoringRulesSummary}</dd>
              </div>
            ) : null}
            {result.winningBonusMaximumTablePoints != null ? (
              <div>
                <dt className="text-zinc-500">Maximum points available</dt>
                <dd className="m-0 text-zinc-300">{result.winningBonusMaximumTablePoints}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Match range</dt>
              <dd className="m-0 text-zinc-300">
                {result.triesMatchRangeCount != null
                  ? `Last ${result.triesMatchRangeCount} matches`
                  : "All matches"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with bonus data</dt>
              <dd className="m-0 text-zinc-300">
                {result.winningBonusPointsMatchCount ?? 0} of{" "}
                {result.winningBonusPointsCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.winningBonusPointsCoveragePct ?? 0}%</dd>
            </div>
            {result.winningBonusPointsFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.winningBonusPointsFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isLeadProtectionTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Lead position</dt>
              <dd className="m-0 text-zinc-300">
                {result.leadPositionFilter === "half_time"
                  ? "Ahead at half-time"
                  : result.leadPositionFilter === "after_sixty"
                    ? "Ahead after 60 minutes"
                    : "Ahead at any time"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Minimum lead</dt>
              <dd className="m-0 text-zinc-300">
                {result.minimumLeadPreset === "custom" && result.minimumLeadPoints
                  ? `${result.minimumLeadPoints}+ points`
                  : result.minimumLeadPreset === "any"
                    ? "Any lead"
                    : `${result.minimumLeadPreset}+ points`}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with score timeline data</dt>
              <dd className="m-0 text-zinc-300">
                {result.leadProtectionMatchCount ?? 0} of{" "}
                {result.leadProtectionCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.leadProtectionCoveragePct ?? 0}%</dd>
            </div>
            {result.leadProtectionFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.leadProtectionFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isComebackTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Comeback from</dt>
              <dd className="m-0 text-zinc-300">
                {result.comebackFromFilter === "half_time"
                  ? "Behind at half-time"
                  : result.comebackFromFilter === "after_sixty"
                    ? "Behind after 60 minutes"
                    : "Behind at any time"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Minimum deficit</dt>
              <dd className="m-0 text-zinc-300">
                {result.minimumDeficitPreset === "custom" && result.minimumDeficitPoints
                  ? `${result.minimumDeficitPoints}+ points`
                  : result.minimumDeficitPreset === "any"
                    ? "Any deficit"
                    : `${result.minimumDeficitPreset}+ points`}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with score timeline data</dt>
              <dd className="m-0 text-zinc-300">
                {result.comebackMatchCount ?? 0} of {result.comebackCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.comebackCoveragePct ?? 0}%</dd>
            </div>
            {result.comebackFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.comebackFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isPointsGainedLosingTable ? (
          <>
            <div>
              <dt className="text-zinc-500">Losing position</dt>
              <dd className="m-0 text-zinc-300">
                {result.losingPositionFilter === "half_time"
                  ? "Behind at half-time"
                  : result.losingPositionFilter === "after_sixty"
                    ? "Behind after 60 minutes"
                    : "Behind at any time"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with score timeline data</dt>
              <dd className="m-0 text-zinc-300">
                {result.pointsGainedLosingMatchCount ?? 0} of{" "}
                {result.pointsGainedLosingCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.pointsGainedLosingCoveragePct ?? 0}%</dd>
            </div>
            {result.pointsGainedLosingFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.pointsGainedLosingFilterSummary}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isConcedingFirstTable ? (
          <>
            <div>
              <dt className="text-zinc-500">First score conceded type</dt>
              <dd className="m-0 text-zinc-300">
                {result.firstScoreType === "try"
                  ? "Try"
                  : result.firstScoreType === "penalty"
                    ? "Penalty"
                    : result.firstScoreType === "drop_goal"
                      ? "Drop goal"
                      : "Any score"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with first-score data</dt>
              <dd className="m-0 text-zinc-300">
                {result.concedingFirstMatchCount ?? 0} of{" "}
                {result.concedingFirstCompletedMatchCount ?? 0} completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.concedingFirstCoveragePct ?? 0}%</dd>
            </div>
            {result.concedingFirstFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.concedingFirstFilterSummary}</dd>
              </div>
            ) : null}
            {result.ambiguousFirstScoreFixtureCount ? (
              <div>
                <dt className="text-zinc-500">Ambiguous fixtures excluded</dt>
                <dd className="m-0 text-zinc-300">{result.ambiguousFirstScoreFixtureCount}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isScoringFirstTable ? (
          <>
            <div>
              <dt className="text-zinc-500">First score type</dt>
              <dd className="m-0 text-zinc-300">
                {result.firstScoreType === "try"
                  ? "Try"
                  : result.firstScoreType === "penalty"
                    ? "Penalty"
                    : result.firstScoreType === "drop_goal"
                      ? "Drop goal"
                      : "Any score"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Matches with first-score data</dt>
              <dd className="m-0 text-zinc-300">
                {result.scoringFirstMatchCount ?? 0} of {result.scoringFirstCompletedMatchCount ?? 0}{" "}
                completed fixtures
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Data coverage</dt>
              <dd className="m-0 text-zinc-300">{result.scoringFirstCoveragePct ?? 0}%</dd>
            </div>
            {result.scoringFirstFilterSummary ? (
              <div>
                <dt className="text-zinc-500">Calculation method</dt>
                <dd className="m-0 text-zinc-300">{result.scoringFirstFilterSummary}</dd>
              </div>
            ) : null}
            {result.ambiguousFirstScoreFixtureCount ? (
              <div>
                <dt className="text-zinc-500">Ambiguous fixtures excluded</dt>
                <dd className="m-0 text-zinc-300">{result.ambiguousFirstScoreFixtureCount}</dd>
              </div>
            ) : null}
            {result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">Minimum matches</dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {isExtendedLeagueTable &&
        !isHemisphereTable &&
        !isAllTimeTable &&
        !isCalendarYearTable &&
        !isOnThisDateTable &&
        !isBetweenDatesTable &&
        !isLiveTable &&
        !isFirstHalfTable &&
        !isSecondHalfTable &&
        !isFinalTwentyTable &&
        !isOppositionHalfTable &&
        !isFirstScoreTable &&
        !isPointsGainedLosingTable &&
        !isPointsLostWinningTable &&
        !isComebackTable &&
        !isLeadProtectionTable &&
        !isTriesScoredTable &&
        !isTriesConcededTable &&
        !isBothTeamsScoredTriesTable &&
        !isWinningBonusPointsTable ? (
          <>
            {isFormTable && result.formMatchCount != null ? (
              <div>
                <dt className="text-zinc-500">Match window</dt>
                <dd className="m-0 text-zinc-300">Last {result.formMatchCount} completed matches per team</dd>
              </div>
            ) : null}
            {isVenueSplitTable && result.minMatchesPlayed != null && result.minMatchesPlayed > 1 ? (
              <div>
                <dt className="text-zinc-500">
                  {isHomeTable ? "Minimum home matches" : "Minimum away matches"}
                </dt>
                <dd className="m-0 text-zinc-300">{result.minMatchesPlayed}</dd>
              </div>
            ) : null}
            {(isFormTable || isVenueSplitTable) && result.dateRangeLabel ? (
              <div>
                <dt className="text-zinc-500">Date range covered</dt>
                <dd className="m-0 text-zinc-300">{result.dateRangeLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Last updated</dt>
              <dd className="m-0 text-zinc-300">{formatLastUpdated(result.lastUpdated)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {result.warnings.length > 0 ? (
        <ul className="mt-4 mb-0 pl-4 text-sm text-amber-300 space-y-1">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function statusTone(confidence: RugbyTableResult["confidence"]) {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warning";
  if (confidence === "low") return "warning";
  return "neutral";
}

export function TableLabResultsTable({ result }: { result: RugbyTableResult }) {
  if (!result.available || result.rows.length === 0) {
    return (
      <div className="cms-card">
        <p className="text-sm text-zinc-500 m-0">
          Table unavailable. Import fixtures and SDMS match stats, or choose a different table type.
        </p>
      </div>
    );
  }

  // Sport365-style live standings: live strip, purple rows, score badges.
  if (result.definition.id === "live_table") {
    return (
      <CompetitionLiveTable
        rows={result.rows}
        hemisphereGroups={result.hemisphereGroups}
        showMovement={result.showMovement !== false}
        liveMatchCount={result.liveMatchCount}
        note={result.liveTableCalculationNote ?? result.filterSummary}
      />
    );
  }

  if (result.hemisphereGroups && result.hemisphereGroups.length > 0 && result.definition.id !== "hemisphere_table") {
    return <TableLabHemisphereResults result={result} groups={result.hemisphereGroups} />;
  }

  return <TableLabStandingsTable result={result} />;
}

function TableLabHemisphereResults({
  result,
  groups,
}: {
  result: RugbyTableResult;
  groups: RugbyTableHemisphereGroup[];
}) {
  const optional = leagueTableOptionalColumns([
    ...result.rows,
    ...groups.flatMap((group) => group.rows),
  ]);
  const useCompact =
    (isNationsChampionshipSlug(result.competition?.slug) ||
      result.definition.id === "hemisphere_table") &&
    !optional.showTfTa &&
    !optional.showTbpLbp;

  return (
    <div className="space-y-4">
      <div className="cms-card overflow-x-auto">
        <h3 className="text-base font-semibold m-0 mb-3">Full table</h3>
        <TableLabStandingsBody
          rows={result.rows}
          result={result}
          compactLeagueColumns={useCompact}
          extendedLeagueColumns={!useCompact}
          optionalColumns={optional}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.hemisphere} className="cms-card overflow-x-auto">
            <h3 className="text-base font-semibold m-0 mb-3">{group.label}</h3>
            <TableLabStandingsBody
              rows={group.rows}
              result={result}
              compactLeagueColumns={useCompact}
              extendedLeagueColumns={!useCompact}
              optionalColumns={optional}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableLabStandingsTable({ result }: { result: RugbyTableResult }) {
  const optional = leagueTableOptionalColumns(result.rows);
  const compact =
    result.definition.id !== "full_table" &&
    result.definition.id !== "form_table" &&
    result.definition.id !== "home_table" &&
    result.definition.id !== "away_table" &&
    result.definition.id !== "all_time_premiership" &&
    result.definition.id !== "hemisphere_table" &&
    isNationsChampionshipSlug(result.competition?.slug) &&
    !optional.showTfTa &&
    !optional.showTbpLbp;
  const hemisphereTable = result.definition.id === "hemisphere_table";
  const homeTable = result.definition.id === "home_table";
  const awayTable = result.definition.id === "away_table";
  const allTimeTable = result.definition.id === "all_time_premiership";
  const liveTable = result.definition.id === "live_table";
  const firstHalfTable = result.definition.id === "first_half";
  const secondHalfTable = result.definition.id === "second_half";
  const finalTwentyTable = result.definition.id === "final_20_minutes";
  const vTopHalfTable = result.definition.id === "v_top_half";
  const vBottomHalfTable = result.definition.id === "v_bottom_half";
  const oppositionHalfTable = vTopHalfTable || vBottomHalfTable;
  const scoringFirstTable = result.definition.id === "scoring_first";
  const concedingFirstTable = result.definition.id === "conceding_first";
  const pointsGainedLosingTable = result.definition.id === "points_gained_losing";
  const pointsLostWinningTable = result.definition.id === "points_lost_winning";
  const comebackTable = result.definition.id === "comeback";
  const leadProtectionTable = result.definition.id === "lead_protection";
  const triesScoredTable = result.definition.id === "tries_scored";
  const triesConcededTable = result.definition.id === "tries_conceded";
  const bothTeamsScoredTriesTable = result.definition.id === "both_teams_scored_tries";
  const winningBonusPointsTable = result.definition.id === "winning_bonus_points";
  const periodTable = firstHalfTable || secondHalfTable || finalTwentyTable;
  const showScoringFirstBettingColumns = scoringFirstTable;
  const showConcedingFirstBettingColumns = concedingFirstTable;
  const showPointsGainedLosingColumns = pointsGainedLosingTable;
  const showPointsLostWinningColumns = pointsLostWinningTable;
  const showComebackColumns = comebackTable;
  const showLeadProtectionColumns = leadProtectionTable;
  const showTriesScoredColumns = triesScoredTable;
  const showTriesConcededColumns = triesConcededTable;
  const showBothTeamsScoredTriesColumns = bothTeamsScoredTriesTable;
  const showWinningBonusPointsColumns = winningBonusPointsTable;
  const showMovementColumn = liveTable && result.showMovement !== false;
  const showLiveColumns = liveTable && result.rows.some((row) => row.liveMatchLabel);
  const extendedLeagueTable =
    result.definition.id === "full_table" ||
    result.definition.id === "form_table" ||
    homeTable ||
    awayTable ||
    allTimeTable ||
    liveTable ||
    firstHalfTable ||
    secondHalfTable ||
    finalTwentyTable ||
    vTopHalfTable ||
    vBottomHalfTable ||
    scoringFirstTable ||
    concedingFirstTable ||
    pointsGainedLosingTable ||
    pointsLostWinningTable ||
    comebackTable ||
    leadProtectionTable ||
    triesScoredTable ||
    triesConcededTable ||
    bothTeamsScoredTriesTable ||
    winningBonusPointsTable ||
    hemisphereTable ||
    optional.showTfTa ||
    optional.showTbpLbp;

  return (
    <div className="cms-card overflow-x-auto">
      <TableLabStandingsBody
        rows={result.rows}
        result={result}
        compactLeagueColumns={compact}
        extendedLeagueColumns={extendedLeagueTable && !pointsGainedLosingTable && !pointsLostWinningTable && !comebackTable && !leadProtectionTable && !triesScoredTable && !triesConcededTable && !bothTeamsScoredTriesTable && !winningBonusPointsTable}
        showPointsGainedLosingColumns={showPointsGainedLosingColumns}
        showPointsLostWinningColumns={showPointsLostWinningColumns}
        showComebackColumns={showComebackColumns}
        showLeadProtectionColumns={showLeadProtectionColumns}
        showTriesScoredColumns={showTriesScoredColumns}
        showTriesConcededColumns={showTriesConcededColumns}
        showBothTeamsScoredTriesColumns={showBothTeamsScoredTriesColumns}
        showWinningBonusPointsColumns={showWinningBonusPointsColumns}
        optionalColumns={optional}
        showFormColumn={result.definition.id === "form_table"}
        showSeasonsColumn={allTimeTable}
        showHemisphereColumn={hemisphereTable && result.hemisphereMode === "breakdown"}
        showWinPctColumn={hemisphereTable || homeTable || awayTable || allTimeTable || oppositionHalfTable || scoringFirstTable || concedingFirstTable}
        playedColumnLabel={scoringFirstTable ? "MSF" : concedingFirstTable ? "MCF" : "P"}
        showScoringFirstBettingColumns={showScoringFirstBettingColumns}
        showConcedingFirstBettingColumns={showConcedingFirstBettingColumns}
        winPctLabel={homeTable ? "Home Win %" : awayTable ? "Away Win %" : "Win%"}
        showMovementColumn={showMovementColumn}
        showLiveColumns={showLiveColumns}
        rankColumnLabel={liveTable ? "Live" : "#"}
        pointsForLabel={
          firstHalfTable ? "FH PF" : secondHalfTable ? "SH PF" : finalTwentyTable ? "F20 PF" : "PF"
        }
        pointsAgainstLabel={
          firstHalfTable ? "FH PA" : secondHalfTable ? "SH PA" : finalTwentyTable ? "F20 PA" : "PA"
        }
        pointsDiffLabel={
          firstHalfTable ? "FH PD" : secondHalfTable ? "SH PD" : finalTwentyTable ? "F20 PD" : "PD"
        }
        leaguePointsLabel={periodTable ? "Table Pts" : "Pts"}
      />
    </div>
  );
}

function extendedLeagueCsvHeaders(options: {
  includeForm?: boolean;
  includeSeasons?: boolean;
  includeHemisphere?: boolean;
  includeWinPct?: boolean;
  winPctLabel?: string;
  showTfTa?: boolean;
  showTbp?: boolean;
  showLbp?: boolean;
}) {
  const headers = [
    { key: "rank", label: "Position" },
    { key: "teamName", label: options.includeHemisphere ? "Team" : "Team / Hemisphere" },
  ];
  if (options.includeHemisphere) {
    headers.push({ key: "hemisphere", label: "Hemisphere" });
  }
  if (options.includeForm) {
    headers.push({ key: "form", label: "Form" });
  }
  if (options.includeSeasons) {
    headers.push({ key: "seasonsPlayed", label: "Seasons" });
  }
  headers.push(
    { key: "played", label: "Played" },
    { key: "won", label: "Won" },
    { key: "drawn", label: "Drawn" },
    { key: "lost", label: "Lost" },
    { key: "pointsFor", label: "Points For" },
    { key: "pointsAgainst", label: "Points Against" },
    { key: "pointsDiff", label: "Points Difference" },
  );
  if (options.showTfTa) {
    headers.push(
      { key: "triesFor", label: "Tries For" },
      { key: "triesAgainst", label: "Tries Against" },
    );
  }
  if (options.showTbp) {
    headers.push({ key: "tryBonusPoints", label: "Try Bonus Points" });
  }
  if (options.showLbp) {
    headers.push({ key: "losingBonusPoints", label: "Losing Bonus Points" });
  }
  headers.push(
    { key: "bonusPoints", label: "Bonus Points" },
    { key: "leaguePoints", label: "League Points" },
  );
  if (options.includeWinPct) {
    headers.push({ key: "winPct", label: options.winPctLabel ?? "Win %" });
  }
  return headers;
}

function extendedLeagueCsvRow(
  row: RugbyTableResult["rows"][number],
  options: {
    includeForm?: boolean;
    includeSeasons?: boolean;
    includeHemisphere?: boolean;
    includeWinPct?: boolean;
    showTfTa?: boolean;
    showTbp?: boolean;
    showLbp?: boolean;
  },
) {
  const base: Record<string, string | number | null | undefined> = {
    rank: row.rank,
    teamName: row.teamName,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    pointsDiff: row.pointsDiff,
  };
  if (options.includeSeasons) {
    base.seasonsPlayed = row.seasonsPlayed ?? "";
  }
  if (options.showTfTa) {
    base.triesFor = row.triesFor ?? "";
    base.triesAgainst = row.triesAgainst ?? "";
  }
  if (options.showTbp) {
    base.tryBonusPoints = row.tryBonusPoints ?? "";
  }
  if (options.showLbp) {
    base.losingBonusPoints = row.losingBonusPoints ?? "";
  }
  base.bonusPoints = row.bonusPoints;
  base.leaguePoints = row.leaguePoints;
  if (options.includeHemisphere) {
    base.hemisphere = row.hemisphere ? hemisphereLabel(row.hemisphere) : "Unknown";
  }
  if (options.includeForm) {
    base.form = row.formSequence?.join("") ?? "";
  }
  if (options.includeWinPct) {
    base.winPct = row.winPct ?? "";
  }
  return base;
}

function displayMetric(value: number | null | undefined) {
  return value == null ? "—" : value;
}

function formResultBadgeClass(result: FormResult, isMostRecent: boolean): string {
  const base =
    "inline-flex min-w-[1.35rem] items-center justify-center rounded-sm px-1 py-0.5 text-[10px] font-bold leading-none shadow-sm";
  const recent = isMostRecent ? " ring-1 ring-white/50" : " opacity-90";
  if (result === "W") return `${base} bg-emerald-600 text-white${recent}`;
  if (result === "L") return `${base} bg-rose-600 text-white${recent}`;
  return `${base} bg-amber-400 text-zinc-900${recent}`;
}

function FormSequenceBadges({ sequence }: { sequence: FormResult[] }) {
  if (!sequence.length) return <span className="text-zinc-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs" aria-label={`Form ${sequence.join(" ")}`}>
      {sequence.map((result, index) => (
        <span
          key={`${index}-${result}`}
          className={formResultBadgeClass(result, index === 0)}
          title={index === 0 ? `Most recent: ${result}` : result}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

function playedCellLabel(row: RugbyTableResult["rows"][number]) {
  const short =
    row.matchesUsed != null &&
    row.matchesRequested != null &&
    row.matchesUsed < row.matchesRequested;
  return {
    short,
    title: short ? `Based on ${row.matchesUsed} of ${row.matchesRequested} requested matches` : undefined,
  };
}

function OptionalTryHeaders({
  showTfTa,
  showTbp,
  showLbp,
}: {
  showTfTa: boolean;
  showTbp: boolean;
  showLbp: boolean;
}) {
  return (
    <>
      {showTfTa ? (
        <>
          <th className="py-2 pr-2 text-center">TF</th>
          <th className="py-2 pr-2 text-center">TA</th>
        </>
      ) : null}
      {showTbp ? <th className="py-2 pr-2 text-center">TBP</th> : null}
      {showLbp ? <th className="py-2 pr-2 text-center">LBP</th> : null}
    </>
  );
}

function OptionalTryCells({
  row,
  showTfTa,
  showTbp,
  showLbp,
}: {
  row: RugbyTableResult["rows"][number];
  showTfTa: boolean;
  showTbp: boolean;
  showLbp: boolean;
}) {
  return (
    <>
      {showTfTa ? (
        <>
          <td className="py-2 pr-2 text-center font-mono">{displayMetric(row.triesFor)}</td>
          <td className="py-2 pr-2 text-center font-mono">{displayMetric(row.triesAgainst)}</td>
        </>
      ) : null}
      {showTbp ? (
        <td className="py-2 pr-2 text-center font-mono">{displayMetric(row.tryBonusPoints)}</td>
      ) : null}
      {showLbp ? (
        <td className="py-2 pr-2 text-center font-mono">{displayMetric(row.losingBonusPoints)}</td>
      ) : null}
    </>
  );
}

function TableLabStandingsBody({
  rows,
  result,
  compactLeagueColumns,
  extendedLeagueColumns,
  optionalColumns,
  showFormColumn,
  showSeasonsColumn,
  showHemisphereColumn,
  showWinPctColumn,
  winPctLabel = "Win%",
  showMovementColumn,
  showLiveColumns,
  rankColumnLabel = "#",
  pointsForLabel = "PF",
  pointsAgainstLabel = "PA",
  pointsDiffLabel = "PD",
  leaguePointsLabel = "Pts",
  playedColumnLabel = "P",
  showScoringFirstBettingColumns = false,
  showConcedingFirstBettingColumns = false,
  showPointsGainedLosingColumns = false,
  showPointsLostWinningColumns = false,
  showComebackColumns = false,
  showLeadProtectionColumns = false,
  showTriesScoredColumns = false,
  showTriesConcededColumns = false,
  showBothTeamsScoredTriesColumns = false,
  showWinningBonusPointsColumns = false,
}: {
  rows: RugbyTableResult["rows"];
  result: RugbyTableResult;
  compactLeagueColumns?: boolean;
  extendedLeagueColumns?: boolean;
  optionalColumns?: ReturnType<typeof leagueTableOptionalColumns>;
  showFormColumn?: boolean;
  showSeasonsColumn?: boolean;
  showHemisphereColumn?: boolean;
  showWinPctColumn?: boolean;
  winPctLabel?: string;
  showMovementColumn?: boolean;
  showLiveColumns?: boolean;
  rankColumnLabel?: string;
  pointsForLabel?: string;
  pointsAgainstLabel?: string;
  pointsDiffLabel?: string;
  leaguePointsLabel?: string;
  playedColumnLabel?: string;
  showScoringFirstBettingColumns?: boolean;
  showConcedingFirstBettingColumns?: boolean;
  showPointsGainedLosingColumns?: boolean;
  showPointsLostWinningColumns?: boolean;
  showComebackColumns?: boolean;
  showLeadProtectionColumns?: boolean;
  showTriesScoredColumns?: boolean;
  showTriesConcededColumns?: boolean;
  showBothTeamsScoredTriesColumns?: boolean;
  showWinningBonusPointsColumns?: boolean;
}) {
  const optional = optionalColumns ?? leagueTableOptionalColumns(rows);
  const showTfTa = optional.showTfTa;
  const showTbp = optional.showTbp;
  const showLbp = optional.showLbp;
  const showLeagueColumns =
    !showPointsGainedLosingColumns &&
    !showPointsLostWinningColumns &&
    !showComebackColumns &&
    !showLeadProtectionColumns &&
    !showTriesScoredColumns &&
    !showTriesConcededColumns &&
    !showBothTeamsScoredTriesColumns &&
    !showWinningBonusPointsColumns &&
    (result.definition.category === "standard" || !result.definition.metricLabel);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
          <th className="py-2 pr-2 w-8">{rankColumnLabel}</th>
          {showMovementColumn ? <th className="py-2 pr-3">Movement</th> : null}
          <th className="py-2 pr-3">Team</th>
          {showHemisphereColumn ? <th className="py-2 pr-3">Hemisphere</th> : null}
          {showFormColumn ? <th className="py-2 pr-3">Form</th> : null}
          {showSeasonsColumn ? <th className="py-2 pr-2 text-center">Ssn</th> : null}
          {showPointsLostWinningColumns ? (
            <>
              <th className="py-2 pr-2 text-center">ML</th>
              <th className="py-2 pr-2 text-center">W</th>
              <th className="py-2 pr-2 text-center">D</th>
              <th className="py-2 pr-2 text-center">L</th>
              <th className="py-2 pr-2 text-center">Pts lost</th>
              <th className="py-2 pr-2 text-center">Avg</th>
              <th className="py-2 pr-2 text-center">Lead prot %</th>
              <th className="py-2 pr-2 text-center">Won aft %</th>
              <th className="py-2 pr-2 text-center">LBP rec</th>
              <th className="py-2 pr-2 text-center">Avg 1st min</th>
              <th className="py-2 pr-2 text-center">Avg lost min</th>
              <th className="py-2 pr-2 text-center">Latest lost</th>
              <th className="py-2 pr-2 text-center">Largest lead</th>
            </>
          ) : null}
          {showLeadProtectionColumns ? (
            <>
              <th className="py-2 pr-2 text-center">ML</th>
              <th className="py-2 pr-2 text-center">W</th>
              <th className="py-2 pr-2 text-center">D</th>
              <th className="py-2 pr-2 text-center">L</th>
              <th className="py-2 pr-2 text-center">Lead prot %</th>
              <th className="py-2 pr-2 text-center">Pts lost</th>
              <th className="py-2 pr-2 text-center">Avg lead</th>
              <th className="py-2 pr-2 text-center">Largest lost</th>
              <th className="py-2 pr-2 text-center">Table Pts</th>
              <th className="py-2 pr-2 text-center">HT prot</th>
              <th className="py-2 pr-2 text-center">60m prot</th>
              <th className="py-2 pr-2 text-center">F20 prot</th>
              <th className="py-2 pr-2 text-center">Avg 1st min</th>
              <th className="py-2 pr-2 text-center">Avg lost min</th>
            </>
          ) : null}
          {showTriesScoredColumns ? (
            <>
              <th className="py-2 pr-2 text-center">P</th>
              <th className="py-2 pr-2 text-center">Tries</th>
              <th className="py-2 pr-2 text-center">Avg</th>
              <th className="py-2 pr-2 text-center">1+</th>
              <th className="py-2 pr-2 text-center">Rate %</th>
              <th className="py-2 pr-2 text-center">2+</th>
              <th className="py-2 pr-2 text-center">3+</th>
              <th className="py-2 pr-2 text-center">4+</th>
              <th className="py-2 pr-2 text-center">5+</th>
              <th className="py-2 pr-2 text-center">FH</th>
              <th className="py-2 pr-2 text-center">SH</th>
              <th className="py-2 pr-2 text-center">F20</th>
              <th className="py-2 pr-2 text-center">TBP</th>
            </>
          ) : null}
          {showTriesConcededColumns ? (
            <>
              <th className="py-2 pr-2 text-center">P</th>
              <th className="py-2 pr-2 text-center">Conc</th>
              <th className="py-2 pr-2 text-center">Avg</th>
              <th className="py-2 pr-2 text-center">1+</th>
              <th className="py-2 pr-2 text-center">Rate %</th>
              <th className="py-2 pr-2 text-center">2+</th>
              <th className="py-2 pr-2 text-center">3+</th>
              <th className="py-2 pr-2 text-center">4+</th>
              <th className="py-2 pr-2 text-center">5+</th>
              <th className="py-2 pr-2 text-center">FH</th>
              <th className="py-2 pr-2 text-center">SH</th>
              <th className="py-2 pr-2 text-center">F20</th>
            </>
          ) : null}
          {showBothTeamsScoredTriesColumns ? (
            <>
              <th className="py-2 pr-2 text-center">P</th>
              <th className="py-2 pr-2 text-center">Yes</th>
              <th className="py-2 pr-2 text-center">No</th>
              <th className="py-2 pr-2 text-center">Yes %</th>
              <th className="py-2 pr-2 text-center">No %</th>
              <th className="py-2 pr-2 text-center">2+</th>
              <th className="py-2 pr-2 text-center">2+ %</th>
              <th className="py-2 pr-2 text-center">3+</th>
              <th className="py-2 pr-2 text-center">3+ %</th>
              <th className="py-2 pr-2 text-center">4+</th>
              <th className="py-2 pr-2 text-center">4+ %</th>
            </>
          ) : null}
          {showWinningBonusPointsColumns ? (
            <>
              <th className="py-2 pr-2 text-center">P</th>
              <th className="py-2 pr-2 text-center">W</th>
              <th className="py-2 pr-2 text-center">TBP</th>
              <th className="py-2 pr-2 text-center">LBP</th>
              <th className="py-2 pr-2 text-center">Total BP</th>
              <th className="py-2 pr-2 text-center">BP mts</th>
              <th className="py-2 pr-2 text-center">BP %</th>
              <th className="py-2 pr-2 text-center">Max W</th>
              <th className="py-2 pr-2 text-center">Max %</th>
              <th className="py-2 pr-2 text-center">TBP/m</th>
              <th className="py-2 pr-2 text-center">BP/m</th>
              <th className="py-2 pr-2 text-center">Home</th>
              <th className="py-2 pr-2 text-center">Away</th>
              <th className="py-2 pr-2 text-center">Streak</th>
              <th className="py-2 pr-2 text-center">Best</th>
            </>
          ) : null}
          {showComebackColumns ? (
            <>
              <th className="py-2 pr-2 text-center">MB</th>
              <th className="py-2 pr-2 text-center">CB W</th>
              <th className="py-2 pr-2 text-center">CB D</th>
              <th className="py-2 pr-2 text-center">Total CB</th>
              <th className="py-2 pr-2 text-center">CB %</th>
              <th className="py-2 pr-2 text-center">Largest</th>
              <th className="py-2 pr-2 text-center">Avg def</th>
              <th className="py-2 pr-2 text-center">Table Pts</th>
              <th className="py-2 pr-2 text-center">7+</th>
              <th className="py-2 pr-2 text-center">10+</th>
              <th className="py-2 pr-2 text-center">14+</th>
              <th className="py-2 pr-2 text-center">2H CB</th>
              <th className="py-2 pr-2 text-center">F20 CB</th>
              <th className="py-2 pr-2 text-center">Win min</th>
            </>
          ) : null}
          {showPointsGainedLosingColumns ? (
            <>
              <th className="py-2 pr-2 text-center">MB</th>
              <th className="py-2 pr-2 text-center">CB W</th>
              <th className="py-2 pr-2 text-center">CB D</th>
              <th className="py-2 pr-2 text-center">CB L+BP</th>
              <th className="py-2 pr-2 text-center">Pts gained</th>
              <th className="py-2 pr-2 text-center">Avg</th>
              <th className="py-2 pr-2 text-center">CB %</th>
              <th className="py-2 pr-2 text-center">Best CB</th>
              <th className="py-2 pr-2 text-center">TBP</th>
              <th className="py-2 pr-2 text-center">LBP</th>
              <th className="py-2 pr-2 text-center">Avg 1st min</th>
            </>
          ) : null}
          {showLeagueColumns ? (
            extendedLeagueColumns ? (
              <>
                <th className="py-2 pr-2 text-center">{playedColumnLabel}</th>
                <th className="py-2 pr-2 text-center">W</th>
                <th className="py-2 pr-2 text-center">D</th>
                <th className="py-2 pr-2 text-center">L</th>
                <th className="py-2 pr-2 text-center">{pointsForLabel}</th>
                <th className="py-2 pr-2 text-center">{pointsAgainstLabel}</th>
                <th className="py-2 pr-2 text-center">{pointsDiffLabel}</th>
                <OptionalTryHeaders showTfTa={showTfTa} showTbp={showTbp} showLbp={showLbp} />
                <th className="py-2 pr-2 text-center">BP</th>
                <th className="py-2 pr-2 text-center">{leaguePointsLabel}</th>
                {showWinPctColumn ? (
                  <th className="py-2 pr-2 text-center">{winPctLabel}</th>
                ) : null}
                {showConcedingFirstBettingColumns ? (
                  <>
                    <th className="py-2 pr-2 text-center">Comeback W</th>
                    <th className="py-2 pr-2 text-center">Comeback %</th>
                    <th className="py-2 pr-2 text-center">Pts gained</th>
                    <th className="py-2 pr-2 text-center">Avg 1st min</th>
                    <th className="py-2 pr-2 text-center">MCF %</th>
                  </>
                ) : null}
                {showScoringFirstBettingColumns ? (
                  <>
                    <th className="py-2 pr-2 text-center">Avg 1st min</th>
                    <th className="py-2 pr-2 text-center">Lead→Win %</th>
                    <th className="py-2 pr-2 text-center">MSF %</th>
                    <th className="py-2 pr-2 text-center">Avg win mg</th>
                  </>
                ) : null}
                {showLiveColumns ? (
                  <>
                    <th className="py-2 pr-3">Live match</th>
                    <th className="py-2 pr-2 text-center">Score</th>
                    <th className="py-2 pr-2 text-center">Clock</th>
                    <th className="py-2 pr-2 text-center">Status</th>
                  </>
                ) : null}
              </>
            ) : compactLeagueColumns ? (
              <>
                <th className="py-2 pr-2 text-center">{playedColumnLabel}</th>
                <th className="py-2 pr-2 text-center">W</th>
                <th className="py-2 pr-2 text-center">L</th>
                <th className="py-2 pr-2 text-center">Pts</th>
              </>
            ) : (
              <>
                <th className="py-2 pr-2 text-center">{playedColumnLabel}</th>
                <th className="py-2 pr-2 text-center">W</th>
                <th className="py-2 pr-2 text-center">D</th>
                <th className="py-2 pr-2 text-center">L</th>
                <th className="py-2 pr-2 text-center">{pointsForLabel}</th>
                <th className="py-2 pr-2 text-center">{pointsAgainstLabel}</th>
                <th className="py-2 pr-2 text-center">{pointsDiffLabel}</th>
                <OptionalTryHeaders showTfTa={showTfTa} showTbp={showTbp} showLbp={showLbp} />
                <th className="py-2 pr-2 text-center">BP</th>
                <th className="py-2 pr-2 text-center">{leaguePointsLabel}</th>
              </>
            )
          ) : (
            <>
              <th className="py-2 pr-2 text-center">P</th>
              <th className="py-2 pr-2 text-center">{result.definition.metricLabel ?? "Metric"}</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.teamId}-${row.rank}`} className="border-b border-zinc-800/60">
            <td className="py-2 pr-2 font-mono text-zinc-500">{row.rank}</td>
            {showMovementColumn ? (
              <td className="py-2 pr-3 text-zinc-400 text-xs whitespace-nowrap">
                {row.movementLabel ?? "—"}
              </td>
            ) : null}
            <td className="py-2 pr-3 font-medium text-zinc-100">{row.teamName}</td>
            {showHemisphereColumn ? (
              <td className="py-2 pr-3 text-zinc-400">
                {row.hemisphere ? hemisphereLabel(row.hemisphere) : "Unknown"}
              </td>
            ) : null}
            {showFormColumn ? (
              <td className="py-2 pr-3">
                <FormSequenceBadges sequence={row.formSequence ?? []} />
              </td>
            ) : null}
            {showSeasonsColumn ? (
              <td className="py-2 pr-2 text-center font-mono">{row.seasonsPlayed ?? "—"}</td>
            ) : null}
            {showPointsLostWinningColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.lost}</td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.pointsLost ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgPointsLostPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.leadProtectionPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.wonAfterLeadingPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.losingBonusRecovered ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgMinuteFirstAhead ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgMinuteLeadLost ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.latestLeadLost ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.largestLeadLost ?? "—"}
                </td>
              </>
            ) : null}
            {showLeadProtectionColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.lost}</td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.leadProtectionPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.pointsLost ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.averageLargestLead ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.largestLeadLost ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.tablePointsEarned ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.halfTimeLeadsProtected ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.sixtyMinuteLeadsProtected ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.finalTwentyLeadsProtected ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgMinuteFirstAhead ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgMinuteLeadLost ?? "—"}
                </td>
              </>
            ) : null}
            {showTriesScoredColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.triesScored ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.triesPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesWithTry ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryScoringRatePct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesWith2Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesWith3Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesWith4Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesWith5Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.firstHalfTries ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.secondHalfTries ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.finalTwentyTries ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryBonusPointsTotal ?? "—"}
                </td>
              </>
            ) : null}
            {showTriesConcededColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.triesConceded ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.triesConcededPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesConcedingTry ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryConcedingRatePct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesConceding2Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesConceding3Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesConceding4Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.matchesConceding5Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.firstHalfTriesConceded ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.secondHalfTriesConceded ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.finalTwentyTriesConceded ?? "—"}
                </td>
              </>
            ) : null}
            {showBothTeamsScoredTriesColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.bothTeamsScoredYes ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeamsScoredNo ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeamsScoredYesPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeamsScoredNoPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams2Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams2PlusPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams3Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams3PlusPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams4Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bothTeams4PlusPct ?? "—"}
                </td>
              </>
            ) : null}
            {showWinningBonusPointsColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryBonusPointsTotal ?? row.tryBonusPoints ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.losingBonusPointsTotal ?? row.losingBonusPoints ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.totalBonusPoints ?? row.bonusPoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bonusPointMatches ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bonusPointRatePct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.maximumPointWins ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.maximumPointWinPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryBonusPointsPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bonusPointsPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.homeBonusPoints ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.awayBonusPoints ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.currentBonusStreak ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.longestBonusStreak ?? "—"}
                </td>
              </>
            ) : null}
            {showComebackColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.totalSuccessfulComebacks ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebackSuccessPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.largestDeficitOvercome ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.averageDeficitOvercome ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.tablePointsGained ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebacksFrom7Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebacksFrom10Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebacksFrom14Plus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.secondHalfComebacks ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.finalTwentyComebacks ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.latestWinningScoreMinute ?? "—"}
                </td>
              </>
            ) : null}
            {showPointsGainedLosingColumns ? (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebackLossesWithBonus ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.extra?.pointsGained ?? row.leaguePoints}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgPointsGainedPerMatch ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.comebackWinPct ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.bestComebackMargin ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.tryBonusPointsGained ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.losingBonusPointsGained ?? "—"}
                </td>
                <td className="py-2 pr-2 text-center font-mono">
                  {row.extra?.avgMinuteFirstBehind ?? "—"}
                </td>
              </>
            ) : null}
            {showLeagueColumns ? (
              extendedLeagueColumns ? (
                <>
                  <td
                    className="py-2 pr-2 text-center font-mono"
                    title={playedCellLabel(row).title}
                  >
                    {row.played}
                    {playedCellLabel(row).short ? (
                      <span className="text-amber-400 text-xs align-super">*</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.lost}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.pointsFor}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.pointsAgainst}</td>
                  <td className="py-2 pr-2 text-center font-mono">
                    {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                  </td>
                  <OptionalTryCells row={row} showTfTa={showTfTa} showTbp={showTbp} showLbp={showLbp} />
                  <td className="py-2 pr-2 text-center font-mono">{row.bonusPoints}</td>
                  <td className="py-2 pr-2 text-center font-mono font-semibold">{row.leaguePoints}</td>
                  {showWinPctColumn ? (
                    <td className="py-2 pr-2 text-center font-mono">{row.winPct ?? "—"}</td>
                  ) : null}
                  {showConcedingFirstBettingColumns ? (
                    <>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.comebackWins ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.comebackWinPct ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.pointsGainedAfterConcedingFirst ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.avgFirstConcededMinute ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.matchesConcedingFirstPct ?? "—"}
                      </td>
                    </>
                  ) : null}
                  {showScoringFirstBettingColumns ? (
                    <>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.avgFirstScoreMinute ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.leadConvertedWinPct ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.matchesScoringFirstPct ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-center font-mono">
                        {row.extra?.avgWinningMargin ?? "—"}
                      </td>
                    </>
                  ) : null}
                  {showLiveColumns ? (
                    <>
                      <td className="py-2 pr-3 text-zinc-400 text-xs">{row.liveMatchLabel ?? "—"}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.liveCurrentScore ?? "—"}</td>
                      <td className="py-2 pr-2 text-center font-mono">{row.liveMatchClock ?? "—"}</td>
                      <td className="py-2 pr-2 text-center text-xs capitalize">
                        {row.liveStatus?.replaceAll("_", " ") ?? "—"}
                      </td>
                    </>
                  ) : null}
                </>
              ) : compactLeagueColumns ? (
                <>
                  <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.lost}</td>
                  <td className="py-2 pr-2 text-center font-mono font-semibold">{row.leaguePoints}</td>
                </>
              ) : (
                <>
                  <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.won}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.drawn}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.lost}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.pointsFor}</td>
                  <td className="py-2 pr-2 text-center font-mono">{row.pointsAgainst}</td>
                  <td className="py-2 pr-2 text-center font-mono">
                    {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                  </td>
                  <OptionalTryCells row={row} showTfTa={showTfTa} showTbp={showTbp} showLbp={showLbp} />
                  <td className="py-2 pr-2 text-center font-mono">{row.bonusPoints}</td>
                  <td className="py-2 pr-2 text-center font-mono font-semibold">{row.leaguePoints}</td>
                </>
              )
            ) : (
              <>
                <td className="py-2 pr-2 text-center font-mono">{row.played}</td>
                <td className="py-2 pr-2 text-center font-mono font-semibold">
                  {row.metricValue ?? "—"}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
