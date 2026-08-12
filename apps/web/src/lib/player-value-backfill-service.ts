import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerInjuries,
  playerMatchRatings,
  playerRatingHistory,
  players,
  playerSuspensions,
  playerTeamMemberships,
  playerValueHistory,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  ageAtDate,
  assessValueBackfillCoverage,
  listMonthEndSnapshots,
  membershipCoversDate,
  resolveBackfillMonthCount,
  shouldSkipBackfillForExistingSnapshot,
  yearMonthKey,
  type ValueBackfillPresence,
  type ValueBackfillRangeOption,
} from "./player-value-backfill-math";
import { computePlayerValue, PLAYER_VALUE_MODEL } from "./player-value-math";
import { normalizeSocialAccounts } from "./player-profile-utils";

export type ValueBackfillPeriodPreview = {
  monthKey: string;
  snapshotDateIso: string;
  coveragePct: number;
  canCalculate: boolean;
  confidence: number;
  missingFactors: string[];
  coreMissing: string[];
  skipReason: string | null;
  estimatedValueGbp: number | null;
  ageAtSnapshot: number | null;
  clubName: string | null;
  competitionKey: string | null;
  overallRating: number | null;
  capsAsOf: number;
};

export type ValueBackfillPreviewResult = {
  playerId: string;
  range: ValueBackfillRangeOption;
  monthsRequested: number;
  periodsChecked: number;
  calculablePeriods: number;
  expectedSnapshots: number;
  avgConfidence: number | null;
  missingDataPeriods: string[];
  periods: ValueBackfillPeriodPreview[];
};

export type ValueBackfillRunResult = {
  playerId: string;
  range: ValueBackfillRangeOption;
  inserted: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  insertedDates: string[];
  quality: ValueHistoryQualitySummary;
};

export type ValueHistoryQualitySummary = {
  liveCount: number;
  backfilledCount: number;
  recalculatedCount: number;
  totalCount: number;
  earliest: string | null;
  latest: string | null;
  avgConfidence: number | null;
  coverage24mPct: number;
};

