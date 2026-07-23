import { and, desc, eq, sql } from "drizzle-orm";
import {
  dataFieldLocks,
  dataIntegrationAuditLog,
  providerEntityMappings,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSeasonLabel } from "./season-label-utils";
import { mayAutoConfirm, scoreMappingConfidence } from "./provider-mapping-confidence";
import type {
  ConfidenceInput,
  DataIntegrationProvider,
  MappingEntityType,
  MappingStatus,
  MatchReason,
} from "./provider-mapping-types";
import { WHOLE_RECORD_LOCK_FIELD } from "./provider-mapping-types";

export type ProviderMappingRow = typeof providerEntityMappings.$inferSelect;

export type UpsertMappingInput = {
  provider: DataIntegrationProvider | string;
  entityType: MappingEntityType;
  externalId: string;
  rugby365Id?: string | null;
  externalName?: string | null;
  rugby365Name?: string | null;
  status?: MappingStatus;
  confidence?: number;
  matchReason?: MatchReason | Record<string, unknown>;
  conflictStatus?: string | null;
  notes?: string | null;
  extras?: Record<string, unknown>;
  confirmedBy?: string | null;
  userLabel?: string;
};

export async function listProviderMappings(filters: {
  provider?: string;
  entityType?: MappingEntityType;
  status?: MappingStatus;
  rugby365Id?: string;
  limit?: number;
}): Promise<ProviderMappingRow[]> {
  const db = getDb();
  const conditions = [];
  if (filters.provider) {
    conditions.push(eq(providerEntityMappings.provider, filters.provider));
  }
  if (filters.entityType) {
    conditions.push(eq(providerEntityMappings.entityType, filters.entityType));
  }
  if (filters.status) {
    conditions.push(eq(providerEntityMappings.status, filters.status));
  }
  if (filters.rugby365Id) {
    conditions.push(eq(providerEntityMappings.rugby365Id, filters.rugby365Id));
  }

  const query = db
    .select()
    .from(providerEntityMappings)
    .orderBy(desc(providerEntityMappings.updatedAt))
    .limit(filters.limit ?? 200);

  if (conditions.length === 0) return query;
  return query.where(and(...conditions));
}

export async function getProviderMapping(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
}): Promise<ProviderMappingRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, input.provider),
        eq(providerEntityMappings.entityType, input.entityType),
        eq(providerEntityMappings.externalId, String(input.externalId)),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getConfirmedMapping(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
}): Promise<ProviderMappingRow | null> {
  const row = await getProviderMapping(input);
  if (!row || row.status !== "confirmed" || !row.rugby365Id) return null;
  return row;
}

export async function upsertProviderMapping(
  input: UpsertMappingInput,
): Promise<ProviderMappingRow> {
  const db = getDb();
  const externalId = String(input.externalId).trim();
  if (!externalId) throw new Error("externalId is required");

  const existing = await getProviderMapping({
    provider: input.provider,
    entityType: input.entityType,
    externalId,
  });

  const now = new Date();
  const status = input.status ?? existing?.status ?? "unmapped";
  const next = {
    provider: input.provider,
    entityType: input.entityType,
    externalId,
    rugby365Id: input.rugby365Id === undefined ? existing?.rugby365Id ?? null : input.rugby365Id,
    externalName:
      input.externalName === undefined ? existing?.externalName ?? null : input.externalName,
    rugby365Name:
      input.rugby365Name === undefined ? existing?.rugby365Name ?? null : input.rugby365Name,
    status,
    confidence: input.confidence ?? existing?.confidence ?? 0,
    matchReason: (input.matchReason ?? existing?.matchReason ?? {}) as Record<string, unknown>,
    conflictStatus:
      input.conflictStatus === undefined
        ? existing?.conflictStatus ?? null
        : input.conflictStatus,
    notes: input.notes === undefined ? existing?.notes ?? null : input.notes,
    extras: (input.extras ?? existing?.extras ?? {}) as Record<string, unknown>,
    confirmedBy:
      status === "confirmed"
        ? input.confirmedBy ?? existing?.confirmedBy ?? input.userLabel ?? "system"
        : existing?.confirmedBy ?? null,
    confirmedAt: status === "confirmed" ? existing?.confirmedAt ?? now : existing?.confirmedAt ?? null,
    lastCheckedAt: now,
    updatedAt: now,
  };

  const [row] = await db
    .insert(providerEntityMappings)
    .values(next)
    .onConflictDoUpdate({
      target: [
        providerEntityMappings.provider,
        providerEntityMappings.entityType,
        providerEntityMappings.externalId,
      ],
      set: next,
    })
    .returning();

  await writeAuditLog({
    entityType: input.entityType,
    entityId: next.rugby365Id,
    action: existing ? "mapping_updated" : "mapping_created",
    source: input.provider,
    userLabel: input.userLabel ?? "system",
    oldValue: existing ?? null,
    newValue: row,
    mappingId: row.id,
  });

  return row;
}

