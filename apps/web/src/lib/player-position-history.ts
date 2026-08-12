/**
 * Compatibility re-exports — prefer `@/lib/player-position-usage-service`.
 */
export {
  POSITION_CLASS_THRESHOLDS,
  POSITION_MODE_THRESHOLDS,
  classifyPositionUsage,
  isBenchRole,
  positionSlug,
  normalizeFieldPosition,
  resolvePositionUsageMode,
  buildFactualPositionInsight,
  computePlayerPositionUsage,
  buildPositionHistory,
  type PositionClass,
  type PositionUsageMode,
  type PositionCalculationMethod,
  type PositionUsageScope,
  type PositionUsageBarTone,
  type PositionUsageRow,
  type AppearanceRoleSummary,
  type PositionCoverage,
  type PlayerPositionUsageResult,
  type PositionHistoryRow,
  type PositionAppearanceInput,
} from "./player-position-usage-service";