type ResolvedAsOfContext = {
  presence: ValueBackfillPresence;
  age: number | null;
  positionName: string | null;
  clubId: string | null;
  clubName: string | null;
  competitionId: string | null;
  competitionKey: string | null;
  overallRating: number | null;
  formScore: number | null;
  lastFiveMatchRatings: number[];
  capsAsOf: number;
  daysUnavailable: number | null;
  hasSocialPresence: boolean;
  coveragePctFromIntelligence: number | null;
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

async function resolveAsOfContext(playerId: string, asOf: Date): Promise<ResolvedAsOfContext> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const age = ageAtDate(player.birthDate, asOf);
  const positionName = player.positionName;

  const memberships = await db
    .select({
      teamId: playerTeamMemberships.teamId,
      teamName: teams.name,
      type: playerTeamMemberships.membershipType,
      startYear: playerTeamMemberships.startYear,
      endYear: playerTeamMemberships.endYear,
      startDate: playerTeamMemberships.startDate,
      endDate: playerTeamMemberships.endDate,
      isCurrent: playerTeamMemberships.isCurrent,
      competitionId: playerTeamMemberships.competitionId,
    })
    .from(playerTeamMemberships)
    .leftJoin(teams, eq(playerTeamMemberships.teamId, teams.id))
    .where(eq(playerTeamMemberships.playerId, playerId));

  const clubMem =
    memberships.find(
      (m) =>
        (m.type === "club" || m.type === "provincial") &&
        membershipCoversDate({
          startYear: m.startYear,
          endYear: m.endYear,
          startDate: m.startDate,
          endDate: m.endDate,
          isCurrent: m.isCurrent,
          asOf,
        }),
    ) ?? null;

  const windowStart = new Date(asOf);
  windowStart.setUTCMonth(windowStart.getUTCMonth() - 6);

  const matchRows = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      rating: playerMatchRatings.rating,
      competitionId: fixtures.competitionId,
      competitionSlug: competitions.slug,
      competitionName: competitions.name,
      competitionType: competitions.competitionType,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      teamId: playerMatchRatings.teamId,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        eq(playerMatchRatings.playerId, playerId),
        lte(fixtures.kickoffAt, asOf),
        gte(fixtures.kickoffAt, windowStart),
      ),
    )
    .orderBy(asc(fixtures.kickoffAt));

  const domestic = [...matchRows].reverse().find((m) => m.competitionType === "domestic");
  const anyMatch = matchRows[matchRows.length - 1] ?? null;
  const fixtureClubId = domestic?.teamId ?? anyMatch?.teamId ?? null;

  let clubId = clubMem?.teamId ?? fixtureClubId;
  let clubName = clubMem?.teamName ?? null;
  if (clubId && !clubName) {
    const [t] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, clubId)).limit(1);
    clubName = t?.name ?? null;
  }

  let competitionId =
    domestic?.competitionId ?? anyMatch?.competitionId ?? clubMem?.competitionId ?? null;
  let competitionKey =
    domestic?.competitionSlug ??
    domestic?.competitionName ??
    anyMatch?.competitionSlug ??
    anyMatch?.competitionName ??
    null;

  // If membership has competition but no fixture key, resolve slug/name.
  if (!competitionKey && competitionId) {
    const [c] = await db
      .select({ slug: competitions.slug, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    competitionKey = c?.slug ?? c?.name ?? null;
  }

  // Historic rating: closest player_rating_history on/before asOf — never today's OVR.
  const [rh] = await db
    .select({
      overall: playerRatingHistory.overallRating,
      form: playerRatingHistory.form,
      matchDate: playerRatingHistory.matchDate,
      coverage: playerRatingHistory.coverage,
    })
    .from(playerRatingHistory)
    .where(
      and(eq(playerRatingHistory.playerId, playerId), lte(playerRatingHistory.matchDate, asOf)),
    )
    .orderBy(desc(playerRatingHistory.matchDate))
    .limit(1);

  const priorRatings = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      rating: playerMatchRatings.rating,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(
        eq(playerMatchRatings.playerId, playerId),
        lte(fixtures.kickoffAt, asOf),
        sql`${playerMatchRatings.rating} is not null`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(8);

  const lastFiveRaw = [...priorRatings]
    .reverse()
    .slice(-5)
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n));
  const lastFiveMatchRatings = lastFiveRaw.map((n) => (n > 10 ? n / 10 : n));

  let overallRating: number | null = rh?.overall ?? null;
  if (overallRating == null && lastFiveMatchRatings.length >= 3) {
    const avg = lastFiveMatchRatings.reduce((a, b) => a + b, 0) / lastFiveMatchRatings.length;
    overallRating = Math.round(55 + avg * 4);
  }

  const formScore =
    rh?.form ??
    (lastFiveMatchRatings.length >= 3
      ? Math.round(
          55 +
            (lastFiveMatchRatings.reduce((a, b) => a + b, 0) / lastFiveMatchRatings.length) * 4,
        )
      : null);

  // Caps as-of date from linked international fixtures only.
  const [capsRow] = await db
    .select({ caps: sql<number>`count(*)::int` })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        eq(fixturePlayers.playerId, playerId),
        lte(fixtures.kickoffAt, asOf),
        sql`(
          ${competitions.competitionType} in ('international', 'world_cup')
          or ${competitions.slug} ilike '%nations%'
          or ${competitions.slug} ilike '%world-cup%'
          or ${competitions.name} ilike '%nations%'
          or ${competitions.name} ilike '%world cup%'
        )`,
      ),
    );
  const capsAsOf = Number(capsRow?.caps ?? 0);

  // Availability: days unavailable in trailing year ending at asOf.
  const since = new Date(asOf);
  since.setUTCFullYear(since.getUTCFullYear() - 1);

  const injuries = await db
    .select({
      injuryDate: playerInjuries.injuryDate,
      expectedReturnDate: playerInjuries.expectedReturnDate,
      actualReturnDate: playerInjuries.actualReturnDate,
    })
    .from(playerInjuries)
    .where(eq(playerInjuries.playerId, playerId));

  const suspensions = await db
    .select({
      start: playerSuspensions.suspensionStart,
      end: playerSuspensions.suspensionEnd,
    })
    .from(playerSuspensions)
    .where(eq(playerSuspensions.playerId, playerId));

  let daysUnavailable = 0;
  let availabilityObserved = false;
  for (const row of injuries) {
    if (!row.injuryDate) continue;
    const start = new Date(row.injuryDate);
    if (start > asOf || start < since) continue;
    availabilityObserved = true;
    const endRaw = row.actualReturnDate ?? row.expectedReturnDate;
    const end = endRaw ? new Date(endRaw) : asOf;
    daysUnavailable += daysBetween(start < since ? since : start, end > asOf ? asOf : end);
  }
  for (const row of suspensions) {
    if (!row.start) continue;
    const start = new Date(row.start);
    if (start > asOf || start < since) continue;
    availabilityObserved = true;
    const end = row.end ? new Date(row.end) : asOf;
    daysUnavailable += daysBetween(start < since ? since : start, end > asOf ? asOf : end);
  }
  // If no injury/suspension rows ever, treat availability as known (healthy) with data.
  const availabilityKnown = availabilityObserved || (injuries.length === 0 && suspensions.length === 0);

  const social = normalizeSocialAccounts(player.socialAccounts);
  const hasSocialPresence = Boolean(
    social.twitter || social.instagram || social.facebook || social.website,
  );

  const presence: ValueBackfillPresence = {
    age: age != null,
    club: Boolean(clubId),
    competition: Boolean(competitionKey),
    international: capsAsOf > 0,
    rating: overallRating != null,
    form: formScore != null || lastFiveMatchRatings.length >= 3,
    position: Boolean(positionName),
    contract: false, // historic contract unknown unless period-specific data exists
    availability: availabilityKnown,
    potential: false, // never use today's potential for historic points
  };

  return {
    presence,
    age,
    positionName,
    clubId,
    clubName,
    competitionId,
    competitionKey,
    overallRating,
    formScore,
    lastFiveMatchRatings,
    capsAsOf,
    daysUnavailable: availabilityKnown ? daysUnavailable : null,
    hasSocialPresence,
    coveragePctFromIntelligence: rh?.coverage ?? null,
  };
}

