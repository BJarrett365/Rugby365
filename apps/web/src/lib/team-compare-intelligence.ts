/**
 * Phase 2 team compare intelligence — XV, position battles, depth (pure).
 */
import {
  normalizePositionFamily,
  type RadarPositionFamily,
} from "./player-radar-positions";
import type { TeamSquadPlayerRow } from "./team-squad-intelligence-types";

export type TeamXvSlot = {
  jersey: number;
  label: string;
  family: RadarPositionFamily;
  player: TeamSquadPlayerRow | null;
};

export type TeamPositionBattle = {
  key: string;
  label: string;
  jerseyHint: string;
  playerA: TeamSquadPlayerRow | null;
  playerB: TeamSquadPlayerRow | null;
  winner: "a" | "b" | "draw" | "none";
  ratingA: number | null;
  ratingB: number | null;
  compareHref: string | null;
};

export type TeamDepthSummary = {
  startingCount: number;
  benchCount: number;
  squadCount: number;
  depthScore: number | null;
  youthCount: number;
  youthPct: number | null;
  experienceScore: number | null;
  under23Count: number;
  over30Count: number;
};

const XV_SLOTS: Array<{ jersey: number; label: string; family: RadarPositionFamily }> = [
  { jersey: 1, label: "Loosehead", family: "loosehead_prop" },
  { jersey: 2, label: "Hooker", family: "hooker" },
  { jersey: 3, label: "Tighthead", family: "tighthead_prop" },
  { jersey: 4, label: "Lock", family: "lock" },
  { jersey: 5, label: "Lock", family: "lock" },
  { jersey: 6, label: "Blindside", family: "blindside_flanker" },
  { jersey: 7, label: "Openside", family: "openside_flanker" },
  { jersey: 8, label: "No.8", family: "number_eight" },
  { jersey: 9, label: "Scrum-half", family: "scrum_half" },
  { jersey: 10, label: "Fly-half", family: "fly_half" },
  { jersey: 11, label: "Left wing", family: "left_wing" },
  { jersey: 12, label: "Inside centre", family: "inside_centre" },
  { jersey: 13, label: "Outside centre", family: "outside_centre" },
  { jersey: 14, label: "Right wing", family: "right_wing" },
  { jersey: 15, label: "Full-back", family: "full_back" },
];

/** Position battle rows shown in UI (locks/centres/wings collapsed to one battle each). */
const BATTLE_ROWS: Array<{
  key: string;
  label: string;
  jerseyHint: string;
  families: RadarPositionFamily[];
}> = [
  { key: "lh", label: "Loosehead", jerseyHint: "1", families: ["loosehead_prop", "prop"] },
  { key: "hk", label: "Hooker", jerseyHint: "2", families: ["hooker"] },
  { key: "th", label: "Tighthead", jerseyHint: "3", families: ["tighthead_prop", "prop"] },
  { key: "lock", label: "Locks", jerseyHint: "4–5", families: ["lock"] },
  {
    key: "blindside",
    label: "Blindside",
    jerseyHint: "6",
    families: ["blindside_flanker", "flanker"],
  },
  {
    key: "openside",
    label: "Openside",
    jerseyHint: "7",
    families: ["openside_flanker", "flanker"],
  },
  { key: "eight", label: "No.8", jerseyHint: "8", families: ["number_eight"] },
  { key: "nine", label: "Scrum-half", jerseyHint: "9", families: ["scrum_half"] },
  { key: "ten", label: "Fly-half", jerseyHint: "10", families: ["fly_half"] },
  { key: "centre", label: "Centres", jerseyHint: "12–13", families: ["inside_centre", "outside_centre", "centre"] },
  { key: "wing", label: "Wings", jerseyHint: "11/14", families: ["left_wing", "right_wing", "wing"] },
  { key: "fifteen", label: "Full-back", jerseyHint: "15", families: ["full_back"] },
];

function familyMatches(
  playerFamily: RadarPositionFamily,
  wanted: RadarPositionFamily,
): boolean {
  if (playerFamily === wanted) return true;
  if (wanted === "loosehead_prop" || wanted === "tighthead_prop") {
    return playerFamily === "prop" || playerFamily === wanted;
  }
  if (wanted === "blindside_flanker" || wanted === "openside_flanker") {
    return playerFamily === "flanker" || playerFamily === wanted;
  }
  if (wanted === "inside_centre" || wanted === "outside_centre") {
    return playerFamily === "centre" || playerFamily === wanted;
  }
  if (wanted === "left_wing" || wanted === "right_wing") {
    return playerFamily === "wing" || playerFamily === wanted;
  }
  return false;
}

