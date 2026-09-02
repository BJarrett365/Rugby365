/** Shared types for multi-provider entity mapping (P1 Rugby Data API + secondary sources). */

/** Preferred / default external identity source for Rugby365. Never used as DB PK. */
export const PROVIDER_SPORT_CC = "sport_cc" as const;
export const PROVIDER_RUGBY_DATA = "rugby_data" as const;
export const PROVIDER_SDMS = "sdms" as const;
export const PROVIDER_SPORT365 = "sport365" as const;
export const PROVIDER_WIKIPEDIA = "wikipedia" as const;
export const PROVIDER_RUGBYPASS = "rugbypass" as const;
export const PROVIDER_LIVESPORT = "livesport" as const;
export const PROVIDER_WORLD_RUGBY = "world_rugby" as const;
export const PROVIDER_CLUB_WEBSITE = "club_website" as const;
export const PROVIDER_ODDSCHECKER = "oddschecker" as const;
export const PROVIDER_BMBETS = "bmbets" as const;
export const PROVIDER_OPTA = "opta" as const;
export const PROVIDER_STATS_PERFORM = "stats_perform" as const;
export const PROVIDER_MANUAL = "manual" as const;
export const PROVIDER_AI = "ai" as const;

/** Default provider when a Sport CC ID exists. */
export const DEFAULT_EXTERNAL_PROVIDER = PROVIDER_SPORT_CC;

export const DATA_INTEGRATION_PROVIDERS = [
  PROVIDER_SPORT_CC,
  PROVIDER_RUGBY_DATA,
  PROVIDER_SDMS,
  PROVIDER_SPORT365,
  PROVIDER_WIKIPEDIA,
  PROVIDER_RUGBYPASS,
  PROVIDER_LIVESPORT,
  PROVIDER_WORLD_RUGBY,
  PROVIDER_CLUB_WEBSITE,
  PROVIDER_ODDSCHECKER,
  PROVIDER_BMBETS,
  PROVIDER_OPTA,
  PROVIDER_STATS_PERFORM,
  PROVIDER_MANUAL,
  PROVIDER_AI,
] as const;

export type DataIntegrationProvider = (typeof DATA_INTEGRATION_PROVIDERS)[number];

export const MAPPING_ENTITY_TYPES = [
  "competition",
  "season",
  "team",
  "player",
  "match",
  "venue",
  "referee",
  "coach",
] as const;

export type MappingEntityType = (typeof MAPPING_ENTITY_TYPES)[number];

export const MAPPING_STATUSES = [
  "unmapped",
  "suggested",
  "confirmed",
  "conflict",
  "ignored",
  "archived",
] as const;

export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const WHOLE_RECORD_LOCK_FIELD = "*";

export type MatchReason = {
  rule: string;
  details?: string;
  context?: Record<string, unknown>;
};

export type ConfidenceInput = {
  entityType: MappingEntityType;
  exactExternalIdMatch?: boolean;
  normalisedNameMatch?: boolean;
  nameUniqueInScope?: boolean;
  sameCompetition?: boolean;
  sameCountry?: boolean;
  sameSeason?: boolean;
  sameTeams?: boolean;
  kickoffWithinMinutes?: number | null;
  aliasOrNicknameMatch?: boolean;
  tokenSortMatch?: boolean;
  dobMatch?: boolean;
  nationalityMatch?: boolean;
  positionMatch?: boolean;
  candidateCount?: number;
};

export type ConfidenceResult = {
  confidence: number;
  matchReason: MatchReason;
  /** Suggested status before human review — never auto-confirmed for gated entity types. */
  suggestedStatus: Extract<MappingStatus, "suggested" | "unmapped" | "conflict">;
  requiresManualReview: boolean;
  blockAutoConfirm: boolean;
  blockAutoCreate: boolean;
};
