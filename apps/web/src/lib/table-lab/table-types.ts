export type RugbyTableCategory =
  | "standard"
  | "match_period"
  | "opposition"
  | "game_state"
  | "rugby_scoring"
  | "set_piece"
  | "attack"
  | "defence"
  | "possession_territory"
  | "discipline";

export type RugbyTableDataSource =
  | "fixtures"
  | "match_scores"
  | "half_time_scores"
  | "sixty_minute_scores"
  | "match_events"
  | "team_match_stats"
  | "competition_scoring_rules"
  | "standing_rows";

export type RugbyTableConfidence = "high" | "medium" | "low" | "unavailable";

export type RugbyTableDefinition = {
  id: string;
  slug: string;
  label: string;
  category: RugbyTableCategory;
  explanation: string;
  calculationMethod: string;
  requiredData: RugbyTableDataSource[];
  /** Level 1 — fixtures and final scores (always required to show a useful table). */
  minimumData: RugbyTableDataSource[];
  /** Level 2 — rugby scoring (tries, bonus points, competition rules). */
  enhancedData: RugbyTableDataSource[];
  /** Level 3 — detailed match statistics and events. */
  advancedData: RugbyTableDataSource[];
  /** Column shown as the primary metric for non-standard tables */
  metricLabel?: string;
  /** When true, omit from Table Lab menu listings until implemented. */
  hiddenFromMenu?: boolean;
};

export type FormResult = "W" | "D" | "L";

export type RugbyHemisphere = "northern" | "southern" | "unknown";

export type RugbyTableStandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  triesFor?: number | null;
  triesAgainst?: number | null;
  tryBonusPoints?: number | null;
  losingBonusPoints?: number | null;
  bonusPoints: number;
  leaguePoints: number;
  /** Most recent first (W/D/L) for form tables */
  formSequence?: FormResult[];
  matchesRequested?: number;
  matchesUsed?: number;
  winPct?: number;
  seasonsPlayed?: number;
  hemisphere?: RugbyHemisphere;
  metricValue?: number | string | null;
  extra?: Record<string, number | string | null>;
  previousRank?: number | null;
  movement?: "up" | "down" | "same" | null;
  movementLabel?: string | null;
  liveMatchLabel?: string | null;
  liveCurrentScore?: string | null;
  liveMatchClock?: string | null;
  liveStatus?: string | null;
};

export type RugbyTableView = "all" | "home" | "away" | "neutral";

export type HemisphereTableMode = "summary" | "breakdown";

export type HemisphereMatchType = "all" | "club" | "international";

export type RugbyTableHemisphereGroup = {
  hemisphere: "northern" | "southern";
  label: string;
  rows: RugbyTableStandingRow[];
};

export type RugbyTablePoolGroup = {
  id: string;
  label: string;
  rows: RugbyTableStandingRow[];
  /** Pool-stage form length (3 for 4-team pools, 4 for 5-team pools). */
  formSlots: number;
};

export type AllTimeSeasonRangeMode = "all" | "from" | "to" | "custom";

export type AllTimeTeamStatus = "all" | "current" | "former";

export type AllTimePremiershipSortBy =
  | "league_points"
  | "seasons"
  | "played"
  | "won"
  | "win_pct"
  | "points_for"
  | "tries_for"
  | "team_name";

export type AllTimePremiershipCoverage = {
  resultsCoveragePct: number;
  triesCoveragePct: number;
  bonusCoveragePct: number;
};

export type OppositionPositionRule =
  | "current_position"
  | "position_at_match"
  | "final_season_position";