function bestForFamilies(
  squad: TeamSquadPlayerRow[],
  families: RadarPositionFamily[],
  usedIds: Set<string>,
): TeamSquadPlayerRow | null {
  const candidates = squad
    .filter((p) => !usedIds.has(p.id))
    .filter((p) => {
      const fam = normalizePositionFamily(p.positionName);
      return families.some((f) => familyMatches(fam, f) || fam === f);
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return candidates[0] ?? null;
}

/** Build a modelled starting XV from squad (rating + position). */
export function buildModelledStartingXv(squad: TeamSquadPlayerRow[]): TeamXvSlot[] {
  const used = new Set<string>();
  const slots: TeamXvSlot[] = XV_SLOTS.map((slot) => ({
    jersey: slot.jersey,
    label: slot.label,
    family: slot.family,
    player: null,
  }));

  // Pass 1: fill each slot with a position match (no stealing specialists).
  for (const slot of slots) {
    const fallbackFamilies: RadarPositionFamily[] = [slot.family];
    if (slot.family === "loosehead_prop" || slot.family === "tighthead_prop") {
      fallbackFamilies.push("prop");
    }
    if (slot.family === "blindside_flanker" || slot.family === "openside_flanker") {
      fallbackFamilies.push("flanker");
    }
    if (slot.family === "inside_centre" || slot.family === "outside_centre") {
      fallbackFamilies.push("centre");
    }
    if (slot.family === "left_wing" || slot.family === "right_wing") {
      fallbackFamilies.push("wing");
    }

    const player = bestForFamilies(squad, fallbackFamilies, used);
    if (player) {
      used.add(player.id);
      slot.player = player;
    }
  }

  // Pass 2: fill remaining gaps with highest unused rated players.
  for (const slot of slots) {
    if (slot.player) continue;
    const player =
      [...squad]
        .filter((p) => !used.has(p.id))
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
    if (player) {
      used.add(player.id);
      slot.player = player;
    }
  }

  return slots;
}

export function buildPositionBattles(
  squadA: TeamSquadPlayerRow[],
  squadB: TeamSquadPlayerRow[],
): TeamPositionBattle[] {
  return BATTLE_ROWS.map((row) => {
    const playerA = bestForFamilies(squadA, row.families, new Set());
    const playerB = bestForFamilies(squadB, row.families, new Set());
    const ratingA = playerA?.rating ?? null;
    const ratingB = playerB?.rating ?? null;
    let winner: TeamPositionBattle["winner"] = "none";
    if (ratingA != null && ratingB != null) {
      if (ratingA > ratingB) winner = "a";
      else if (ratingB > ratingA) winner = "b";
      else winner = "draw";
    } else if (ratingA != null) winner = "a";
    else if (ratingB != null) winner = "b";

    const compareHref =
      playerA?.slug && playerB?.slug && playerA.slug !== playerB.slug
        ? `/players/${encodeURIComponent(playerA.slug)}/compare/${encodeURIComponent(playerB.slug)}`
        : null;

    return {
      key: row.key,
      label: row.label,
      jerseyHint: row.jerseyHint,
      playerA,
      playerB,
      winner,
      ratingA,
      ratingB,
      compareHref,
    };
  });
}

export function buildDepthSummary(squad: TeamSquadPlayerRow[]): TeamDepthSummary {
  const starting = squad.filter((p) => p.squadRole === "starting");
  const bench = squad.filter((p) => p.squadRole === "bench");
  const youth = squad.filter((p) => p.age != null && p.age < 23);
  const under23 = youth.length;
  const over30 = squad.filter((p) => p.age != null && p.age >= 30).length;
  const rated = squad.filter((p) => p.rating != null);
  const avgAge =
    squad.map((p) => p.age).filter((a): a is number => a != null).reduce((s, a, _, arr) => s + a / arr.length, 0) ||
    null;

  // Experience: higher when more over-30 + higher avg rating among starters.
  const starterAvg =
    starting.filter((p) => p.rating != null).length > 0
      ? starting
          .filter((p) => p.rating != null)
          .reduce((s, p) => s + (p.rating ?? 0), 0) /
        starting.filter((p) => p.rating != null).length
      : null;
  const experienceScore =
    starterAvg != null
      ? Math.round(
          Math.min(99, Math.max(35, starterAvg * 0.85 + over30 * 1.2 + (avgAge ?? 25) * 0.15)),
        )
      : null;

  const depthScore =
    rated.length > 0
      ? Math.round(Math.min(99, Math.max(35, 40 + rated.length * 1.1 + bench.length * 0.8)))
      : null;

  return {
    startingCount: starting.length,
    benchCount: bench.length,
    squadCount: squad.length,
    depthScore,
    youthCount: under23,
    youthPct: squad.length > 0 ? Math.round((under23 / squad.length) * 1000) / 10 : null,
    experienceScore,
    under23Count: under23,
    over30Count: over30,
  };
}

export function summarizeXv(slots: TeamXvSlot[]): {
  valueGbp: number;
  averageRating: number | null;
  averageAge: number | null;
  filled: number;
} {
  const players = slots.map((s) => s.player).filter((p): p is TeamSquadPlayerRow => Boolean(p));
  const valueGbp = players.reduce((s, p) => s + p.marketValueGbp, 0);
  const rated = players.filter((p) => p.rating != null);
  const aged = players.filter((p) => p.age != null);
  return {
    valueGbp,
    averageRating:
      rated.length > 0
        ? Math.round((rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length) * 10) / 10
        : null,
    averageAge:
      aged.length > 0
        ? Math.round((aged.reduce((s, p) => s + (p.age ?? 0), 0) / aged.length) * 10) / 10
        : null,
    filled: players.length,
  };
}
