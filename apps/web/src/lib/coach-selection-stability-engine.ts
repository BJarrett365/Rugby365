/**
 * Coach Selection Stability Engine v1
 *
 * Measures continuity + controlled rotation for one coach-team tenure window.
 */

export const COACH_SELECTION_STABILITY_VERSION = "coach-selection-stability-v1";

export type SelectionMatchLineup = {
  fixtureId: string;
  kickoffAt: Date | null;
  starters: string[];
  bench: string[];
  result: "W" | "D" | "L" | null;
};

export type SelectionStabilityInput = {
  lineups: SelectionMatchLineup[];
  playerBirthDates: Map<string, string | null>;
  preTenureTeamPlayerIds: Set<string>;
  eligibleMatches: number;
};

export type SelectionStabilityResult = {
  modelVersion: string;
  enoughData: boolean;
  message: string | null;
  stabilityScore: number | null;
  stabilityLabel: string | null;
  confidencePct: number | null;
  playersUsed: number;
  startersUsed: number;
  benchOnlyPlayers: number;
  avgStartingXvChanges: number | null;
  avgBenchChanges: number | null;
  unchangedXvPct: number | null;
  debutants: number;
  avgStartingXvAge: number | null;
  avgBenchAge: number | null;
  matchesAnalysed: number;
  lineupTransitions: number;
  lineupsAvailable: number;
  eligibleMatches: number;
  coveragePct: number | null;
  dataIssues: string[];
  components: {
    startingXvContinuity: number | null;
    benchContinuity: number | null;
    successfulRotation: number | null;
    selectionPerformance: number | null;
    unchangedXv: number | null;
  };
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function isStarterRole(squadRole: string | null | undefined, jersey: number | null): boolean {
  const role = (squadRole || "").toLowerCase();
  if (role.includes("substitute") || role.includes("bench") || role.includes("repl")) return false;
  if (role.includes("start") || role === "xv" || role === "starting") return true;
  return jersey != null && jersey >= 1 && jersey <= 15;
}

export function isBenchRole(squadRole: string | null | undefined, jersey: number | null): boolean {
  const role = (squadRole || "").toLowerCase();
  if (role.includes("substitute") || role.includes("bench") || role.includes("repl") || role.includes("reserve"))
    return true;
  if (role.includes("start") || role === "xv" || role === "starting") return false;
  return jersey != null && jersey >= 16;
}

export function countStarterChanges(prev: Set<string>, next: Set<string>): number {
  let changes = 0;
  for (const id of next) {
    if (!prev.has(id)) changes += 1;
  }
  return changes;
}

export function countStarterChangesCapped(prev: Set<string>, next: Set<string>): number {
  return Math.min(countStarterChanges(prev, next), 15);
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function playerAgeAt(birthDate: string | null, asOf: Date | null): number | null {
  if (!birthDate || !asOf) return null;
  const dob = new Date(`${birthDate}T12:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const md = asOf.getUTCMonth() - dob.getUTCMonth();
  if (md < 0 || (md === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stabilityLabel(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 90) return "ELITE STABILITY";
  if (score >= 80) return "VERY STABLE";
  if (score >= 70) return "STABLE";
  if (score >= 60) return "VARIABLE";
  return "HIGH ROTATION";
}

export function computeSelectionStability(input: SelectionStabilityInput): SelectionStabilityResult {
  const dataIssues: string[] = [];
  const chron = [...input.lineups].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );

  const lineupsAvailable = chron.length;
  const eligibleMatches = input.eligibleMatches;

  if (lineupsAvailable < 2) {
    return emptyResult({
      eligibleMatches,
      lineupsAvailable,
      message: "INSUFFICIENT SELECTION STABILITY DATA",
    });
  }

  const allPlayers = new Set<string>();
  const allStarters = new Set<string>();
  const benchOnly = new Set<string>();

  for (const lu of chron) {
    for (const id of lu.starters) {
      allPlayers.add(id);
      allStarters.add(id);
    }
    for (const id of lu.bench) allPlayers.add(id);
  }
  for (const id of allPlayers) {
    if (!allStarters.has(id)) benchOnly.add(id);
  }

  let xvChangeSum = 0;
  let benchChangeSum = 0;
  let transitions = 0;
  let benchTransitions = 0;
  let unchangedXv = 0;
  let rotationWins = 0;
  let rotationGames = 0;
  let winCount = 0;

  const lineupXvAges: number[] = [];
  const lineupBenchAges: number[] = [];

  let prevStarters: Set<string> | null = null;
  let prevBench: Set<string> | null = null;

  for (const lu of chron) {
    const starters = new Set(lu.starters);
    const bench = new Set(lu.bench);

    const starterAgeList = lu.starters
      .map((id) => playerAgeAt(input.playerBirthDates.get(id) ?? null, lu.kickoffAt))
      .filter((a): a is number => a != null);
    const benchAgeList = lu.bench
      .map((id) => playerAgeAt(input.playerBirthDates.get(id) ?? null, lu.kickoffAt))
      .filter((a): a is number => a != null);
    const xvAge = avg(starterAgeList);
    const bAge = avg(benchAgeList);
    if (xvAge != null && starterAgeList.length >= 10) lineupXvAges.push(xvAge);
    if (bAge != null && benchAgeList.length >= 4) lineupBenchAges.push(bAge);

    if (prevStarters && starters.size >= 10) {
      const rawChanges = countStarterChanges(prevStarters, starters);
      const changes = Math.min(rawChanges, 15);
      if (rawChanges > 15) dataIssues.push("xv_changes_exceeds_15");
      xvChangeSum += changes;
      transitions += 1;
      if (setsEqual(prevStarters, starters)) unchangedXv += 1;
      if (changes >= 2) {
        rotationGames += 1;
        if (lu.result === "W") rotationWins += 1;
      }
    }

    if (prevBench && bench.size >= 4) {
      benchChangeSum += countStarterChanges(prevBench, bench);
      benchTransitions += 1;
    }

    if (lu.result === "W") winCount += 1;
    prevStarters = starters;
    prevBench = bench;
  }

  const avgXvChanges = transitions > 0 ? xvChangeSum / transitions : null;
  const avgBenchChanges = benchTransitions > 0 ? benchChangeSum / benchTransitions : null;
  const unchangedXvPct = transitions > 0 ? (unchangedXv / transitions) * 100 : null;

  const debutants = new Set<string>();
  const seenInTenure = new Set<string>();
  for (const lu of chron) {
    for (const id of [...lu.starters, ...lu.bench]) {
      if (!seenInTenure.has(id)) {
        seenInTenure.add(id);
        if (!input.preTenureTeamPlayerIds.has(id)) debutants.add(id);
      }
    }
  }

  const coveragePct =
    eligibleMatches > 0 ? Math.round((lineupsAvailable / eligibleMatches) * 100) : null;

  let confidencePct = 35;
  if (transitions >= 10) confidencePct += 30;
  else if (transitions >= 5) confidencePct += 20;
  else if (transitions >= 3) confidencePct += 10;
  if ((coveragePct ?? 0) >= 80) confidencePct += 20;
  else if ((coveragePct ?? 0) >= 60) confidencePct += 10;
  confidencePct = clamp(confidencePct, 0, 99);

  const enoughData = transitions >= 3;
  const message = enoughData ? null : "INSUFFICIENT SELECTION STABILITY DATA";

  const startingXvContinuity =
    avgXvChanges != null ? clamp(100 - Math.abs(avgXvChanges - 3) * 14) : null;
  const benchContinuityScore =
    avgBenchChanges != null ? clamp(100 - Math.abs(avgBenchChanges - 4) * 10) : null;
  const unchangedScore = unchangedXvPct != null ? clamp(unchangedXvPct) : null;
  const successfulRotation =
    rotationGames > 0 ? clamp(40 + (rotationWins / rotationGames) * 60) : null;
  const selectionPerformance =
    chron.length > 0 ? clamp(35 + (winCount / chron.length) * 65) : null;

  let stabilityScore: number | null = null;
  if (enoughData) {
    const parts = [
      { v: startingXvContinuity, w: 0.3 },
      { v: benchContinuityScore, w: 0.1 },
      { v: successfulRotation, w: 0.2 },
      { v: selectionPerformance, w: 0.15 },
      { v: unchangedScore, w: 0.1 },
      { v: startingXvContinuity, w: 0.15 },
    ];
    let sum = 0;
    let wSum = 0;
    for (const { v, w } of parts) {
      if (v != null) {
        sum += v * w;
        wSum += w;
      }
    }
    stabilityScore = wSum > 0 ? round1(clamp(sum / wSum)) : null;
  }

  if (avgXvChanges != null && avgXvChanges > 15) {
    dataIssues.push("calculation_error_avg_xv_changes");
  }

  return {
    modelVersion: COACH_SELECTION_STABILITY_VERSION,
    enoughData,
    message,
    stabilityScore,
    stabilityLabel: stabilityLabel(stabilityScore),
    confidencePct: enoughData ? confidencePct : null,
    playersUsed: allPlayers.size,
    startersUsed: allStarters.size,
    benchOnlyPlayers: benchOnly.size,
    avgStartingXvChanges: avgXvChanges != null ? round1(avgXvChanges) : null,
    avgBenchChanges: avgBenchChanges != null ? round1(avgBenchChanges) : null,
    unchangedXvPct: unchangedXvPct != null ? Math.round(unchangedXvPct) : null,
    debutants: debutants.size,
    avgStartingXvAge: avg(lineupXvAges) != null ? round1(avg(lineupXvAges)!) : null,
    avgBenchAge: avg(lineupBenchAges) != null ? round1(avg(lineupBenchAges)!) : null,
    matchesAnalysed: lineupsAvailable,
    lineupTransitions: transitions,
    lineupsAvailable,
    eligibleMatches,
    coveragePct,
    dataIssues,
    components: {
      startingXvContinuity: startingXvContinuity != null ? round1(startingXvContinuity) : null,
      benchContinuity: benchContinuityScore != null ? round1(benchContinuityScore) : null,
      successfulRotation: successfulRotation != null ? round1(successfulRotation) : null,
      selectionPerformance: selectionPerformance != null ? round1(selectionPerformance) : null,
      unchangedXv: unchangedScore != null ? round1(unchangedScore) : null,
    },
  };
}

function emptyResult(meta: {
  eligibleMatches: number;
  lineupsAvailable: number;
  message: string;
}): SelectionStabilityResult {
  return {
    modelVersion: COACH_SELECTION_STABILITY_VERSION,
    enoughData: false,
    message: meta.message,
    stabilityScore: null,
    stabilityLabel: null,
    confidencePct: null,
    playersUsed: 0,
    startersUsed: 0,
    benchOnlyPlayers: 0,
    avgStartingXvChanges: null,
    avgBenchChanges: null,
    unchangedXvPct: null,
    debutants: 0,
    avgStartingXvAge: null,
    avgBenchAge: null,
    matchesAnalysed: meta.lineupsAvailable,
    lineupTransitions: 0,
    lineupsAvailable: meta.lineupsAvailable,
    eligibleMatches: meta.eligibleMatches,
    coveragePct: null,
    dataIssues: [],
    components: {
      startingXvContinuity: null,
      benchContinuity: null,
      successfulRotation: null,
      selectionPerformance: null,
      unchangedXv: null,
    },
  };
}
