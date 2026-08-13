/**
 * Spatial passing / kicking zone DTOs for player stats pitch heatmaps.
 * Unknown = null. React must not count or bucket events.
 */

export type PitchZoneKey =
  | "attacking_left"
  | "attacking_centre"
  | "attacking_right"
  | "middle_left"
  | "middle_centre"
  | "middle_right"
  | "defensive_left"
  | "defensive_centre"
  | "defensive_right";

export type PitchZoneCell = {
  key: PitchZoneKey;
  /** Row-major index: attacking row 0–2, middle 3–5, defensive 6–8. */
  index: number;
  label: string;
  count: number;
  percent: number | null;
};

export type PassingZoneMethod = "spatial" | "position";

export type SpatialStatsCoverage = {
  totalEvents: number;
  eventsWithCoords: number;
  coveragePct: number | null;
  matchesInScope: number;
  matchesWithCoords: number;
  /** Matches that contributed to the rendered heatmap (coords or position). */
  matchesUsed: number;
  sources: string[];
  notes: string[];
  method: PassingZoneMethod | null;
};

export type PassingSpatialStats = {
  available: boolean;
  method: PassingZoneMethod | null;
  cells: PitchZoneCell[] | null;
  totalPasses: number | null;
  passesWithCoords: number | null;
  passesWithPosition: number | null;
  message: string | null;
  coverage: SpatialStatsCoverage;
};

export type KickingSpatialStats = {
  available: boolean;
  origin: PitchZoneCell[] | null;
  destination: PitchZoneCell[] | null;
  hasDestinationCoords: boolean;
  totalKicksFromHand: number | null;
  kicksWithOriginCoords: number | null;
  kicksWithDestinationCoords: number | null;
  message: string | null;
  coverage: SpatialStatsCoverage;
};

export type PlayerSpatialStatsFilters = {
  seasonSlug?: string | null;
  competitionId?: string | null;
  teamId?: string | null;
  scope?: "all" | "club" | "international" | null;
};

export type PlayerSpatialStatsDto = {
  playerId: string;
  seasonSlug: string | null;
  seasonLabel: string | null;
  passing: PassingSpatialStats;
  kicking: KickingSpatialStats;
};

export type SpatialEventKind = "pass" | "kick_from_hand";

export type RawSpatialEvent = {
  kind: SpatialEventKind;
  fixtureId: string;
  sourceProvider: string | null;
  x: number;
  y: number;
  endX: number | null;
  endY: number | null;
};
