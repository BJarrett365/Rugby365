/**
 * Season repair preview + safe apply.
 * Never invent seasons on apply; only attach existing uniquely resolved season rows.
 * Does not change fixture IDs or provider mappings.
 */

import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures } from "@rugby365/db";
import { getDb } from "./db";
import {
  resolveFixtureSeason,
  seasonKindFromCompetitionType,
  type SeasonCandidate,
  type SeasonKind,
} from "./fixture-season-resolve";
import { writeAuditLog } from "./provider-mapping-service";
import { utcDayBoundsFromDateKeys } from "./match-cms-date-bounds";

export type SeasonRepairClassification =
  | "correct"
  | "missing_safe"
  | "wrong_safe"
  | "review"
  | "unmapped";

export type SeasonRepairRow = {
  fixtureId: string;
  slug: string;
  competitionId: string;
  competitionName: string | null;
  competitionType: string | null;
  seasonKind: SeasonKind;
  kickoffAt: string | null;
  currentSeasonId: string | null;
  currentSeasonLabel: string | null;
  proposedSeasonId: string | null;
  proposedSeasonLabel: string | null;
  proposedStartYear: number | null;
  confidence: number;
  reason: string;
  classification: SeasonRepairClassification;
  safeToApply: boolean;
};

export type SeasonRepairPreviewSummary = {
  total: number;
  correct: number;
  missingSafe: number;
  wrongSafe: number;
  review: number;
  unmapped: number;
  safeToApply: number;
};

export type SeasonRepairPreview = {
  filters: {
    competitionId: string;
    fromDate?: string | null;
    toDate?: string | null;
    onlyProblems?: boolean;
  };
  summary: SeasonRepairPreviewSummary;
  rows: SeasonRepairRow[];
};

const SAFE_MIN_CONFIDENCE = 70;

function classifyRow(input: {
  currentSeasonId: string | null;
  proposedSeasonId: string | null;
  needsReview: boolean;
  status: string;
  confidence: number;
}): { classification: SeasonRepairClassification; safeToApply: boolean } {
  const { currentSeasonId, proposedSeasonId, needsReview, status, confidence } = input;

  if (proposedSeasonId && currentSeasonId === proposedSeasonId && !needsReview) {
    return { classification: "correct", safeToApply: false };
  }

  const uniqueResolved =
    status === "resolved" &&
    Boolean(proposedSeasonId) &&
    !needsReview &&
    confidence >= SAFE_MIN_CONFIDENCE;

  if (!uniqueResolved) {
    if (status === "SEASON_UNMAPPED" || !proposedSeasonId) {
      return { classification: "unmapped", safeToApply: false };
    }
    return { classification: "review", safeToApply: false };
  }

  if (!currentSeasonId) {
    return { classification: "missing_safe", safeToApply: true };
  }

  if (currentSeasonId !== proposedSeasonId) {
    return { classification: "wrong_safe", safeToApply: true };
  }

  return { classification: "correct", safeToApply: false };
}

export async function previewSeasonRepair(input: {
  competitionId: string;
  fromDate?: string | null;
  toDate?: string | null;
  onlyProblems?: boolean;
  limit?: number;
}): Promise<SeasonRepairPreview> {
  const competitionId = input.competitionId.trim();
  if (!competitionId) throw new Error("competitionId is required for season repair preview");

  const db = getDb();
  const [comp] = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      competitionType: competitions.competitionType,
    })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!comp) throw new Error("Competition not found");

  const seasonKind = seasonKindFromCompetitionType(comp.competitionType);
  const candidateRows = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      isDeprecated: competitionSeasons.isDeprecated,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));

  const candidates: SeasonCandidate[] = candidateRows;
  const seasonLabelById = Object.fromEntries(candidates.map((c) => [c.id, c.label]));

  const conditions = [eq(fixtures.competitionId, competitionId)];
  if (input.fromDate && input.toDate) {
    const { start, endExclusive } = utcDayBoundsFromDateKeys({
      fromDate: input.fromDate,
      toDate: input.toDate,
    });
    conditions.push(gte(fixtures.kickoffAt, start));
    conditions.push(lt(fixtures.kickoffAt, endExclusive));
  }

  const limit = Math.min(5000, Math.max(1, input.limit ?? 2000));
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      competitionId: fixtures.competitionId,
      kickoffAt: fixtures.kickoffAt,
      seasonId: fixtures.seasonId,
    })
    .from(fixtures)
    .where(and(...conditions))
    .orderBy(fixtures.kickoffAt)
    .limit(limit);

  const rows: SeasonRepairRow[] = [];
  for (const f of fixtureRows) {
    if (!f.competitionId) continue;
    const resolved = resolveFixtureSeason({
      competitionId: f.competitionId,
      kickoffAt: f.kickoffAt,
      seasonKind,
      candidates,
    });
    const { classification, safeToApply } = classifyRow({
      currentSeasonId: f.seasonId,
      proposedSeasonId: resolved.seasonId,
      needsReview: resolved.needsReview,
      status: resolved.status,
      confidence: resolved.confidence,
    });

    if (input.onlyProblems && classification === "correct") continue;

    rows.push({
      fixtureId: f.id,
      slug: f.slug,
      competitionId: f.competitionId,
      competitionName: comp.name,
      competitionType: comp.competitionType,
      seasonKind,
      kickoffAt: f.kickoffAt?.toISOString() ?? null,
      currentSeasonId: f.seasonId,
      currentSeasonLabel: f.seasonId ? seasonLabelById[f.seasonId] ?? null : null,
      proposedSeasonId: resolved.seasonId,
      proposedSeasonLabel: resolved.label,
      proposedStartYear: resolved.startYear,
      confidence: resolved.confidence,
      reason: resolved.reason,
      classification,
      safeToApply,
    });
  }

  const summary: SeasonRepairPreviewSummary = {
    total: rows.length,
    correct: rows.filter((r) => r.classification === "correct").length,
    missingSafe: rows.filter((r) => r.classification === "missing_safe").length,
    wrongSafe: rows.filter((r) => r.classification === "wrong_safe").length,
    review: rows.filter((r) => r.classification === "review").length,
    unmapped: rows.filter((r) => r.classification === "unmapped").length,
    safeToApply: rows.filter((r) => r.safeToApply).length,
  };

  return {
    filters: {
      competitionId,
      fromDate: input.fromDate ?? null,
      toDate: input.toDate ?? null,
      onlyProblems: Boolean(input.onlyProblems),
    },
    summary,
    rows,
  };
}

