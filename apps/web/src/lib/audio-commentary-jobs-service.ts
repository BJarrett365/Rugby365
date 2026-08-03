/**
 * Lightweight queue helpers for audio commentary jobs (Phase 3 scaffolding).
 */

import { and, asc, eq } from "drizzle-orm";
import { audioCommentaryJobs } from "@rugby365/db";
import { getDb } from "./db";

export async function enqueueAudioCommentaryJob(input: {
  fixtureId: string;
  scriptId?: string | null;
  jobType: "tts" | "mix" | "publish";
  payload?: Record<string, unknown>;
}) {
  const db = getDb();
  const [row] = await db
    .insert(audioCommentaryJobs)
    .values({
      fixtureId: input.fixtureId,
      scriptId: input.scriptId ?? null,
      jobType: input.jobType,
      status: "queued",
      payload: input.payload ?? {},
    })
    .returning();
  return row!;
}

export async function listQueuedAudioCommentaryJobs(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(audioCommentaryJobs)
    .where(eq(audioCommentaryJobs.status, "queued"))
    .orderBy(asc(audioCommentaryJobs.createdAt))
    .limit(limit);
}

export async function listAudioCommentaryJobsForFixture(fixtureId: string) {
  const db = getDb();
  return db
    .select({
      id: audioCommentaryJobs.id,
      fixtureId: audioCommentaryJobs.fixtureId,
      scriptId: audioCommentaryJobs.scriptId,
      jobType: audioCommentaryJobs.jobType,
      status: audioCommentaryJobs.status,
      error: audioCommentaryJobs.error,
      createdAt: audioCommentaryJobs.createdAt,
      updatedAt: audioCommentaryJobs.updatedAt,
      // payload omitted from list — may contain storage paths (admin detail view later)
    })
    .from(audioCommentaryJobs)
    .where(eq(audioCommentaryJobs.fixtureId, fixtureId))
    .orderBy(asc(audioCommentaryJobs.createdAt));
}

export async function markAudioCommentaryJob(
  jobId: string,
  update: { status: string; error?: string | null },
) {
  const db = getDb();
  await db
    .update(audioCommentaryJobs)
    .set({
      status: update.status,
      error: update.error ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(audioCommentaryJobs.id, jobId)));
}
