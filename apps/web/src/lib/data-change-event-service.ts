/**
 * Central change-event + affected-entity recalculation queue.
 *
 * LIVE and HISTORICAL paths both emit events. Profiles derive from Rugby365
 * match data — never hand-maintain calculated profile stats.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  dataChangeEvents,
  entityRecalcQueue,
  fixturePlayers,
  fixtures,
} from "@rugby365/db";
import { getDb } from "./db";
import { isFixtureRatingsPublished } from "./match-rating-math";

export type DataChangeEventType =
  | "MATCH_CREATED"
  | "MATCH_UPDATED"
  | "MATCH_COMPLETED"
  | "LINEUP_UPDATED"
  | "PLAYER_STATS_UPDATED"
  | "TEAM_STATS_UPDATED"
  | "PLAYER_RATINGS_UPDATED"
  | "COACH_TENURE_UPDATED"
  | "REFEREE_UPDATED"
  | "RANKING_UPDATED"
  | "HISTORIC_MATCH_BACKFILLED";

export type RecalcEntityType = "player" | "team" | "coach" | "referee" | "competition";

export type RecalcStatus = "stale" | "calculating" | "current" | "partial" | "failed";

export type ImportMethod =
  | "LIVE_FEED"
  | "MANUAL"
  | "WIKIPEDIA"
  | "RUGBYPASS"
  | "PLANET_RUGBY"
  | "OFFICIAL"
  | "OPENAI_ASSISTED"
  | "BACKFILL_JOB"
  | "SYSTEM";

export type AffectedEntity = {
  entityType: RecalcEntityType;
  entityId: string;
  priority?: number;
};

/** Priority bands from the architecture brief. */
export const RECALC_PRIORITY = {
  CURRENT_COMPETITION: 10,
  CURRENT_ENTITIES: 20,
  LAST_5_SEASONS: 40,
  MAJOR_HISTORIC: 60,
  FULL_ARCHIVE: 80,
} as const;

