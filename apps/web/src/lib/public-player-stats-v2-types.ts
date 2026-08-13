/**
 * Player Stats V2 DTO — factual source of truth for /players/[slug]/stats.
 * Unknown is null (UI shows "—"). Verified zero is 0. Never coerce missing → 0.
 */

export const PLAYER_STATS_RANK_MIN_MINUTES = 300;
export const PLAYER_STATS_RANK_MIN_APPEARANCES = 5;
export const PLAYER_STATS_PER80_MIN_MINUTES = 80;

export type PlayerStatsPeriod = "season" | "career";
export type PlayerStatsScope = "all" | "club" | "international";
export type PlayerStatsSection =
  | "summary"
  | "attack"
  | "kicking"
  | "defence"
  | "breakdown"
  | "discipline"
  | "game-log";

export type PlayerStatsFilters = {
  /** Rugby-season slug such as 2025-26. Omit to use the current active season from data. */
  season?: string | null;
  competitionId?: string | null;
  teamId?: string | null;
  scope?: PlayerStatsScope | null;
  position?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  period?: PlayerStatsPeriod | null;
};

/** A numeric fact: null = unknown, 0 = verified zero. */
export type StatValue = {
  value: number | null;
  /** Matches that contributed a known value (not unknown). */
  sample: number;
  quality: "known" | "unknown" | "insufficient";
};

export type KpiKey =
  | "matches"
  | "points"
  | "tries"
  | "conversions"
  | "penalties"
  | "dropGoals"
  | "tackleBreaks"
  | "assists"
  | "metresRun"
  | "cleanBreaks"
  | "defendersBeaten"
  | "turnoversWon";

export type SummaryStatKey =
  | "matches"
  | "points"
  | "tries"
  | "conversions"
  | "penalties"
  | "dropGoals"
  | "tackleBreaks"
  | "cleanBreaks"
  | "metresRun"
  | "defendersBeaten"
  | "offloads"
  | "turnoversWon"
  | "passes"
  | "passSuccessPct"
  | "tackles"
  | "tackleSuccessPct"
  | "yellowCards"
  | "redCards";

export type PlayerStatsKpi = {
  key: KpiKey;
  label: string;
  value: number | null;
};

export type SummaryTableRow = {
  key: SummaryStatKey;
  label: string;
  season: number | null;
  career: number | null;
  per80: number | null;
  rank: number | null;
  rankLabel: string | null;
  /** Hover copy: #N of M eligible, period, min sample, metric basis. */
  rankTooltip: string | null;
  /** Hover honesty for career totals / coverage gaps. */
  careerTooltip: string | null;
  /** Conversion/penalty style "23 / 25 (91%)" when attempts are known. */
  seasonDetail: string | null;
  careerDetail: string | null;
  isPercent: boolean;
};

export type PointsBreakdownSegment = {
  key: "tries" | "conversions" | "penalties" | "dropGoals";
  label: string;
  count: number | null;
  points: number | null;
  percent: number | null;
};

export type PointsBreakdown = {
  storedPoints: number | null;
  computedPoints: number | null;
  mismatch: boolean;
  segments: PointsBreakdownSegment[];
};

export type Per80Row = {
  key: string;
  label: string;
  player: number | null;
  cohort: number | null;
  isPercent: boolean;
};

export type Per80Comparison = {
  cohortLabel: string;
  cohortSource: "competition" | "season" | "insufficient";
  rows: Per80Row[];
};

export type ContributionRing = {
  key: "points" | "tries" | "assists" | "lineBreaks";
  label: string;
  percent: number | null;
  player: number | null;
  team: number | null;
  sample: number;
};

export type PitchZoneCellDto = {
  key: string;
  index: number;
  label: string;
  count: number;
  percent: number | null;
};

export type SpatialCoverageDto = {
  totalEvents: number;
  eventsWithCoords: number;
  coveragePct: number | null;
  matchesInScope: number;
  matchesWithCoords: number;
  matchesUsed: number;
  sources: string[];
  notes: string[];
  method: "spatial" | "position" | null;
};

export type PassingZones = {
  available: boolean;
  method: "spatial" | "position" | null;
  cells: PitchZoneCellDto[] | null;
  totalPasses: number | null;
  passesWithCoords: number | null;
  passesWithPosition: number | null;
  message: string | null;
  coverage: SpatialCoverageDto;
};

export type KickingZones = {
  available: boolean;
  origin: PitchZoneCellDto[] | null;
  destination: PitchZoneCellDto[] | null;
  hasDestinationCoords: boolean;
  totalKicksFromHand: number | null;
  message: string | null;
  coverage: SpatialCoverageDto;
};

export type KickingAccuracyRow = {
  key: "overall" | "penalties" | "conversions" | "dropGoals";
  label: string;
  made: number | null;
  attempts: number | null;
  /** Exact rate (may be 1dp). Prefer displayPercent for UI. */
  percent: number | null;
  /** Rounded integer percent for display. */
  displayPercent: number | null;
  provisional: boolean;
  tooltip: string | null;
};

