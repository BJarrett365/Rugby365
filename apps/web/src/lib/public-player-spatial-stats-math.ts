/**
 * Pure spatial pitch math — coord normalisation, 3×3 zone bucketing,
 * and position-based passing-zone fallback (no invented Opta coordinates).
 */

import {
  resolvePassingPitchZoneWeights,
  type PassingZoneWeight,
} from "./player-intelligence-position-config";
import type { PitchZoneCell, PitchZoneKey, RawSpatialEvent } from "./public-player-spatial-stats-types";

export type PitchHeatmapCell = {
  key: string;
  index: number;
  label: string;
  count: number;
  percent: number | null;
};

export const PITCH_ZONE_COUNT = 9;

const ZONE_DEFS: Array<{ key: PitchZoneKey; label: string }> = [
  { key: "attacking_left", label: "Attacking · Left" },
  { key: "attacking_centre", label: "Attacking · Centre" },
  { key: "attacking_right", label: "Attacking · Right" },
  { key: "middle_left", label: "Middle · Left" },
  { key: "middle_centre", label: "Middle · Centre" },
  { key: "middle_right", label: "Middle · Right" },
  { key: "defensive_left", label: "Defensive · Left" },
  { key: "defensive_centre", label: "Defensive · Centre" },
  { key: "defensive_right", label: "Defensive · Right" },
];

export function emptyPitchZoneCells(): PitchZoneCell[] {
  return ZONE_DEFS.map((z, index) => ({
    key: z.key,
    index,
    label: z.label,
    count: 0,
    percent: null,
  }));
}

export function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function clampCoord(n: number): number {
  return clampPct(n);
}

/**
 * Map pitch coords (0–100) to zone index.
 * x: 0 = defensive try-line, 100 = attacking try-line.
 * y: 0 = left touch, 100 = right touch.
 */
export function zoneIndexFromCoords(x: number, y: number): number {
  const cx = clampCoord(x);
  const cy = clampCoord(y);
  const depthRow = cx >= 200 / 3 ? 0 : cx >= 100 / 3 ? 1 : 2;
  const widthCol = cy >= 200 / 3 ? 2 : cy >= 100 / 3 ? 1 : 0;
  return depthRow * 3 + widthCol;
}

export function bucketEventsToZones(
  points: Array<{ x: number; y: number }>,
): { cells: PitchZoneCell[]; total: number } {
  const cells = emptyPitchZoneCells();
  for (const p of points) {
    const idx = zoneIndexFromCoords(p.x, p.y);
    cells[idx]!.count += 1;
  }
  const total = points.length;
  if (total > 0) {
    for (const cell of cells) {
      cell.percent = Math.round((cell.count / total) * 100);
    }
  }
  return { cells, total };
}

export function coveragePct(withCoords: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((withCoords / total) * 100);
}

const START_X_KEYS = [
  "x",
  "X",
  "location_x",
  "origin_x",
  "start_x",
  "pitch_x",
  "pitchX",
  "x_percent",
  "xPercent",
  "loc_x",
];
const START_Y_KEYS = [
  "y",
  "Y",
  "location_y",
  "origin_y",
  "start_y",
  "pitch_y",
  "pitchY",
  "y_percent",
  "yPercent",
  "loc_y",
];
const NESTED_LOCATION_KEYS = ["location", "position", "coords", "start", "origin", "point", "pitch"];

/** Read x/y (and optional end coords) from heterogeneous event payloads. */
export function readCoordPair(payload: unknown): { x: number; y: number } | null {
  return readNamedCoordPair(payload, START_X_KEYS, START_Y_KEYS, true);
}

export function readEndCoordPair(payload: unknown): { x: number; y: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const direct = readNamedCoordPair(
    obj,
    ["end_x", "destination_x", "dest_x", "target_x", "endX", "destinationX"],
    ["end_y", "destination_y", "dest_y", "target_y", "endY", "destinationY"],
    false,
  );
  if (direct) return direct;
  for (const key of ["end", "destination", "dest", "target"]) {
    const nested = readNamedCoordPair(obj[key], START_X_KEYS, START_Y_KEYS, false);
    if (nested) return nested;
  }
  return null;
}