export async function suggestMapping(
  input: UpsertMappingInput & { confidenceInput: ConfidenceInput },
): Promise<{ mapping: ProviderMappingRow; autoConfirmEligible: boolean }> {
  const scored = scoreMappingConfidence(input.confidenceInput);
  const status: MappingStatus = mayAutoConfirm(scored) ? "suggested" : scored.suggestedStatus;

  const mapping = await upsertProviderMapping({
    ...input,
    status: input.rugby365Id ? status : "unmapped",
    confidence: scored.confidence,
    matchReason: scored.matchReason,
  });

  return { mapping, autoConfirmEligible: mayAutoConfirm(scored) };
}

export async function confirmMapping(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
  rugby365Id: string;
  rugby365Name?: string | null;
  confirmedBy?: string;
  notes?: string;
}): Promise<ProviderMappingRow> {
  if (!input.rugby365Id) throw new Error("rugby365Id is required to confirm a mapping");

  return upsertProviderMapping({
    provider: input.provider,
    entityType: input.entityType,
    externalId: input.externalId,
    rugby365Id: input.rugby365Id,
    rugby365Name: input.rugby365Name,
    status: "confirmed",
    confidence: 100,
    matchReason: { rule: "manual_confirm" },
    conflictStatus: null,
    confirmedBy: input.confirmedBy ?? "admin",
    notes: input.notes,
    userLabel: input.confirmedBy ?? "admin",
  });
}

export async function ignoreMapping(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
  userLabel?: string;
  notes?: string;
}): Promise<ProviderMappingRow> {
  return upsertProviderMapping({
    provider: input.provider,
    entityType: input.entityType,
    externalId: input.externalId,
    status: "ignored",
    notes: input.notes,
    userLabel: input.userLabel ?? "admin",
  });
}

export async function markMappingConflict(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
  conflictStatus?: string;
  userLabel?: string;
  notes?: string;
}): Promise<ProviderMappingRow> {
  return upsertProviderMapping({
    provider: input.provider,
    entityType: input.entityType,
    externalId: input.externalId,
    status: "conflict",
    conflictStatus: input.conflictStatus ?? "open",
    notes: input.notes,
    userLabel: input.userLabel ?? "admin",
  });
}

/**
 * Seed a secondary mapping from an existing on-entity external id.
 * Does not modify the source column — mapping sits alongside it.
 */
export async function seedSecondaryMappingFromExisting(input: {
  provider: string;
  entityType: MappingEntityType;
  externalId: string;
  rugby365Id: string;
  rugby365Name?: string | null;
  externalName?: string | null;
}): Promise<ProviderMappingRow> {
  return upsertProviderMapping({
    provider: input.provider,
    entityType: input.entityType,
    externalId: input.externalId,
    rugby365Id: input.rugby365Id,
    rugby365Name: input.rugby365Name,
    externalName: input.externalName,
    status: "confirmed",
    confidence: 100,
    matchReason: { rule: "seeded_from_existing_column" },
    extras: { seededFrom: "existing_external_column" },
    confirmedBy: "system",
    userLabel: "system",
  });
}

