import { desc, eq } from "drizzle-orm";
import { dataIntegrationJobs } from "@rugby365/db";
import { getDb } from "./db";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

export type IntegrationJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type IntegrationJobRow = typeof dataIntegrationJobs.$inferSelect;

export type IntegrationJobProgressPatch = {
  recordsFound?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  conflicts?: number;
  errors?: number;
  preview?: Record<string, unknown>;
  report?: Record<string, unknown>;
};

export async function createIntegrationJob(input: {
  name: string;
  jobType: string;
  provider?: string;
  startedBy?: string;
  preview?: Record<string, unknown>;
}): Promise<IntegrationJobRow> {
  const db = getDb();
  const [row] = await db
    .insert(dataIntegrationJobs)
    .values({
      name: input.name,
      jobType: input.jobType,
      provider: input.provider ?? PROVIDER_RUGBY_DATA,
      status: "queued",
      startedBy: input.startedBy ?? "system",
      preview: input.preview ?? {},
    })
    .returning();
  return row!;
}

export async function startIntegrationJob(jobId: string): Promise<IntegrationJobRow> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .update(dataIntegrationJobs)
    .set({ status: "running", startedAt: now })
    .where(eq(dataIntegrationJobs.id, jobId))
    .returning();
  if (!row) throw new Error(`Job not found: ${jobId}`);
  return row;
}

export async function updateIntegrationJobProgress(
  jobId: string,
  patch: IntegrationJobProgressPatch,
): Promise<IntegrationJobRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dataIntegrationJobs)
    .where(eq(dataIntegrationJobs.id, jobId))
    .limit(1);
  if (!existing) throw new Error(`Job not found: ${jobId}`);

  const nextPreview =
    patch.preview !== undefined
      ? { ...(existing.preview as Record<string, unknown>), ...patch.preview }
      : undefined;
  const nextReport =
    patch.report !== undefined
      ? { ...(existing.report as Record<string, unknown>), ...patch.report }
      : undefined;

  const [row] = await db
    .update(dataIntegrationJobs)
    .set({
      ...(patch.recordsFound !== undefined ? { recordsFound: patch.recordsFound } : {}),
      ...(patch.recordsCreated !== undefined ? { recordsCreated: patch.recordsCreated } : {}),
      ...(patch.recordsUpdated !== undefined ? { recordsUpdated: patch.recordsUpdated } : {}),
      ...(patch.recordsSkipped !== undefined ? { recordsSkipped: patch.recordsSkipped } : {}),
      ...(patch.conflicts !== undefined ? { conflicts: patch.conflicts } : {}),
      ...(patch.errors !== undefined ? { errors: patch.errors } : {}),
      ...(nextPreview !== undefined ? { preview: nextPreview } : {}),
      ...(nextReport !== undefined ? { report: nextReport } : {}),
    })
    .where(eq(dataIntegrationJobs.id, jobId))
    .returning();
  return row!;
}

export async function completeIntegrationJob(
  jobId: string,
  report?: Record<string, unknown>,
): Promise<IntegrationJobRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dataIntegrationJobs)
    .where(eq(dataIntegrationJobs.id, jobId))
    .limit(1);
  if (!existing) throw new Error(`Job not found: ${jobId}`);

  const [row] = await db
    .update(dataIntegrationJobs)
    .set({
      status: "completed",
      finishedAt: new Date(),
      report: report
        ? { ...(existing.report as Record<string, unknown>), ...report }
        : existing.report,
    })
    .where(eq(dataIntegrationJobs.id, jobId))
    .returning();
  return row!;
}

export async function failIntegrationJob(
  jobId: string,
  error: string,
  report?: Record<string, unknown>,
): Promise<IntegrationJobRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dataIntegrationJobs)
    .where(eq(dataIntegrationJobs.id, jobId))
    .limit(1);
  if (!existing) throw new Error(`Job not found: ${jobId}`);

  const [row] = await db
    .update(dataIntegrationJobs)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error,
      report: report
        ? { ...(existing.report as Record<string, unknown>), ...report }
        : existing.report,
    })
    .where(eq(dataIntegrationJobs.id, jobId))
    .returning();
  return row!;
}

export async function getIntegrationJob(jobId: string): Promise<IntegrationJobRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dataIntegrationJobs)
    .where(eq(dataIntegrationJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

export async function listIntegrationJobs(input: {
  jobType?: string;
  provider?: string;
  limit?: number;
} = {}): Promise<IntegrationJobRow[]> {
  const db = getDb();
  const limit = input.limit ?? 20;
  const rows = await db
    .select()
    .from(dataIntegrationJobs)
    .orderBy(desc(dataIntegrationJobs.createdAt))
    .limit(limit);

  return rows.filter((row) => {
    if (input.jobType && row.jobType !== input.jobType) return false;
    if (input.provider && row.provider !== input.provider) return false;
    return true;
  });
}

/** Increment job counters relative to current values. */
export async function bumpIntegrationJobCounters(
  jobId: string,
  delta: Partial<{
    recordsFound: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    conflicts: number;
    errors: number;
  }>,
): Promise<void> {
  const job = await getIntegrationJob(jobId);
  if (!job) return;
  await updateIntegrationJobProgress(jobId, {
    recordsFound: job.recordsFound + (delta.recordsFound ?? 0),
    recordsCreated: job.recordsCreated + (delta.recordsCreated ?? 0),
    recordsUpdated: job.recordsUpdated + (delta.recordsUpdated ?? 0),
    recordsSkipped: job.recordsSkipped + (delta.recordsSkipped ?? 0),
    conflicts: job.conflicts + (delta.conflicts ?? 0),
    errors: job.errors + (delta.errors ?? 0),
  });
}