export type RugbyTableBuildContext = {
  seasonId?: string;
  competitionId?: string;
  tableView?: RugbyTableView;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  calendarYear?: number;
  customPeriodStartMinute?: number;
  customPeriodEndMinute?: number;
  formMatchCount?: number;
  minMatchesPlayed?: number;
  includeNeutralVenueForAwayTable?: boolean;
  allTimeSeasonRangeMode?: AllTimeSeasonRangeMode;
  allTimeSeasonFromYear?: number;
  allTimeSeasonToYear?: number;
  allTimeTeamStatus?: AllTimeTeamStatus;
  allTimeSortBy?: AllTimePremiershipSortBy;
  hemisphereMode?: HemisphereTableMode;
  hemisphereMatchType?: HemisphereMatchType;
  includeUnknownHemisphere?: boolean;
  includeLiveMatches?: boolean;
  includeScheduledMatches?: boolean;
  showMovement?: boolean;
  includeExtraTime?: boolean;
  oppositionPositionRule?: OppositionPositionRule;
  firstScoreType?: import("./first-score-utils").FirstScoreTypeFilter;
  scoringFirstSortBy?: import("./scoring-first-table-service").ScoringFirstSortBy;
  concedingFirstSortBy?: import("./conceding-first-table-service").ConcedingFirstSortBy;
  losingPositionFilter?: import("./points-gained-losing-table-service").LosingPositionFilter;
  pointsGainedLosingSortBy?: import("./points-gained-losing-table-service").PointsGainedLosingSortBy;
  winningPositionFilter?: import("./points-lost-winning-table-service").WinningPositionFilter;
  pointsLostWinningSortBy?: import("./points-lost-winning-table-service").PointsLostWinningSortBy;
  comebackFromFilter?: import("./comeback-table-service").ComebackFromFilter;
  minimumDeficitPreset?: import("./comeback-table-service").MinimumDeficitPreset;
  minimumDeficitPoints?: number;
  comebackSortBy?: import("./comeback-table-service").ComebackSortBy;
  leadPositionFilter?: import("./lead-protection-table-service").LeadPositionFilter;
  minimumLeadPreset?: import("./lead-protection-table-service").MinimumLeadPreset;
  minimumLeadPoints?: number;
  leadProtectionSortBy?: import("./lead-protection-table-service").LeadProtectionSortBy;
  triesScoredPeriod?: import("./tries-scored-table-service").TriesScoredPeriod;
  triesMatchRangePreset?: import("./tries-scored-table-service").TriesMatchRangePreset;
  triesMatchRangeCustom?: number;
  /** Resolved match-range count after parsing preset/custom filters. */
  triesMatchRangeCount?: number | null;
  triesScoredSortBy?: import("./tries-scored-table-service").TriesScoredSortBy;
  triesConcededSortBy?: import("./tries-conceded-table-service").TriesConcededSortBy;
  bothTeamsScoredTriesSortBy?: import("./both-teams-scored-tries-table-service").BothTeamsScoredTriesSortBy;
  winningBonusTypeFilter?: import("./winning-bonus-points-table-service").WinningBonusTypeFilter;
  winningBonusPointsSortBy?: import("./winning-bonus-points-table-service").WinningBonusPointsSortBy;
};

