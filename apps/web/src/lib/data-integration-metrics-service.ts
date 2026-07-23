import { eq, sql } from "drizzle-orm";
import { dataIntegrationMetrics } from "@rugby365/db";
import { getDb } from "./db";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordProviderRequestMetric(input: {
  provider?: string;
  ok: boolean;
  responseTimeMs: number;
  errorMessage?: string | null;
  rateLimitStatus?: string | null;
}): Promise<void> {
  const db = getDb();
  const provider = input.provider ?? PROVIDER_RUGBY_DATA;
  const metricDate = todayUtcDate();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(dataIntegrationMetrics)
    .where(
      sql`${dataIntegrationMetrics.provider} = ${provider} AND ${dataIntegrationMetrics.metricDate} = ${metricDate}`,
    )
    .limit(1);

  if (!existing) {
    await db.insert(dataIntegrationMetrics).values({
      provider,
      metricDate,
      totalRequests: 1,
      successfulRequests: input.ok ? 1 : 0,
      failedRequests: input.ok ? 0 : 1,
      totalResponseTimeMs: input.responseTimeMs,
      lastSuccessAt: input.ok ? now : null,
      lastFailureAt: input.ok ? null : now,
      lastErrorMessage: input.ok ? null : input.errorMessage ?? null,
      rateLimitStatus: input.rateLimitStatus ?? null,
      updatedAt: now,
    });
    return;
  }

  await db
    .update(dataIntegrationMetrics)
    .set({
      totalRequests: sql`${dataIntegrationMetrics.totalRequests} + 1`,
      successfulRequests: input.ok
        ? sql`${dataIntegrationMetrics.successfulRequests} + 1`
        : dataIntegrationMetrics.successfulRequests,
      failedRequests: input.ok
        ? dataIntegrationMetrics.failedRequests
        : sql`${dataIntegrationMetrics.failedRequests} + 1`,
      totalResponseTimeMs: sql`${dataIntegrationMetrics.totalResponseTimeMs} + ${input.responseTimeMs}`,
      lastSuccessAt: input.ok ? now : existing.lastSuccessAt,
      lastFailureAt: input.ok ? existing.lastFailureAt : now,
      lastErrorMessage: input.ok ? existing.lastErrorMessage : input.errorMessage ?? null,
      rateLimitStatus: input.rateLimitStatus ?? existing.rateLimitStatus,
      updatedAt: now,
    })
    .where(eq(dataIntegrationMetrics.id, existing.id));
}

export async function getProviderMetricsToday(provider = PROVIDER_RUGBY_DATA) {
  const db = getDb();
  const metricDate = todayUtcDate();
  const [row] = await db
    .select()
    .from(dataIntegrationMetrics)
    .where(
      sql`${dataIntegrationMetrics.provider} = ${provider} AND ${dataIntegrationMetrics.metricDate} = ${metricDate}`,
    )
    .limit(1);
  return row ?? null;
}

export async function getProviderHealthSummary(provider = PROVIDER_RUGBY_DATA) {
  const today = await getProviderMetricsToday(provider);
  const avgResponseTimeMs =
    today && today.totalRequests > 0
      ? Math.round(today.totalResponseTimeMs / today.totalRequests)
      : null;

  let status: "connected" | "warning" | "failed" | "not_configured" = "not_configured";
  if (today) {
    if (today.failedRequests > 0 && today.successfulRequests === 0) status = "failed";
    else if (today.failedRequests > 0) status = "warning";
    else if (today.successfulRequests > 0) status = "connected";
  }

  return {
    provider,
    status,
    metricDate: today?.metricDate ?? todayUtcDate(),
    totalRequests: today?.totalRequests ?? 0,
    successfulRequests: today?.successfulRequests ?? 0,
    failedRequests: today?.failedRequests ?? 0,
    averageResponseTimeMs: avgResponseTimeMs,
    lastSuccessAt: today?.lastSuccessAt ?? null,
    lastFailureAt: today?.lastFailureAt ?? null,
    lastErrorMessage: today?.lastErrorMessage ?? null,
    rateLimitStatus: today?.rateLimitStatus ?? null,
  };
}