/** Attach API `sea` string to a canonical Rugby365 season label (no DB create). */
export function resolveSeasonLabelFromApi(sea: string): string | null {
  return normalizeSeasonLabel(sea);
}

export async function listFieldLocks(input: {
  entityType: MappingEntityType | string;
  entityId: string;
}): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(dataFieldLocks)
    .where(
      and(
        eq(dataFieldLocks.entityType, input.entityType),
        eq(dataFieldLocks.entityId, input.entityId),
      ),
    );
  return new Set(rows.map((r) => r.field));
}

export async function lockEntityField(input: {
  entityType: string;
  entityId: string;
  field?: string;
  lockedBy?: string;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  const field = input.field?.trim() || WHOLE_RECORD_LOCK_FIELD;
  await db
    .insert(dataFieldLocks)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      field,
      lockedBy: input.lockedBy ?? "admin",
      reason: input.reason,
    })
    .onConflictDoUpdate({
      target: [dataFieldLocks.entityType, dataFieldLocks.entityId, dataFieldLocks.field],
      set: {
        lockedBy: input.lockedBy ?? "admin",
        reason: input.reason,
        lockedAt: new Date(),
      },
    });

  await writeAuditLog({
    entityType: input.entityType,
    entityId: input.entityId,
    field,
    action: "field_locked",
    userLabel: input.lockedBy ?? "admin",
    reason: input.reason,
    newValue: { field, reason: input.reason },
  });
}

export async function unlockEntityField(input: {
  entityType: string;
  entityId: string;
  field?: string;
  userLabel?: string;
}): Promise<void> {
  const db = getDb();
  const field = input.field?.trim() || WHOLE_RECORD_LOCK_FIELD;
  await db
    .delete(dataFieldLocks)
    .where(
      and(
        eq(dataFieldLocks.entityType, input.entityType),
        eq(dataFieldLocks.entityId, input.entityId),
        eq(dataFieldLocks.field, field),
      ),
    );

  await writeAuditLog({
    entityType: input.entityType,
    entityId: input.entityId,
    field,
    action: "field_unlocked",
    userLabel: input.userLabel ?? "admin",
  });
}

export async function writeAuditLog(input: {
  entityType?: string | null;
  entityId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  source?: string | null;
  action: string;
  userLabel?: string;
  reason?: string | null;
  jobId?: string | null;
  rawResponseId?: string | null;
  mappingId?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(dataIntegrationAuditLog).values({
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    field: input.field ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    source: input.source ?? null,
    action: input.action,
    userLabel: input.userLabel ?? "system",
    reason: input.reason ?? null,
    jobId: input.jobId ?? null,
    rawResponseId: input.rawResponseId ?? null,
    mappingId: input.mappingId ?? null,
  });
}

export async function listAuditLog(input: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}) {
  const db = getDb();
  const conditions = [];
  if (input.entityType) {
    conditions.push(eq(dataIntegrationAuditLog.entityType, input.entityType));
  }
  if (input.entityId) {
    conditions.push(eq(dataIntegrationAuditLog.entityId, input.entityId));
  }

  const base = db
    .select()
    .from(dataIntegrationAuditLog)
    .orderBy(desc(dataIntegrationAuditLog.createdAt))
    .limit(input.limit ?? 100);

  if (conditions.length === 0) return base;
  return base.where(and(...conditions));
}

/** Touch last_checked without changing mapping identity. */
export async function touchMappingChecked(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(providerEntityMappings)
    .set({ lastCheckedAt: new Date(), updatedAt: new Date() })
    .where(eq(providerEntityMappings.id, id));
}

export async function countMappingsByStatus(provider?: string) {
  const db = getDb();
  const rows = await db
    .select({
      status: providerEntityMappings.status,
      count: sql<number>`count(*)::int`,
    })
    .from(providerEntityMappings)
    .where(provider ? eq(providerEntityMappings.provider, provider) : undefined)
    .groupBy(providerEntityMappings.status);
  return rows;
}