export type KickingAccuracy = {
  available: boolean;
  /** False for non-kickers with no goal-kick involvement — hide or show N/A. */
  applicable: boolean;
  rows: KickingAccuracyRow[];
  message: string | null;
  matches: number;
  matchesWithAttemptData: number;
  coverageTooltip: string;
};

export type DefensiveMetricCoverage = {
  /** Matches contributing a known tackles-made (completed) value. */
  tacklesMade: number;
  /** Matches with an explicit missed-tackles key (incl. verified 0). */
  missedTackles: number;
  /** Matches with provider dominant-tackles field (incl. verified 0). */
  dominantTackles: number;
  /** Matches with player turnovers-won (incl. verified 0). */
  turnoversWon: number;
};

export type DefensiveStats = {
  /** SUM made / (SUM made + SUM missed) × 100 from matches where both are known. Never an average of match %. */
  tackleSuccessPct: number | null;
  /** Successful tackles (provider completed; falls back to made when completed absent). null = unknown. */
  tacklesMade: number | null;
  /** null = unknown — never treated as 0 for success %. */
  missedTackles: number | null;
  /** Provider field only; null when no performance rows. Verified zero stays 0. */
  dominantTackles: number | null;
  /** Player-specific turnovers won (not team). */
  turnoversWon: number | null;
  /** made + missed from paired matches only. */
  attempts: number | null;
  matchesInScope: number;
  matchesWithPerf: number;
  /** Matches where both made and missed were known. */
  matchesWithTackleSample: number;
  /** share of in-scope matches with a made+missed pair. */
  coveragePct: number | null;
  /** Per-metric match counts for the ⓘ coverage tooltip. */
  metricCoverage: DefensiveMetricCoverage;
  /** True when attempts exist but are below the limited-sample threshold. */
  limitedSample: boolean;
  message: string | null;
};

export type PlayerStatsAvailableSeason = {
  slug: string;
  label: string;
  appearances: number;
};

export type GameLogRatingBand =
  | "exceptional"
  | "outstanding"
  | "very_good"
  | "solid"
  | "below_average"
  | "poor";

export type GameLogRow = {
  fixtureId: string;
  href: string | null;
  kickoffAt: string | null;
  seasonSlug: string | null;
  teamName: string | null;
  teamHref: string | null;
  competitionName: string | null;
  competitionSlug: string | null;
  competitionHref: string | null;
  opponentName: string | null;
  opponentHref: string | null;
  venue: "H" | "A" | "N" | null;
  result: "W" | "D" | "L" | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  minutes: number | null;
  points: number | null;
  tries: number | null;
  conversions: number | null;
  conversionAttempts: number | null;
  penalties: number | null;
  penaltyAttempts: number | null;
  dropGoals: number | null;
  dropGoalAttempts: number | null;
  tackleBreaks: number | null;
  metres: number | null;
  offloads: number | null;
  /** Successful tackles (completed); for defence-card reconciliation with the same season filter. */
  tacklesMade: number | null;
  missedTackles: number | null;
  dominantTackles: number | null;
  turnoversWon: number | null;
  rating: number | null;
  ratingBand: GameLogRatingBand | null;
  /** Attack / defence sub-scores when stored on player_match_ratings. Not used by the compact DEFENSIVE STATS card. */
  ratingBreakdown: { attack: number | null; defence: number | null } | null;
};

export type SeasonAverageItem = {
  key: string;
  label: string;
  value: number | null;
  isPercent: boolean;
};

export type StatsSlice = {
  period: PlayerStatsPeriod;
  seasonLabel: string;
  seasonSlug: string | null;
  matches: number;
  minutes: number | null;
  kpis: PlayerStatsKpi[];
  pointsBreakdown: PointsBreakdown;
  per80: Per80Comparison;
  attackingContribution: ContributionRing[];
  passingZones: PassingZones;
  kickingZones: KickingZones;
  kickingAccuracy: KickingAccuracy;
  defence: DefensiveStats;
  gameLog: GameLogRow[];
  averages: SeasonAverageItem[];
  ratingAverage: number | null;
  lastUpdatedIso: string | null;
};

export type PlayerStatsCoverage = {
  linkedFixtures: number;
  eligibleAppearances: number;
  performanceRows: number;
  ratedAppearances: number;
  minutesKnown: number;
  scoringSource: "fixture_players";
  kickingAttempts: "unavailable" | "partial" | "available";
  passingZones: "unavailable" | "available";
  kickingZones: "unavailable" | "partial" | "available";
  notes: string[];
};

export type PlayerStatsV2Dto = {
  playerId: string;
  slug: string;
  positionName: string | null;
  positionPeerLabel: string;
  defaultPeriod: PlayerStatsPeriod;
  selectedSeasonSlug: string;
  selectedSeasonLabel: string;
  availableSeasons: PlayerStatsAvailableSeason[];
  summaryTable: SummaryTableRow[];
  season: StatsSlice;
  career: StatsSlice;
  coverage: PlayerStatsCoverage;
};