export type RugbyTableResult = {
  definition: RugbyTableDefinition;
  available: boolean;
  confidence: RugbyTableConfidence;
  dataCoveragePct: number;
  rows: RugbyTableStandingRow[];
  hemisphereGroups?: RugbyTableHemisphereGroup[];
  poolGroups?: RugbyTablePoolGroup[];
  competition?: { slug: string; name: string };
  warnings: string[];
  fixtureCount: number;
  evaluatedFixtureCount: number;
  context: RugbyTableBuildContext;
  tableView?: RugbyTableView;
  filterSummary?: string;
  dateRangeLabel?: string | null;
  formMatchCount?: number;
  minMatchesPlayed?: number;
  includeNeutralVenueForAwayTable?: boolean;
  allTimeSeasonRangeMode?: AllTimeSeasonRangeMode;
  allTimeSeasonFromYear?: number;
  allTimeSeasonToYear?: number;
  allTimeTeamStatus?: AllTimeTeamStatus;
  allTimeSortBy?: AllTimePremiershipSortBy;
  allTimeCoverage?: AllTimePremiershipCoverage;
  allTimeSeasonsLabel?: string | null;
  allTimeTeamCount?: number;
  allTimeMatchCount?: number;
  allTimeIdentityReviewCount?: number;
  historicScoringNotice?: string | null;
  dataCoverageNote?: string | null;
  dataLevel?: 1 | 2 | 3;
  calendarYear?: number;
  calendarYearCalculationNote?: string | null;
  seasonsIncludedLabel?: string | null;
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
  liveUpdatedAt?: string | null;
  liveMatchCount?: number;
  liveTableCalculationNote?: string | null;
  showMovement?: boolean;
  includeLiveMatches?: boolean;
  hemisphereMode?: HemisphereTableMode;
  firstHalfCalculationNote?: string | null;
  firstHalfCoverageLabel?: string | null;
  firstHalfMatchCount?: number;
  firstHalfCompletedMatchCount?: number;
  firstHalfCoveragePct?: number;
  secondHalfCalculationNote?: string | null;
  secondHalfCoverageLabel?: string | null;
  secondHalfMatchCount?: number;
  secondHalfCompletedMatchCount?: number;
  secondHalfCoveragePct?: number;
  finalTwentyCalculationNote?: string | null;
  finalTwentyCoverageLabel?: string | null;
  finalTwentyMatchCount?: number;
  finalTwentyCompletedMatchCount?: number;
  finalTwentyCoveragePct?: number;
  includeExtraTime?: boolean;
  oppositionPositionRule?: OppositionPositionRule;
  topHalfRankRangeLabel?: string | null;
  topHalfTeamCount?: number;
  topHalfMatchCount?: number;
  topHalfFilterSummary?: string | null;
  bottomHalfRankRangeLabel?: string | null;
  bottomHalfTeamCount?: number;
  bottomHalfMatchCount?: number;
  bottomHalfFilterSummary?: string | null;
  provisionalFinalSeason?: boolean;
  firstScoreType?: import("./first-score-utils").FirstScoreTypeFilter;
  scoringFirstSortBy?: import("./scoring-first-table-service").ScoringFirstSortBy;
  scoringFirstMatchCount?: number;
  scoringFirstCompletedMatchCount?: number;
  scoringFirstCoveragePct?: number;
  scoringFirstFilterSummary?: string | null;
  scoringFirstCalculationNote?: string | null;
  ambiguousFirstScoreFixtureCount?: number;
  concedingFirstSortBy?: import("./conceding-first-table-service").ConcedingFirstSortBy;
  concedingFirstMatchCount?: number;
  concedingFirstCompletedMatchCount?: number;
  concedingFirstCoveragePct?: number;
  concedingFirstFilterSummary?: string | null;
  concedingFirstCalculationNote?: string | null;
  losingPositionFilter?: import("./points-gained-losing-table-service").LosingPositionFilter;
  pointsGainedLosingSortBy?: import("./points-gained-losing-table-service").PointsGainedLosingSortBy;
  pointsGainedLosingMatchCount?: number;
  pointsGainedLosingCompletedMatchCount?: number;
  pointsGainedLosingCoveragePct?: number;
  pointsGainedLosingFilterSummary?: string | null;
  pointsGainedLosingCalculationNote?: string | null;
  winningPositionFilter?: import("./points-lost-winning-table-service").WinningPositionFilter;
  pointsLostWinningSortBy?: import("./points-lost-winning-table-service").PointsLostWinningSortBy;
  pointsLostWinningMatchCount?: number;
  pointsLostWinningCompletedMatchCount?: number;
  pointsLostWinningCoveragePct?: number;
  pointsLostWinningFilterSummary?: string | null;
  pointsLostWinningCalculationNote?: string | null;
  comebackFromFilter?: import("./comeback-table-service").ComebackFromFilter;
  minimumDeficitPreset?: import("./comeback-table-service").MinimumDeficitPreset;
  minimumDeficitPoints?: number;
  comebackSortBy?: import("./comeback-table-service").ComebackSortBy;
  comebackMatchCount?: number;
  comebackCompletedMatchCount?: number;
  comebackCoveragePct?: number;
  comebackFilterSummary?: string | null;
  comebackCalculationNote?: string | null;
  leadPositionFilter?: import("./lead-protection-table-service").LeadPositionFilter;
  minimumLeadPreset?: import("./lead-protection-table-service").MinimumLeadPreset;
  minimumLeadPoints?: number;
  leadProtectionSortBy?: import("./lead-protection-table-service").LeadProtectionSortBy;
  leadProtectionMatchCount?: number;
  leadProtectionCompletedMatchCount?: number;
  leadProtectionCoveragePct?: number;
  leadProtectionFilterSummary?: string | null;
  leadProtectionCalculationNote?: string | null;
  triesScoredPeriod?: import("./tries-scored-table-service").TriesScoredPeriod;
  triesMatchRangePreset?: import("./tries-scored-table-service").TriesMatchRangePreset;
  triesMatchRangeCount?: number | null;
  triesScoredSortBy?: import("./tries-scored-table-service").TriesScoredSortBy;
  triesScoredMatchCount?: number;
  triesScoredCompletedMatchCount?: number;
  triesScoredCoveragePct?: number;
  triesScoredFilterSummary?: string | null;
  triesScoredCalculationNote?: string | null;
  triesConcededPeriod?: import("./tries-conceded-table-service").TriesConcededPeriod;
  triesConcededSortBy?: import("./tries-conceded-table-service").TriesConcededSortBy;
  triesConcededMatchCount?: number;
  triesConcededCompletedMatchCount?: number;
  triesConcededCoveragePct?: number;
  triesConcededFilterSummary?: string | null;
  triesConcededCalculationNote?: string | null;
  bothTeamsScoredTriesSortBy?: import("./both-teams-scored-tries-table-service").BothTeamsScoredTriesSortBy;
  bothTeamsScoredTriesMatchCount?: number;
  bothTeamsScoredTriesCompletedMatchCount?: number;
  bothTeamsScoredTriesCoveragePct?: number;
  bothTeamsScoredTriesFilterSummary?: string | null;
  bothTeamsScoredTriesCalculationNote?: string | null;
  winningBonusTypeFilter?: import("./winning-bonus-points-table-service").WinningBonusTypeFilter;
  winningBonusPointsSortBy?: import("./winning-bonus-points-table-service").WinningBonusPointsSortBy;
  winningBonusPointsMatchCount?: number;
  winningBonusPointsCompletedMatchCount?: number;
  winningBonusPointsCoveragePct?: number;
  winningBonusPointsFilterSummary?: string | null;
  winningBonusPointsCalculationNote?: string | null;
  winningBonusScoringRulesSummary?: string | null;
  winningBonusMaximumTablePoints?: number | null;
  winningBonusNotApplicable?: boolean;
  hemisphereMatchType?: HemisphereMatchType;
  includeUnknownHemisphere?: boolean;
  unknownTeamCount?: number;
  hemisphereRuleNote?: string;
  lastUpdated?: string | null;
  scoringRules?: RugbyScoringRules;
};