function readNamedCoordPair(
  payload: unknown,
  xKeys: string[],
  yKeys: string[],
  walkNested: boolean,
): { x: number; y: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    if (Array.isArray(payload) && payload.length >= 2) {
      const x = Number(payload[0]);
      const y = Number(payload[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x: clampCoord(x), y: clampCoord(y) };
    }
    return null;
  }
  const obj = payload as Record<string, unknown>;
  const x = readCoord(obj, xKeys);
  const y = readCoord(obj, yKeys);
  if (x != null && y != null) return { x: clampCoord(x), y: clampCoord(y) };
  if (!walkNested) return null;
  for (const key of NESTED_LOCATION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const nested = readNamedCoordPair(obj[key], START_X_KEYS, START_Y_KEYS, false);
    if (nested) return nested;
  }
  return null;
}

function readCoord(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const n = Number(obj[key]);
    if (!Number.isFinite(n)) return null;
    return n;
  }
  return null;
}

const PASS_EVENT_TYPES = new Set([
  "pass",
  "pass_made",
  "pass_offload",
  "offload",
  "pass_completed",
]);

const KICK_FROM_HAND_TYPES = new Set([
  "kick_from_hand",
  "kick_hand",
  "open_play_kick",
  "kick_in_play",
  "kick",
]);

const GOAL_KICK_TYPES = new Set([
  "penalty_goal",
  "penalty",
  "conversion",
  "conversion_missed",
  "penalty_missed",
  "drop_goal",
  "goal_kick",
  "kick_off",
  "kickoff",
]);

export function spatialEventKind(eventType: string): "pass" | "kick_from_hand" | null {
  const t = eventType.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!t) return null;
  if (PASS_EVENT_TYPES.has(t) || t.includes("pass")) return "pass";
  if (GOAL_KICK_TYPES.has(t)) return null;
  if (KICK_FROM_HAND_TYPES.has(t) || (t.includes("kick") && !t.includes("goal"))) return "kick_from_hand";
  return null;
}

/**
 * Normalise raw pitch coords to attacking direction for the player's team.
 * Default feed convention: x=0 home try-line, x=100 away try-line.
 */
export function normalizeToAttackingCoords(input: {
  x: number;
  y: number;
  playerTeamId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  half: number | null;
}): { x: number; y: number } {
  let ax = clampCoord(input.x);
  const cy = clampCoord(input.y);
  const playerIsHome = input.homeTeamId != null && input.playerTeamId === input.homeTeamId;
  if (input.homeTeamId && input.awayTeamId && !playerIsHome && input.playerTeamId === input.awayTeamId) {
    ax = 100 - ax;
  }
  if (input.half != null && input.half >= 2) {
    ax = 100 - ax;
  }
  return { x: ax, y: cy };
}

export function buildPassingSpatialStats(events: RawSpatialEvent[]): {
  cells: PitchZoneCell[];
  total: number;
  withCoords: number;
} {
  const passPoints = events.filter((e) => e.kind === "pass").map((e) => ({ x: e.x, y: e.y }));
  const bucket = bucketEventsToZones(passPoints);
  return { cells: bucket.cells, total: events.filter((e) => e.kind === "pass").length, withCoords: bucket.total };
}

export type PositionPassAppearance = {
  passCount: number;
  positionName: string | null;
  jerseyNumber: number | null;
};

export type PositionBasedPassingZones = {
  cells: PitchZoneCell[];
  totalPasses: number;
  passesWithPosition: number;
  matchesWithPasses: number;
  matchesWithPosition: number;
  excludedPasses: number;
  excludedMatches: number;
};

function zoneIndexFromKey(key: PitchZoneKey): number {
  return ZONE_DEFS.findIndex((z) => z.key === key);
}

