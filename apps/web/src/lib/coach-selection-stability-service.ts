/**
 * Loads coach-team lineups for current tenure and runs Selection Stability engine.
 */

import { and, eq, inArray, lt } from "drizzle-orm";
import { fixturePlayers, fixtures, players } from "@rugby365/db";
import { getDb } from "./db";
import { allRelatedTeamIds } from "./coach-team-aliases";
import { getCoachDetail } from "./coach-admin-service";
import { loadCoachEligibleMatches } from "./coach-career-record-service";
import {
  computeSelectionStability,
  isBenchRole,
  isStarterRole,
  type SelectionMatchLineup,
  type SelectionStabilityResult,
} from "./coach-selection-stability-engine";

export type CoachSelectionStability = SelectionStabilityResult & {
  /** @deprecated use lineupsAvailable */
  matchesWithLineups: number;
  differentCaptains: number | null;
};

export async function getCoachSelectionStability(coachId: string): Promise<CoachSelectionStability> {
  const detail = await getCoachDetail(coachId);
  const current = detail?.assignments.find((a) => a.isCurrent) ?? null;
  const teamId = current?.teamId ?? null;
  const tenureStart = current?.startDate
    ? new Date(`${current.startDate}T00:00:00.000Z`)
    : null;

  const matches = await loadCoachEligibleMatches(coachId, { filter: "current_team" });
  const eligibleMatches = matches.length;
  const fixtureIds = matches.map((m) => m.id);

  if (!teamId || fixtureIds.length === 0) {
    return wrap({
      ...emptyBundle("INSUFFICIENT SELECTION STABILITY DATA", eligibleMatches),
    });
  }

  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const rows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
      birthDate: players.birthDate,
    })
    .from(fixturePlayers)
    .innerJoin(players, eq(fixturePlayers.playerId, players.id))
    .where(
      and(inArray(fixturePlayers.fixtureId, fixtureIds), inArray(fixturePlayers.teamId, teamIds)),
    );

  const byFixture = new Map<string, typeof rows>();
  for (const r of rows) {
    const bucket = byFixture.get(r.fixtureId) ?? [];
    bucket.push(r);
    byFixture.set(r.fixtureId, bucket);
  }

  const playerBirthDates = new Map<string, string | null>();
  for (const r of rows) {
    if (!playerBirthDates.has(r.playerId)) {
      playerBirthDates.set(r.playerId, r.birthDate);
    }
  }

  const lineups: SelectionMatchLineup[] = [];
  for (const m of matches) {
    const lineup = byFixture.get(m.id);
    if (!lineup?.length) continue;
    const starterIds = resolveStarters(lineup);
    const benchIds = resolveBench(lineup, starterIds);
    if (starterIds.length < 10) continue;
    lineups.push({
      fixtureId: m.id,
      kickoffAt: m.kickoffAt,
      starters: starterIds,
      bench: benchIds,
      result: m.result,
    });
  }

  // Pre-tenure appearances for this team (debut detection)
  const preTenureTeamPlayerIds = new Set<string>();
  if (tenureStart) {
    const preRows = await db
      .select({ playerId: fixturePlayers.playerId })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
      .where(and(eq(fixturePlayers.teamId, teamId), lt(fixtures.kickoffAt, tenureStart)));
    for (const r of preRows) preTenureTeamPlayerIds.add(r.playerId);
  }

  const result = computeSelectionStability({
    lineups,
    playerBirthDates,
    preTenureTeamPlayerIds,
    eligibleMatches,
  });

  return wrap(result);
}

function resolveStarters(
  lineup: {
    playerId: string;
    squadRole: string | null;
    jerseyNumber: number | null;
  }[],
): string[] {
  const startingRole = lineup.filter((p) => (p.squadRole || "").toLowerCase() === "starting");
  const pool =
    startingRole.length >= 10
      ? startingRole
      : lineup.filter((p) => isStarterRole(p.squadRole, p.jerseyNumber));

  const byPlayer = new Map<string, (typeof lineup)[number]>();
  for (const p of pool) {
    if (!byPlayer.has(p.playerId)) byPlayer.set(p.playerId, p);
  }

  const sorted = [...byPlayer.values()].sort(
    (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99),
  );
  return sorted.slice(0, 15).map((p) => p.playerId);
}

function resolveBench(
  lineup: {
    playerId: string;
    squadRole: string | null;
    jerseyNumber: number | null;
  }[],
  starterIds: string[],
): string[] {
  const starterSet = new Set(starterIds);
  const bench = lineup.filter(
    (p) =>
      !starterSet.has(p.playerId) &&
      (isBenchRole(p.squadRole, p.jerseyNumber) ||
        (p.squadRole || "").toLowerCase() === "substitute"),
  );
  return [...new Set(bench.map((p) => p.playerId))];
}

function wrap(result: SelectionStabilityResult): CoachSelectionStability {
  return {
    ...result,
    matchesWithLineups: result.lineupsAvailable,
    differentCaptains: null,
  };
}

function emptyBundle(message: string, eligibleMatches: number): SelectionStabilityResult {
  return {
    modelVersion: "coach-selection-stability-v1",
    enoughData: false,
    message,
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
    matchesAnalysed: 0,
    lineupTransitions: 0,
    lineupsAvailable: 0,
    eligibleMatches,
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
