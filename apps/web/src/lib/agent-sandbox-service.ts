import { eq, desc, asc } from "drizzle-orm";
import {
  buildMatchReport,
  runCycle,
  type AgentEventOutput,
  type AgentMode,
  type MatchSnapshot,
} from "@rugby365/match-operator-agent";
import { agentSandboxEvents, agentSandboxRuns } from "@rugby365/db";
import { getDb } from "./db";

export const DEFAULT_TEST_MATCH_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";

export async function createSandboxRun(sourceUrl: string, mode: AgentMode = "assisted") {
  const db = getDb();
  const first = await runCycle({
    sourceUrl,
    mode,
    previousSnapshot: null,
    pollNumber: 1,
  });

  const [run] = await db
    .insert(agentSandboxRuns)
    .values({
      matchExternalId: first.snapshot.matchId,
      sourceUrl,
      mode,
      homeTeam: first.snapshot.homeTeam,
      awayTeam: first.snapshot.awayTeam,
      pollCount: 1,
      lastSnapshot: first.snapshot,
      flags: first.flags,
      status: "running",
    })
    .returning();

  await persistSandboxEvents(run.id, first.events, mode, 1);
  return { run, cycle: first };
}

export async function pollSandboxRun(runId: string) {
  const db = getDb();
  const [run] = await db.select().from(agentSandboxRuns).where(eq(agentSandboxRuns.id, runId)).limit(1);
  if (!run) throw new Error("Run not found");

  const previousSnapshot = (run.lastSnapshot ?? null) as MatchSnapshot | null;
  const pollNumber = run.pollCount + 1;

  const cycle = await runCycle({
    sourceUrl: run.sourceUrl,
    mode: run.mode as AgentMode,
    previousSnapshot,
    pollNumber,
  });

  const mergedFlags = Array.from(new Set([...(run.flags as string[]), ...cycle.flags]));

  await db
    .update(agentSandboxRuns)
    .set({
      pollCount: pollNumber,
      lastSnapshot: cycle.snapshot,
      flags: mergedFlags,
    })
    .where(eq(agentSandboxRuns.id, runId));

  await persistSandboxEvents(runId, cycle.events, run.mode as AgentMode, pollNumber);

  return cycle;
}

async function persistSandboxEvents(
  runId: string,
  events: AgentEventOutput[],
  mode: AgentMode,
  pollNumber: number,
) {
  if (!events.length) return;
  const db = getDb();
  const existing = await db
    .select({ sequenceNo: agentSandboxEvents.sequenceNo })
    .from(agentSandboxEvents)
    .where(eq(agentSandboxEvents.runId, runId))
    .orderBy(desc(agentSandboxEvents.sequenceNo))
    .limit(1);
  let seq = existing[0]?.sequenceNo ?? 0;

  for (const event of events) {
    seq += 1;
    const approvalStatus =
      mode === "observer"
        ? "logged_only"
        : mode === "auto" && !event.requires_approval
          ? "auto_accepted"
          : "pending";

    await db.insert(agentSandboxEvents).values({
      runId,
      sequenceNo: seq,
      eventOutput: event,
      approvalStatus,
    });
  }

  void pollNumber;
}

export async function listSandboxRuns() {
  const db = getDb();
  return db.select().from(agentSandboxRuns).orderBy(desc(agentSandboxRuns.startedAt)).limit(20);
}

export async function listSandboxEvents(runId: string) {
  const db = getDb();
  return db
    .select()
    .from(agentSandboxEvents)
    .where(eq(agentSandboxEvents.runId, runId))
    .orderBy(asc(agentSandboxEvents.sequenceNo));
}

export async function approveSandboxEvent(eventId: string, status: "approved" | "rejected", note?: string) {
  const db = getDb();
  const [row] = await db
    .update(agentSandboxEvents)
    .set({ approvalStatus: status, operatorNote: note })
    .where(eq(agentSandboxEvents.id, eventId))
    .returning();
  return row;
}

export async function buildSandboxReport(runId: string) {
  const db = getDb();
  const [run] = await db.select().from(agentSandboxRuns).where(eq(agentSandboxRuns.id, runId)).limit(1);
  if (!run) throw new Error("Run not found");
  const events = await listSandboxEvents(runId);
  const snapshot = run.lastSnapshot as MatchSnapshot;
  return buildMatchReport(
    snapshot,
    events.map((e) => e.eventOutput as AgentEventOutput),
    { mode: run.mode as AgentMode, runId: run.id, pollCount: run.pollCount },
  );
}