function computeForContext(ctx: ResolvedAsOfContext) {
  const assessment = assessValueBackfillCoverage(ctx.presence);
  if (!assessment.canCalculate) {
    return { assessment, result: null as ReturnType<typeof computePlayerValue> | null };
  }

  const result = computePlayerValue({
    currentRating: ctx.overallRating,
    seasonRating: null,
    formScore: ctx.formScore,
    lastFiveMatchRatings: ctx.lastFiveMatchRatings,
    potential: null,
    reputation: null,
    age: ctx.age,
    positionName: ctx.positionName,
    competitionKey: ctx.competitionKey,
    internationalCaps: ctx.capsAsOf,
    contractMonthsRemaining: null,
    daysUnavailableLastYear: ctx.daysUnavailable,
    isCaptain: null,
    hasSocialPresence: ctx.hasSocialPresence,
    mediaNudgePct: null,
  });

  // Prefer coverage-derived confidence (lower when contract unknown).
  result.confidence = Math.min(result.confidence, assessment.confidence);

  return { assessment, result };
}

async function loadExistingSnapshots(playerId: string) {
  const db = getDb();
  const rows = await db
    .select({
      snapshotDate: playerValueHistory.snapshotDate,
      snapshotType: playerValueHistory.snapshotType,
      confidence: playerValueHistory.confidence,
    })
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, playerId))
    .orderBy(asc(playerValueHistory.snapshotDate));

  return rows.map((r) => ({
    snapshotAt: r.snapshotDate,
    snapshotType: r.snapshotType,
    confidence: r.confidence,
  }));
}