/** Largest-remainder integer split so zone counts sum to passCount. */
function allocatePassCount(passCount: number, weights: PassingZoneWeight[]): Array<{ key: PitchZoneKey; count: number }> {
  const exact = weights.map((w) => ({ key: w.key, exact: passCount * w.weight }));
  const floors = exact.map((row) => ({ key: row.key, count: Math.floor(row.exact), frac: row.exact - Math.floor(row.exact) }));
  let remainder = passCount - floors.reduce((sum, row) => sum + row.count, 0);
  const order = floors
    .map((row, i) => ({ i, frac: row.frac }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    const idx = order[k]?.i;
    if (idx == null) break;
    floors[idx]!.count += 1;
  }
  return floors.map((row) => ({ key: row.key, count: row.count }));
}

/**
 * Fill the 3×3 from playing position + per-appearance pass counts.
 * Appearances with passes but no resolvable position are excluded (not dumped into centre).
 */
export function buildPositionBasedPassingZones(
  appearances: PositionPassAppearance[],
): PositionBasedPassingZones {
  const cells = emptyPitchZoneCells();
  let totalPasses = 0;
  let passesWithPosition = 0;
  let matchesWithPasses = 0;
  let matchesWithPosition = 0;
  let excludedPasses = 0;
  let excludedMatches = 0;

  for (const row of appearances) {
    if (!Number.isFinite(row.passCount) || row.passCount <= 0) continue;
    const passCount = Math.round(row.passCount);
    if (passCount <= 0) continue;
    totalPasses += passCount;
    matchesWithPasses += 1;

    const weights = resolvePassingPitchZoneWeights(row.positionName, row.jerseyNumber);
    if (!weights || weights.length === 0) {
      excludedPasses += passCount;
      excludedMatches += 1;
      continue;
    }

    matchesWithPosition += 1;
    passesWithPosition += passCount;
    for (const part of allocatePassCount(passCount, weights)) {
      const idx = zoneIndexFromKey(part.key);
      if (idx < 0) continue;
      cells[idx]!.count += part.count;
    }
  }

  if (passesWithPosition > 0) {
    for (const cell of cells) {
      cell.percent = Math.round((cell.count / passesWithPosition) * 100);
    }
  }

  return {
    cells,
    totalPasses,
    passesWithPosition,
    matchesWithPasses,
    matchesWithPosition,
    excludedPasses,
    excludedMatches,
  };
}

export function buildKickingSpatialStats(events: RawSpatialEvent[]): {
  origin: PitchZoneCell[];
  destination: PitchZoneCell[];
  total: number;
  withOrigin: number;
  withDestination: number;
} {
  const kicks = events.filter((e) => e.kind === "kick_from_hand");
  const originPoints = kicks.map((e) => ({ x: e.x, y: e.y }));
  const destPoints = kicks
    .filter((e) => e.endX != null && e.endY != null)
    .map((e) => ({ x: e.endX as number, y: e.endY as number }));
  const originBucket = bucketEventsToZones(originPoints);
  const destBucket = bucketEventsToZones(destPoints);
  return {
    origin: originBucket.cells,
    destination: destBucket.cells,
    total: kicks.length,
    withOrigin: originBucket.total,
    withDestination: destBucket.total,
  };
}

/** Heat colour t in [0,1] for passing (forest → lime) or kicking (cyan). */
export function heatColor(mode: "passing" | "kicking", t: number): string {
  const clamped = clampPct(t * 100) / 100;
  if (mode === "passing") {
    const r = Math.round(11 + clamped * 173);
    const g = Math.round(61 + clamped * 179);
    const b = Math.round(31 + clamped * 21);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round(8 + clamped * 26);
  const g = Math.round(47 + clamped * 164);
  const b = Math.round(73 + clamped * 140);
  return `rgb(${r}, ${g}, ${b})`;
}

export function zoneHeatIntensity(cells: PitchHeatmapCell[], index: number): number {
  const cell = cells[index];
  if (!cell || cell.percent == null) return 0;
  const max = Math.max(...cells.map((c) => c.percent ?? 0), 1);
  return max > 0 ? (cell.percent ?? 0) / max : 0;
}
