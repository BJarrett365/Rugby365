import { desc, eq } from "drizzle-orm";
import { providerRawResponses } from "@rugby365/db";
import { getDb } from "./db";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

export async function captureRawResponse(input: {
  provider?: string;
  endpoint: string;
  entityType?: string;
  externalId?: string;
  requestParams?: Record<string, unknown>;
  responseStatus?: number | null;
  responseTimeMs?: number | null;
  payloadHash?: string | null;
  importStatus?: string;
  errorMessage?: string | null;
  payload?: unknown;
}): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(providerRawResponses)
    .values({
      provider: input.provider ?? PROVIDER_RUGBY_DATA,
      endpoint: input.endpoint,
      entityType: input.entityType ?? null,
      externalId: input.externalId ?? null,
      requestParams: input.requestParams ?? {},
      responseStatus: input.responseStatus ?? null,
      responseTimeMs: input.responseTimeMs ?? null,
      payloadHash: input.payloadHash ?? null,
      importStatus: input.importStatus ?? "captured",
      errorMessage: input.errorMessage ?? null,
      payload: input.payload ?? null,
    })
    .returning({ id: providerRawResponses.id });

  return row.id;
}

export async function getRawResponse(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerRawResponses)
    .where(eq(providerRawResponses.id, id))
    .limit(1);
  return row ?? null;
}

export async function listRawResponses(filters: {
  provider?: string;
  entityType?: string;
  externalId?: string;
  importStatus?: string;
  limit?: number;
}) {
  const db = getDb();
  const { and } = await import("drizzle-orm");
  const conditions = [];
  if (filters.provider) {
    conditions.push(eq(providerRawResponses.provider, filters.provider));
  }
  if (filters.entityType) {
    conditions.push(eq(providerRawResponses.entityType, filters.entityType));
  }
  if (filters.externalId) {
    conditions.push(eq(providerRawResponses.externalId, filters.externalId));
  }
  if (filters.importStatus) {
    conditions.push(eq(providerRawResponses.importStatus, filters.importStatus));
  }

  const base = db
    .select({
      id: providerRawResponses.id,
      provider: providerRawResponses.provider,
      endpoint: providerRawResponses.endpoint,
      entityType: providerRawResponses.entityType,
      externalId: providerRawResponses.externalId,
      requestParams: providerRawResponses.requestParams,
      responseStatus: providerRawResponses.responseStatus,
      responseTimeMs: providerRawResponses.responseTimeMs,
      retrievedAt: providerRawResponses.retrievedAt,
      payloadHash: providerRawResponses.payloadHash,
      importStatus: providerRawResponses.importStatus,
      errorMessage: providerRawResponses.errorMessage,
      // Omit full payload from list for size; fetch via getRawResponse
    })
    .from(providerRawResponses)
    .orderBy(desc(providerRawResponses.retrievedAt))
    .limit(filters.limit ?? 100);

  if (conditions.length === 0) return base;
  return base.where(and(...conditions));
}

export async function markRawResponseImportStatus(
  id: string,
  importStatus: string,
  errorMessage?: string | null,
) {
  const db = getDb();
  await db
    .update(providerRawResponses)
    .set({
      importStatus,
      errorMessage: errorMessage ?? null,
    })
    .where(eq(providerRawResponses.id, id));
}
