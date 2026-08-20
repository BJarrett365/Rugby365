import { eq } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "./db";
import {
  listFieldLocks,
  lockEntityField,
  writeAuditLog,
} from "./provider-mapping-service";

export type ScoreStatusUpdateInput = {
  homeScore?: number;
  awayScore?: number;
  status?: string;
  userLabel?: string;
  /** When true (default), lock score/status fields after manual save so sync cannot silently undo. */
  lockAfterSave?: boolean;
  reason?: string;
};

export type ScoreStatusUpdateResult = {
  fixture: typeof fixtures.$inferSelect;
  changed: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  lockedFields: string[];
  skippedLocked: string[];
};

/**
 * Manual inline score/status update for Matches CMS.
 * Field locks protect against automatic sync overwrite only — CMS operators
 * can always correct the score line. Audits every change and re-locks after save.
 */
export async function updateFixtureScoreStatus(
  id: string,
  input: ScoreStatusUpdateInput,
): Promise<ScoreStatusUpdateResult> {
  const db = getDb();
  const [existing] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
  if (!existing) throw new Error("Fixture not found");

  const locked = await listFieldLocks({ entityType: "match", entityId: id });
  const userLabel = input.userLabel ?? "admin";
  const changed: ScoreStatusUpdateResult["changed"] = [];
  const patch: Partial<{
    homeScore: number;
    awayScore: number;
    status: string;
  }> = {};

  if (input.homeScore !== undefined) {
    if (!Number.isFinite(input.homeScore) || input.homeScore < 0) {
      throw new Error("Home score must be a non-negative number");
    }
    const next = Math.floor(input.homeScore);
    if (next !== existing.homeScore) {
      patch.homeScore = next;
      changed.push({
        field: "homeScore",
        oldValue: existing.homeScore,
        newValue: next,
      });
    }
  }

  if (input.awayScore !== undefined) {
    if (!Number.isFinite(input.awayScore) || input.awayScore < 0) {
      throw new Error("Away score must be a non-negative number");
    }
    const next = Math.floor(input.awayScore);
    if (next !== existing.awayScore) {
      patch.awayScore = next;
      changed.push({
        field: "awayScore",
        oldValue: existing.awayScore,
        newValue: next,
      });
    }
  }

  if (input.status !== undefined) {
    const status = input.status.trim();
    if (!status) throw new Error("Status is required");
    if (status !== existing.status) {
      patch.status = status;
      changed.push({
        field: "status",
        oldValue: existing.status,
        newValue: status,
      });
    }
  }

  if (changed.length === 0) {
    return {
      fixture: existing,
      changed: [],
      lockedFields: Array.from(locked),
      skippedLocked: [],
    };
  }

  const [fixture] = await db
    .update(fixtures)
    .set(patch)
    .where(eq(fixtures.id, id))
    .returning();

  for (const change of changed) {
    await writeAuditLog({
      entityType: "match",
      entityId: id,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      source: "manual",
      action: "manual_score_status_update",
      userLabel,
      reason: input.reason ?? "Inline CMS score/status update",
    });
  }

  try {
    const { computeAndStoreFixtureBonusPoints } = await import("./fixture-bonus-points-service");
    await computeAndStoreFixtureBonusPoints(id, { persist: true });
  } catch {
    /* non-blocking */
  }

  const nextStatus = patch.status ?? fixture.status;
  try {
    const {
      cascadeFixtureDataChange,
      didTransitionToCompleted,
    } = await import("./data-change-event-service");
    const completed = didTransitionToCompleted(existing.status, nextStatus);
    await cascadeFixtureDataChange({
      fixtureId: id,
      eventType: completed ? "MATCH_COMPLETED" : "MATCH_UPDATED",
      source: "manual",
      importMethod: "MANUAL",
      payload: { changed: changed.map((c) => c.field) },
      // Live FT: queue only — nightly / explicit process drains heavy work.
      processNow: false,
    });
  } catch {
    /* cascade is best-effort */
  }

  const lockAfterSave = input.lockAfterSave !== false;
  if (lockAfterSave) {
    for (const change of changed) {
      await lockEntityField({
        entityType: "match",
        entityId: id,
        field: change.field,
        lockedBy: userLabel,
        reason: "Manual CMS override — protect from automatic sync overwrite",
      });
    }
  }

  const lockedAfter = await listFieldLocks({ entityType: "match", entityId: id });

  return {
    fixture,
    changed,
    lockedFields: Array.from(lockedAfter),
    skippedLocked: [],
  };
}