export async function applySeasonRepairSafe(input: {
  competitionId: string;
  fromDate?: string | null;
  toDate?: string | null;
  fixtureIds?: string[] | null;
  userLabel?: string;
  dryRun?: boolean;
}): Promise<{
  previewed: number;
  applied: number;
  skipped: number;
  dryRun: boolean;
  appliedFixtureIds: string[];
}> {
  const preview = await previewSeasonRepair({
    competitionId: input.competitionId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    onlyProblems: true,
  });

  const idFilter = input.fixtureIds?.length ? new Set(input.fixtureIds) : null;
  const safeRows = preview.rows.filter((r) => {
    if (!r.safeToApply || !r.proposedSeasonId) return false;
    if (idFilter && !idFilter.has(r.fixtureId)) return false;
    return true;
  });

  if (input.dryRun) {
    return {
      previewed: preview.rows.length,
      applied: 0,
      skipped: preview.rows.length - safeRows.length,
      dryRun: true,
      appliedFixtureIds: safeRows.map((r) => r.fixtureId),
    };
  }

  const db = getDb();
  const appliedFixtureIds: string[] = [];

  for (const row of safeRows) {
    if (!row.proposedSeasonId) continue;
    const [updated] = await db
      .update(fixtures)
      .set({ seasonId: row.proposedSeasonId })
      .where(
        and(
          eq(fixtures.id, row.fixtureId),
          eq(fixtures.competitionId, input.competitionId),
          // Only update if still in the expected current state (null or previous wrong id)
          row.currentSeasonId == null
            ? isNull(fixtures.seasonId)
            : eq(fixtures.seasonId, row.currentSeasonId),
        ),
      )
      .returning({ id: fixtures.id });

    if (!updated) continue;

    await writeAuditLog({
      entityType: "fixture",
      entityId: row.fixtureId,
      field: "seasonId",
      oldValue: row.currentSeasonId,
      newValue: row.proposedSeasonId,
      source: "season_repair",
      action: "season_repair_apply",
      userLabel: input.userLabel ?? "admin",
      reason: `${row.classification}:${row.reason}`,
    });
    appliedFixtureIds.push(row.fixtureId);
  }

  return {
    previewed: preview.rows.length,
    applied: appliedFixtureIds.length,
    skipped: preview.rows.length - appliedFixtureIds.length,
    dryRun: false,
    appliedFixtureIds,
  };
}

/** Lightweight null-season counts by competition (for UI picker). */
export async function listSeasonRepairCompetitionStats(): Promise<
  Array<{
    competitionId: string;
    competitionName: string;
    competitionType: string | null;
    totalFixtures: number;
    nullSeasonCount: number;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      competitionId: fixtures.competitionId,
      competitionName: competitions.name,
      competitionType: competitions.competitionType,
      totalFixtures: sql<number>`count(*)::int`,
      nullSeasonCount: sql<number>`count(*) filter (where ${fixtures.seasonId} is null)::int`,
    })
    .from(fixtures)
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(isNotNull(fixtures.competitionId))
    .groupBy(fixtures.competitionId, competitions.name, competitions.competitionType)
    .orderBy(sql`count(*) filter (where ${fixtures.seasonId} is null) desc`);

  return rows
    .filter((r): r is typeof r & { competitionId: string } => Boolean(r.competitionId))
    .map((r) => ({
      competitionId: r.competitionId,
      competitionName: r.competitionName,
      competitionType: r.competitionType,
      totalFixtures: Number(r.totalFixtures),
      nullSeasonCount: Number(r.nullSeasonCount),
    }));
}