export type RugbyScoringRules = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tryBonusThreshold: number;
  tryBonusPoints: number;
  losingBonusMargin: number;
  losingBonusPoints: number;
};

export const DEFAULT_PREMIERSHIP_SCORING_RULES: RugbyScoringRules = {
  winPoints: 4,
  drawPoints: 2,
  lossPoints: 0,
  tryBonusThreshold: 4,
  tryBonusPoints: 1,
  losingBonusMargin: 7,
  losingBonusPoints: 1,
};

import type { TeamType } from "../team-hemisphere-utils";

export type TeamFixturePerspective = {
  fixtureId: string;
  kickoffAt: Date | null;
  /** When SDMS provides a completion timestamp it is preferred for as-of tables. */
  completedAt?: Date | null;
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  side: "home" | "away";
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number | null;
  triesAgainst: number | null;
  firstHalfFor: number | null;
  firstHalfAgainst: number | null;
  firstHalfTriesFor?: number | null;
  firstHalfTriesAgainst?: number | null;
  firstHalfScoreSource?: "verified" | "calculated" | null;
  secondHalfFor: number | null;
  secondHalfAgainst: number | null;
  secondHalfTriesFor?: number | null;
  secondHalfTriesAgainst?: number | null;
  secondHalfScoreSource?: "derived" | "calculated" | null;
  finalTwentyFor: number | null;
  finalTwentyAgainst: number | null;
  finalTwentyTriesFor?: number | null;
  finalTwentyTriesAgainst?: number | null;
  finalTwentyScoreSource?: "events" | "derived" | null;
  scoreAtSixtyFor?: number | null;
  scoreAtSixtyAgainst?: number | null;
  scoredFirst: boolean | null;
  concededFirst: boolean | null;
  firstScoreEventType?: "try" | "penalty_try" | "penalty" | "drop_goal" | null;
  firstScoreMinute?: number | null;
  firstScoreVerified?: boolean | null;
  everTrailing?: boolean | null;
  behindAtHalfTime?: boolean | null;
  behindAfterSixty?: boolean | null;
  scoreTimelineVerified?: boolean | null;
  halfTimeScoreVerified?: boolean | null;
  sixtyMinuteScoreVerified?: boolean | null;
  minuteFirstBehind?: number | null;
  maxDeficitWhileTrailing?: number | null;
  minuteLastTookLead?: number | null;
  everLeading?: boolean | null;
  aheadAtHalfTime?: boolean | null;
  aheadAfterSixty?: boolean | null;
  minuteFirstAhead?: number | null;
  maxLeadMargin?: number | null;
  latestLeadLostMinute?: number | null;
  wasWinning: boolean | null;
  wasLosing: boolean | null;
  wasDrawn: boolean | null;
  possessionPct: number | null;
  territoryPct: number | null;
  lineoutsWon: number | null;
  lineoutsLost: number | null;
  scrumSuccessPct: number | null;
  scrumPenaltiesWon: number | null;
  scrumPenaltiesConceded: number | null;
  carries: number | null;
  metres: number | null;
  lineBreaks: number | null;
  defendersBeaten: number | null;
  postContactMetres: number | null;
  tryAssists: number | null;
  turnoversWon: number | null;
  tacklesMade: number | null;
  tacklesCompleted: number | null;
  dominantTackles: number | null;
  missedTackles: number | null;
  penaltiesConceded: number | null;
  yellowCards: number | null;
  redCards: number | null;
  opponentLeagueRank: number | null;
  teamHemisphere?: RugbyHemisphere;
  opponentHemisphere?: RugbyHemisphere;
  teamType?: TeamType | null;
  isNeutralVenue?: boolean;
  seasonStartYear?: number | null;
  teamSlug?: string | null;
  isLive?: boolean;
  isScheduled?: boolean;
  countsTowardStandings?: boolean;
  matchClockLabel?: string | null;
  fixtureStatus?: string | null;
  /** Fixture competition stage (regular / quarter_final / …). */
  stage?: string | null;
  round?: string | null;
};
