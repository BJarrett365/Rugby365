/**
 * Audit Selection Stability for Rassie Erasmus — current primary tenure.
 */
import { and, eq, inArray } from "drizzle-orm";
import { coaches, fixturePlayers } from "@rugby365/db";
import { getCoachDetail } from "../apps/web/src/lib/coach-admin-service";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";
import { getDb } from "../apps/web/src/lib/db";
import { getCoachSelectionStability } from "../apps/web/src/lib/coach-selection-stability-service";

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, "rassie-erasmus")).limit(1);
  if (!coach) {
    console.log("Coach not found");
    return;
  }

  const detail = await getCoachDetail(coach.id);
  const current = detail?.assignments.find((a) => a.isCurrent) ?? null;

  console.log("=== TENURE SCOPE ===");
  console.log({
    coach: coach.fullName,
    team: current?.teamName ?? null,
    role: current?.role ?? null,
    startDate: current?.startDate ?? null,
    teamId: current?.teamId ?? null,
  });

  const matches = await loadCoachEligibleMatches(coach.id, { filter: "current_team" });
  const fixtureIds = matches.map((m) => m.id);
  const teamId = current?.teamId ?? null;

  if (!teamId) {
    console.log("No current team");
    return;
  }

  const allRows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      playerId: fixturePlayers.playerId,
      teamId: fixturePlayers.teamId,
    })
    .from(fixturePlayers)
    .where(inArray(fixturePlayers.fixtureId, fixtureIds));

  const coachTeamRows = allRows.filter((r) => r.teamId === teamId);
  const opponentRows = allRows.filter((r) => r.teamId !== teamId);

  const fixturesWithCoachLineup = new Set(coachTeamRows.map((r) => r.fixtureId));
  const fixturesWithAnyLineup = new Set(allRows.map((r) => r.fixtureId));

  console.log("=== RAW DATA AUDIT ===");
  console.log({
    eligibleMatches: matches.length,
    fixturePlayerRowsCoachTeam: coachTeamRows.length,
    fixturePlayerRowsOpponent: opponentRows.length,
    fixturesWithCoachLineup: fixturesWithCoachLineup.size,
    fixturesWithAnyLineup: fixturesWithAnyLineup.size,
    uniquePlayersCoachTeam: new Set(coachTeamRows.map((r) => r.playerId)).size,
    uniquePlayersAllTeams: new Set(allRows.map((r) => r.playerId)).size,
    oldBugWouldUseAllRows: allRows.length,
  });

  const stability = await getCoachSelectionStability(coach.id);

  // Deep dive: starter counts + sample transitions
  const { isStarterRole, countStarterChanges } = await import(
    "../apps/web/src/lib/coach-selection-stability-engine"
  );
  const { isBenchRole } = await import("../apps/web/src/lib/coach-selection-stability-engine");
  const detailRows = await db
    .select({
      fixtureId: fixturePlayers.fixtureId,
      playerId: fixturePlayers.playerId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
    })
    .from(fixturePlayers)
    .where(and(inArray(fixturePlayers.fixtureId, fixtureIds), eq(fixturePlayers.teamId, teamId)));

  const byFx = new Map<string, typeof detailRows>();
  for (const r of detailRows) {
    const b = byFx.get(r.fixtureId) ?? [];
    b.push(r);
    byFx.set(r.fixtureId, b);
  }

  const starterCounts: number[] = [];
  const dupFixtures: string[] = [];
  for (const [fxId, rows] of byFx) {
    const starters = rows.filter((p) => isStarterRole(p.squadRole, p.jerseyNumber)).map((p) => p.playerId);
    const uniqueStarters = new Set(starters);
    if (starters.length !== uniqueStarters.size) dupFixtures.push(fxId);
    if (uniqueStarters.size >= 10) starterCounts.push(uniqueStarters.size);
  }

  const chronMatches = matches
    .filter((m) => byFx.has(m.id))
    .sort((a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0));

  const sampleChanges: { opponent?: string; changes: number; starters: number }[] = [];
  let prevStarters: Set<string> | null = null;
  for (const m of chronMatches) {
    const rows = byFx.get(m.id)!;
    const starters = [
      ...new Set(
        rows.filter((p) => isStarterRole(p.squadRole, p.jerseyNumber)).map((p) => p.playerId),
      ),
    ];
    if (starters.length < 10) continue;
    const set = new Set(starters);
    if (prevStarters) {
      sampleChanges.push({
        opponent: m.opponentName ?? undefined,
        changes: countStarterChanges(prevStarters, set),
        starters: set.size,
      });
    }
    prevStarters = set;
  }
  sampleChanges.sort((a, b) => b.changes - a.changes);
  const changesOnly = sampleChanges.map((s) => s.changes);
  const medianChanges =
    changesOnly.length > 0
      ? changesOnly.sort((a, b) => a - b)[Math.floor(changesOnly.length / 2)]
      : null;

  console.log("=== LINEUP QUALITY ===");
  console.log({
    avgStartersPerLineup:
      starterCounts.length > 0
        ? Math.round((starterCounts.reduce((a, b) => a + b, 0) / starterCounts.length) * 10) / 10
        : null,
    minStarters: starterCounts.length ? Math.min(...starterCounts) : null,
    maxStarters: starterCounts.length ? Math.max(...starterCounts) : null,
    fixturesWithDuplicateStarterRows: dupFixtures.length,
    squadRoleSamples: [...new Set(detailRows.map((r) => r.squadRole))].slice(0, 10),
    medianXvChanges: medianChanges,
    zeroChangeMatches: changesOnly.filter((c) => c === 0).length,
  });

  console.log("=== TOP 5 HIGHEST XV CHANGES (consecutive) ===");
  console.log(sampleChanges.slice(0, 5));

  console.log("=== NEW ENGINE OUTPUT ===");
  console.log({
    modelVersion: stability.modelVersion,
    enoughData: stability.enoughData,
    message: stability.message,
    stabilityScore: stability.stabilityScore,
    stabilityLabel: stability.stabilityLabel,
    confidencePct: stability.confidencePct,
    playersUsed: stability.playersUsed,
    startersUsed: stability.startersUsed,
    benchOnlyPlayers: stability.benchOnlyPlayers,
    avgStartingXvChanges: stability.avgStartingXvChanges,
    avgBenchChanges: stability.avgBenchChanges,
    unchangedXvPct: stability.unchangedXvPct,
    debutants: stability.debutants,
    avgStartingXvAge: stability.avgStartingXvAge,
    avgBenchAge: stability.avgBenchAge,
    matchesAnalysed: stability.matchesAnalysed,
    lineupTransitions: stability.lineupTransitions,
    lineupsAvailable: stability.lineupsAvailable,
    eligibleMatches: stability.eligibleMatches,
    coveragePct: stability.coveragePct,
    dataIssues: stability.dataIssues,
    components: stability.components,
  });

  console.log("=== WHY OLD UI SHOWED 21.8 / 661 / 47 ===");
  console.log(
    "Old code queried all fixture_players for tenure fixtures without teamId filter,",
  );
  console.log(
    `counting ${allRows.length} rows (${coachTeamRows.length} coach + ${opponentRows.length} opponent) as players/lineup entries.`,
  );
  console.log(
    `Unique players across both teams = ${new Set(allRows.map((r) => r.playerId)).size}; coach team only = ${new Set(coachTeamRows.map((r) => r.playerId)).size}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