export async function getValueHistoryQualitySummary(
  playerId: string,
  now: Date = new Date(),
): Promise<ValueHistoryQualitySummary> {
  const db = getDb();
  const rows = await db
    .select({
      snapshotDate: playerValueHistory.snapshotDate,
      snapshotType: playerValueHistory.snapshotType,
      confidence: playerValueHistory.confidence,
    })
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, playerId))
    .orderBy(asc(playerValueHistory.snapshotDate));

  let liveCount = 0;
  let backfilledCount = 0;
  let recalculatedCount = 0;
  let confSum = 0;
  for (const row of rows) {
    const t = (row.snapshotType ?? "").toUpperCase();
    if (t === "LIVE") liveCount += 1;
    else if (t === "BACKFILLED" || t === "RECONSTRUCTED") backfilledCount += 1;
    else if (t === "RECALCULATED") recalculatedCount += 1;
    confSum += row.confidence ?? 0;
  }

  const rangeStart = new Date(now);
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 24);
  const in24 = rows.filter(
    (r) => r.snapshotDate >= rangeStart && r.snapshotDate <= now,
  ).length;
  // 24 month-ends possible
  const coverage24mPct = Math.round((Math.min(in24, 24) / 24) * 1000) / 10;

  return {
    liveCount,
    backfilledCount,
    recalculatedCount,
    totalCount: rows.length,
    earliest: rows[0]?.snapshotDate?.toISOString() ?? null,
    latest: rows[rows.length - 1]?.snapshotDate?.toISOString() ?? null,
    avgConfidence: rows.length ? Math.round((confSum / rows.length) * 1000) / 1000 : null,
    coverage24mPct,
  };
}

export async function previewPlayerValueHistoryBackfill(
  playerId: string,
  range: ValueBackfillRangeOption = 6,
  options: { now?: Date; includeCurrentMonth?: boolean } = {},
): Promise<ValueBackfillPreviewResult> {
  const now = options.now ?? new Date();
  const monthsRequested = resolveBackfillMonthCount(range);
  const monthEnds = listMonthEndSnapshots({
    now,
    months: monthsRequested,
    includeCurrentMonth: options.includeCurrentMonth ?? false,
  });
  const existing = await loadExistingSnapshots(playerId);

  const periods: ValueBackfillPeriodPreview[] = [];
  for (const asOf of monthEnds) {
    const ctx = await resolveAsOfContext(playerId, asOf);
    const { assessment, result } = computeForContext(ctx);
    const monthKey = yearMonthKey(asOf);
    const collision = shouldSkipBackfillForExistingSnapshot({
      candidateMonthKey: monthKey,
      existing,
    });

    let skipReason: string | null = null;
    if (!assessment.canCalculate) skipReason = "below_threshold";
    else if (collision.skip) skipReason = collision.reason;

    periods.push({
      monthKey,
      snapshotDateIso: asOf.toISOString(),
      coveragePct: assessment.coveragePct,
      canCalculate: assessment.canCalculate,
      confidence: assessment.confidence,
      missingFactors: assessment.missingFactors,
      coreMissing: assessment.coreMissing,
      skipReason,
      estimatedValueGbp: result?.marketValueGbp ?? null,
      ageAtSnapshot: ctx.age,
      clubName: ctx.clubName,
      competitionKey: ctx.competitionKey,
      overallRating: ctx.overallRating,
      capsAsOf: ctx.capsAsOf,
    });
  }

  const calculable = periods.filter((p) => p.canCalculate);
  const expected = periods.filter((p) => p.canCalculate && !p.skipReason);
  const avgConfidence =
    expected.length > 0
      ? Math.round(
          (expected.reduce((s, p) => s + p.confidence, 0) / expected.length) * 1000,
        ) / 1000
      : null;

  return {
    playerId,
    range,
    monthsRequested,
    periodsChecked: periods.length,
    calculablePeriods: calculable.length,
    expectedSnapshots: expected.length,
    avgConfidence,
    missingDataPeriods: periods
      .filter((p) => !p.canCalculate)
      .map((p) => p.monthKey),
    periods,
  };
}