export async function emitDataChangeEvent(input: {
  eventType: DataChangeEventType;
  fixtureId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  source?: string;
  importMethod?: ImportMethod | string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(dataChangeEvents)
    .values({
      eventType: input.eventType,
      fixtureId: input.fixtureId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      source: input.source ?? "system",
      importMethod: input.importMethod ?? null,
      payload: input.payload ?? {},
    })
    .returning({ id: dataChangeEvents.id });
  return row.id;
}

export async function markEntitiesStale(
  entities: AffectedEntity[],
  reason: string,
  options: { eventId?: string | null } = {},
): Promise<number> {
  if (!entities.length) return 0;
  const db = getDb();
  let upserted = 0;
  const now = new Date();

  for (const e of entities) {
    const priority = e.priority ?? RECALC_PRIORITY.CURRENT_ENTITIES;
    const [existing] = await db
      .select({ id: entityRecalcQueue.id, status: entityRecalcQueue.status })
      .from(entityRecalcQueue)
      .where(
        and(
          eq(entityRecalcQueue.entityType, e.entityType),
          eq(entityRecalcQueue.entityId, e.entityId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "calculating") continue;
      await db
        .update(entityRecalcQueue)
        .set({
          status: "stale",
          reason,
          priority: Math.min(priority, RECALC_PRIORITY.CURRENT_ENTITIES),
          lastEventId: options.eventId ?? null,
          error: null,
          updatedAt: now,
        })
        .where(eq(entityRecalcQueue.id, existing.id));
    } else {
      await db.insert(entityRecalcQueue).values({
        entityType: e.entityType,
        entityId: e.entityId,
        status: "stale",
        reason,
        priority,
        lastEventId: options.eventId ?? null,
        updatedAt: now,
      });
    }
    upserted += 1;
  }
  return upserted;
}

/** Resolve teams, players, coaches, referee, competition for a fixture. */
export async function resolveAffectedEntitiesForFixture(
  fixtureId: string,
): Promise<AffectedEntity[]> {
  const db = getDb();
  const [fx] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fx) return [];

  const out: AffectedEntity[] = [];
  const push = (entityType: RecalcEntityType, entityId: string | null | undefined) => {
    if (!entityId) return;
    out.push({ entityType, entityId, priority: RECALC_PRIORITY.CURRENT_ENTITIES });
  };

  push("team", fx.homeTeamId);
  push("team", fx.awayTeamId);
  push("coach", fx.homeCoachId);
  push("coach", fx.awayCoachId);
  push("referee", fx.refereeId);
  push("competition", fx.competitionId);

  // Tenure-based coaches (may differ from FK when historic)
  try {
    const { findCoachesAffectedByFixture } = await import("./coach-match-link-service");
    for (const coachId of await findCoachesAffectedByFixture(fixtureId)) {
      push("coach", coachId);
    }
  } catch {
    /* soft */
  }

  const lineup = await db
    .selectDistinct({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .where(eq(fixturePlayers.fixtureId, fixtureId));
  for (const row of lineup) {
    push("player", row.playerId);
  }

  // Dedupe
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.entityType}:${e.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Primary cascade entry — call after live FT, lineup/stats import, or historic backfill.
 * Marks affected entities STALE and optionally drains immediately.
 */
export async function cascadeFixtureDataChange(input: {
  fixtureId: string;
  eventType: DataChangeEventType;
  source?: string;
  importMethod?: ImportMethod | string | null;
  payload?: Record<string, unknown>;
  /** When true, process queued entities now (live FT path). Default false = queue. */
  processNow?: boolean;
  processLimit?: number;
}): Promise<{
  eventId: string;
  affected: AffectedEntity[];
  queued: number;
  processed?: Awaited<ReturnType<typeof processRecalcQueue>>;
}> {
  const eventId = await emitDataChangeEvent({
    eventType: input.eventType,
    fixtureId: input.fixtureId,
    source: input.source ?? "system",
    importMethod: input.importMethod ?? null,
    payload: input.payload ?? {},
  });

  const affected = await resolveAffectedEntitiesForFixture(input.fixtureId);
  const queued = await markEntitiesStale(affected, `${input.eventType}:${input.fixtureId}`, {
    eventId,
  });

  // Keep coach calc_status in sync with legacy coach pipeline
  try {
    const coachIds = affected.filter((a) => a.entityType === "coach").map((a) => a.entityId);
    if (coachIds.length) {
      const { markCoachesStale } = await import("./coach-match-link-service");
      await markCoachesStale(coachIds, `${input.eventType}:${input.fixtureId}`);
    }
  } catch {
    /* soft */
  }

  if (input.eventType === "MATCH_COMPLETED") {
    try {
      const { tryApplyWorldRankingAfterMatch } = await import(
        "./world-rugby-ranking-calc-service"
      );
      await tryApplyWorldRankingAfterMatch(input.fixtureId);
    } catch {
      /* soft — rankings calc is best-effort */
    }
  }

  await getDb()
    .update(dataChangeEvents)
    .set({ processedAt: new Date() })
    .where(eq(dataChangeEvents.id, eventId));

  let processed: Awaited<ReturnType<typeof processRecalcQueue>> | undefined;
  if (input.processNow) {
    processed = await processRecalcQueue({
      limit: input.processLimit ?? 40,
      entityIds: affected.map((a) => a.entityId),
    });
  }

  return { eventId, affected, queued, processed };
}

export async function setQueueStatus(
  entityType: RecalcEntityType,
  entityId: string,
  status: RecalcStatus,
  extra: { error?: string | null; coverage?: Record<string, unknown> } = {},
) {
  const db = getDb();
  const [row] = await db
    .select({ attempts: entityRecalcQueue.attempts })
    .from(entityRecalcQueue)
    .where(
      and(eq(entityRecalcQueue.entityType, entityType), eq(entityRecalcQueue.entityId, entityId)),
    )
    .limit(1);

  await db
    .update(entityRecalcQueue)
    .set({
      status,
      error: extra.error ?? null,
      ...(extra.coverage ? { coverage: extra.coverage } : {}),
      ...(status === "current" || status === "partial" ? { calculatedAt: new Date() } : {}),
      updatedAt: new Date(),
      ...(status === "calculating" ? { attempts: (row?.attempts ?? 0) + 1 } : {}),
    })
    .where(
      and(eq(entityRecalcQueue.entityType, entityType), eq(entityRecalcQueue.entityId, entityId)),
    );
}

async function recalculateEntity(
  entityType: RecalcEntityType,
  entityId: string,
): Promise<{ status: RecalcStatus; coverage?: Record<string, unknown> }> {
  if (entityType === "coach") {
    const { recalculateCoach } = await import("./coach-recalc-service");
    const result = await recalculateCoach(entityId, {
      refreshLinks: true,
      persistRatings: true,
      overwriteLinks: true,
    });
    return {
      status: result.status === "failed" ? "failed" : result.coverage.partialCareerRecord ? "partial" : "current",
      coverage: result.coverage as unknown as Record<string, unknown>,
    };
  }

  if (entityType === "player") {
    try {
      const { calculateAndPersistPlayerRating } = await import("./player-bio-packet-service");
      await calculateAndPersistPlayerRating(entityId);
    } catch {
      return { status: "partial", coverage: { note: "player rating thin or unavailable" } };
    }
    try {
      const { tryCalculateAndPersistPlayerValueScore } = await import(
        "./player-value-score-service"
      );
      await tryCalculateAndPersistPlayerValueScore(entityId, {
        calculationReason: "data_change_recalc",
      });
    } catch {
      /* value score is best-effort */
    }
    return { status: "current" };
  }

  if (entityType === "team") {
    // Team power/ratings are mostly on-read; standings form is season-scoped.
    return {
      status: "partial",
      coverage: { note: "team derived metrics largely on-read; queued for future persist models" },
    };
  }

  if (entityType === "referee") {
    // Per-match ratings already chained from match rating service; career refresh best-effort
    return { status: "partial", coverage: { note: "referee career aggregate pending full model" } };
  }

  if (entityType === "competition") {
    return { status: "current" };
  }

  return { status: "failed", coverage: { note: "unknown entity type" } };
}

export async function processRecalcQueue(options: {
  limit?: number;
  entityTypes?: RecalcEntityType[];
  entityIds?: string[];
  statuses?: RecalcStatus[];
} = {}): Promise<{
  processed: number;
  results: Array<{ entityType: string; entityId: string; status: RecalcStatus; error?: string }>;
}> {
  const db = getDb();
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const statuses = options.statuses ?? ["stale", "failed"];

  const conditions = [inArray(entityRecalcQueue.status, statuses)];
  if (options.entityTypes?.length) {
    conditions.push(inArray(entityRecalcQueue.entityType, options.entityTypes));
  }
  if (options.entityIds?.length) {
    conditions.push(inArray(entityRecalcQueue.entityId, options.entityIds));
  }

  const rows = await db
    .select()
    .from(entityRecalcQueue)
    .where(and(...conditions))
    .orderBy(asc(entityRecalcQueue.priority), asc(entityRecalcQueue.updatedAt))
    .limit(limit);

  const results: Array<{
    entityType: string;
    entityId: string;
    status: RecalcStatus;
    error?: string;
  }> = [];

  for (const row of rows) {
    const entityType = row.entityType as RecalcEntityType;
    await setQueueStatus(entityType, row.entityId, "calculating");
    try {
      const result = await recalculateEntity(entityType, row.entityId);
      await setQueueStatus(entityType, row.entityId, result.status, {
        coverage: result.coverage,
        error: null,
      });
      results.push({ entityType, entityId: row.entityId, status: result.status });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await setQueueStatus(entityType, row.entityId, "failed", { error: message });
      results.push({ entityType, entityId: row.entityId, status: "failed", error: message });
    }
  }

  return { processed: results.length, results };
}

export async function getRecalcQueueSummary(): Promise<
  Record<string, { stale: number; failed: number; calculating: number; partial: number }>
> {
  const db = getDb();
  const rows = await db
    .select({
      entityType: entityRecalcQueue.entityType,
      status: entityRecalcQueue.status,
      n: sql<number>`count(*)::int`,
    })
    .from(entityRecalcQueue)
    .groupBy(entityRecalcQueue.entityType, entityRecalcQueue.status);

  const out: Record<
    string,
    { stale: number; failed: number; calculating: number; partial: number }
  > = {};
  for (const row of rows) {
    const bucket = (out[row.entityType] ??= {
      stale: 0,
      failed: 0,
      calculating: 0,
      partial: 0,
    });
    if (row.status === "stale") bucket.stale = row.n;
    else if (row.status === "failed") bucket.failed = row.n;
    else if (row.status === "calculating") bucket.calculating = row.n;
    else if (row.status === "partial") bucket.partial = row.n;
  }
  return out;
}

/** Detect MATCH_COMPLETED transition from status change. */
export function didTransitionToCompleted(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  if (!nextStatus) return false;
  if (!isFixtureRatingsPublished(nextStatus)) return false;
  if (!previousStatus) return true;
  return !isFixtureRatingsPublished(previousStatus);
}