export async function runPlayerValueHistoryBackfill(
  playerId: string,
  range: ValueBackfillRangeOption = 6,
  options: { now?: Date; includeCurrentMonth?: boolean } = {},
): Promise<ValueBackfillRunResult> {
  const preview = await previewPlayerValueHistoryBackfill(playerId, range, options);
  const db = getDb();
  const skippedReasons: Record<string, number> = {};
  const insertedDates: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const period of preview.periods) {
    if (period.skipReason || !period.canCalculate || period.estimatedValueGbp == null) {
      const reason = period.skipReason ?? "below_threshold";
      skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
      skipped += 1;
      continue;
    }

    // Re-check collision against DB at write time (race-safe enough for CMS).
    const existing = await loadExistingSnapshots(playerId);
    const collision = shouldSkipBackfillForExistingSnapshot({
      candidateMonthKey: period.monthKey,
      existing,
    });
    if (collision.skip) {
      skippedReasons[collision.reason ?? "collision"] =
        (skippedReasons[collision.reason ?? "collision"] ?? 0) + 1;
      skipped += 1;
      continue;
    }

    const asOf = new Date(period.snapshotDateIso);
    const ctx = await resolveAsOfContext(playerId, asOf);
    const { assessment, result } = computeForContext(ctx);
    if (!result || !assessment.canCalculate) {
      skippedReasons.below_threshold = (skippedReasons.below_threshold ?? 0) + 1;
      skipped += 1;
      continue;
    }

    await db.insert(playerValueHistory).values({
      playerId,
      snapshotDate: asOf,
      estimatedValue: result.marketValueGbp,
      currency: "GBP",
      confidence: result.confidence,
      coverage: Math.round(assessment.coveragePct),
      overallRating: ctx.overallRating,
      potentialRating: null,
      currentFormScore: ctx.formScore,
      clubId: ctx.clubId,
      competitionId: ctx.competitionId,
      contractEndDate: null,
      contractMonthsRemaining: null,
      ageAtSnapshot: ctx.age,
      primaryPosition: ctx.positionName,
      valueScore: null,
      modelVersion: PLAYER_VALUE_MODEL,
      snapshotType: "BACKFILLED",
      status: "active",
      calculationReason: "MONTHLY_RECONSTRUCTION",
      factorScores: result.factors,
    });

    inserted += 1;
    insertedDates.push(asOf.toISOString());
  }

  const quality = await getValueHistoryQualitySummary(playerId, options.now ?? new Date());

  return {
    playerId,
    range,
    inserted,
    skipped,
    skippedReasons,
    insertedDates,
    quality,
  };
}

/**
 * Admin bulk backfill stub — filters accepted, execution loops player IDs when provided.
 */
export async function bulkPreviewPlayerValueHistoryBackfill(input: {
  playerIds?: string[];
  range?: ValueBackfillRangeOption;
  position?: string | null;
  competitionId?: string | null;
  limit?: number;
}): Promise<{
  status: "stub_ready";
  filters: {
    playerIds: string[];
    range: ValueBackfillRangeOption;
    position: string | null;
    competitionId: string | null;
    limit: number;
  };
  note: string;
}> {
  return {
    status: "stub_ready",
    filters: {
      playerIds: input.playerIds ?? [],
      range: input.range ?? 6,
      position: input.position ?? null,
      competitionId: input.competitionId ?? null,
      limit: input.limit ?? 50,
    },
    note: "Bulk value-history backfill filters accepted. Run per-player backfill from Player CMS for production writes.",
  };
}

