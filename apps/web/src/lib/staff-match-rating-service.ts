/**
 * Coach / Referee Match Ratings (1–10) after full time.
 * Separate from player match-v1 and career intelligence scores.
 */
import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  coachMatchRatings,
  coaches,
  fixtures,
  matchEvents,
  refereeMatchRatings,
  referees,
  teamCoachingStaff,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeCoachingRole } from "./coach-types";
import {
  formatMatchRatingDisplay,
  isFixtureRatingsPublished,
  performanceTrendLabel,
  type MatchRatingStatus,
  type PerformanceBand,
  type PerformanceTrend,
} from "./match-rating-math";
import {
  COACH_MATCH_RATING_MODEL,
  REFEREE_MATCH_RATING_MODEL,
  computeCoachMatchRating,
  computeRefereeMatchRating,
  staffPerformanceTrend,
  type StaffMatchSide,
} from "./staff-match-rating-math";

export type StaffMatchRatingDisplay = {
  entityType: "coach" | "referee";
  entityId: string;
  entityName: string;
  entitySlug: string;
  teamId: string | null;
  teamName: string | null;
  side: StaffMatchSide | null;
  rating: number | null;
  ratingStatus: MatchRatingStatus;
  modelVersion: string;
  performanceBand: PerformanceBand | null;
  ratingLabel: string;
  ratingExplanation: string | null;
  positiveImpacts: string[];
  deductions: string[];
  matchContext: string[];
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: PerformanceTrend | null;
  performanceTrendLabel: string;
};

export type FixtureStaffRatingsBundle = {
  fixtureId: string;
  coaches: StaffMatchRatingDisplay[];
  referee: StaffMatchRatingDisplay | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function countCards(
  events: Array<{ eventType: string; teamId: string | null }>,
  teamId: string | null,
): { yellow: number; red: number } {
  let yellow = 0;
  let red = 0;
  for (const e of events) {
    if (teamId && e.teamId && e.teamId !== teamId) continue;
    const t = e.eventType.toLowerCase();
    if (t.includes("red")) red += 1;
    else if (t.includes("yellow") || t.includes("sin")) yellow += 1;
  }
  return { yellow, red };
}

function countPenaltyEvents(events: Array<{ eventType: string }>): number {
  return events.filter((e) => {
    const t = e.eventType.toLowerCase();
    return t.includes("penalty") && !t.includes("try") && !t.includes("goal");
  }).length;
}

async function upsertCoachRating(input: {
  fixtureId: string;
  coachId: string;
  teamId: string | null;
  side: StaffMatchSide;
  competitionId: string | null;
  seasonId: string | null;
  computed: ReturnType<typeof computeCoachMatchRating>;
  previousFixtureId: string | null;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: PerformanceTrend;
}) {
  const db = getDb();
  const status: MatchRatingStatus = "final";
  const [existing] = await db
    .select({ id: coachMatchRatings.id, manualOverrideRating: coachMatchRatings.manualOverrideRating })
    .from(coachMatchRatings)
    .where(
      and(
        eq(coachMatchRatings.fixtureId, input.fixtureId),
        eq(coachMatchRatings.coachId, input.coachId),
      ),
    )
    .limit(1);

  const ratingValue = existing?.manualOverrideRating ?? input.computed.rating;
  const payload = {
    teamId: input.teamId,
    side: input.side,
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    rating: ratingValue,
    ratingStatus: status,
    modelVersion: COACH_MATCH_RATING_MODEL,
    performanceBand: input.computed.band,
    ratingExplanation: input.computed.explanation,
    positiveImpacts: input.computed.positiveImpacts,
    deductions: input.computed.deductions,
    matchContext: input.computed.matchContext,
    previousFixtureId: input.previousFixtureId,
    previousRating: input.previousRating,
    ratingChange: input.ratingChange,
    performanceTrend: input.performanceTrend,
    sourceProvider: "rugby365",
    calculatedAt: new Date(),
    recalculatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(coachMatchRatings).set(payload).where(eq(coachMatchRatings.id, existing.id));
  } else {
    await db.insert(coachMatchRatings).values({
      fixtureId: input.fixtureId,
      coachId: input.coachId,
      ...payload,
    });
  }
}

async function upsertRefereeRating(input: {
  fixtureId: string;
  refereeId: string;
  competitionId: string | null;
  seasonId: string | null;
  computed: ReturnType<typeof computeRefereeMatchRating>;
  previousFixtureId: string | null;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: PerformanceTrend;
}) {
  const db = getDb();
  const status: MatchRatingStatus = "final";
  const [existing] = await db
    .select({
      id: refereeMatchRatings.id,
      manualOverrideRating: refereeMatchRatings.manualOverrideRating,
    })
    .from(refereeMatchRatings)
    .where(
      and(
        eq(refereeMatchRatings.fixtureId, input.fixtureId),
        eq(refereeMatchRatings.refereeId, input.refereeId),
      ),
    )
    .limit(1);

  const ratingValue = existing?.manualOverrideRating ?? input.computed.rating;
  const payload = {
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    rating: ratingValue,
    ratingStatus: status,
    modelVersion: REFEREE_MATCH_RATING_MODEL,
    performanceBand: input.computed.band,
    ratingExplanation: input.computed.explanation,
    positiveImpacts: input.computed.positiveImpacts,
    deductions: input.computed.deductions,
    matchContext: input.computed.matchContext,
    previousFixtureId: input.previousFixtureId,
    previousRating: input.previousRating,
    ratingChange: input.ratingChange,
    performanceTrend: input.performanceTrend,
    sourceProvider: "rugby365",
    calculatedAt: new Date(),
    recalculatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(refereeMatchRatings)
      .set(payload)
      .where(eq(refereeMatchRatings.id, existing.id));
  } else {
    await db.insert(refereeMatchRatings).values({
      fixtureId: input.fixtureId,
      refereeId: input.refereeId,
      ...payload,
    });
  }
}

async function resolveCurrentTeamCoachId(teamId: string | null): Promise<string | null> {
  if (!teamId) return null;
  const db = getDb();
  const rows = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      role: teamCoachingStaff.role,
      isCurrent: teamCoachingStaff.isCurrent,
    })
    .from(teamCoachingStaff)
    .where(and(eq(teamCoachingStaff.teamId, teamId), eq(teamCoachingStaff.isCurrent, true)));

  const ranked = rows
    .map((r) => ({ coachId: r.coachId, role: normalizeCoachingRole(r.role) }))
    .sort((a, b) => {
      const rank = (role: string) =>
        role === "head_coach" ? 0 : role === "director_of_rugby" ? 1 : 2;
      return rank(a.role) - rank(b.role);
    });
  return ranked[0]?.coachId ?? null;
}

/** Fill missing fixture coach FKs from current team staff (for match header + Rating Lab). */
export async function ensureFixtureStaffLinks(fixtureId: string): Promise<typeof fixtures.$inferSelect | null> {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return null;

  const patch: {
    homeCoachId?: string;
    awayCoachId?: string;
  } = {};

  if (!fixture.homeCoachId) {
    const id = await resolveCurrentTeamCoachId(fixture.homeTeamId);
    if (id) patch.homeCoachId = id;
  }
  if (!fixture.awayCoachId) {
    const id = await resolveCurrentTeamCoachId(fixture.awayTeamId);
    if (id) patch.awayCoachId = id;
  }

  if (Object.keys(patch).length === 0) return fixture;

  const [updated] = await db
    .update(fixtures)
    .set(patch)
    .where(eq(fixtures.id, fixtureId))
    .returning();
  return updated ?? fixture;
}

/** Calculate coach + referee match ratings for a completed fixture. */
export async function calculateAndPersistFixtureStaffMatchRatings(fixtureId: string): Promise<{
  coachesCalculated: number;
  refereeCalculated: number;
}> {
  const db = getDb();
  const fixture = await ensureFixtureStaffLinks(fixtureId);
  if (!fixture || !isFixtureRatingsPublished(fixture.status)) {
    return { coachesCalculated: 0, refereeCalculated: 0 };
  }

  const events = await db
    .select({
      eventType: matchEvents.eventType,
      teamId: matchEvents.teamId,
    })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));

  const teamStats = await db
    .select()
    .from(teamMatchStats)
    .where(eq(teamMatchStats.fixtureId, fixtureId));

  const homeStats = teamStats.find((r) => r.side === "home") ?? null;
  const awayStats = teamStats.find((r) => r.side === "away") ?? null;

  let coachesCalculated = 0;
  const coachSlots: Array<{
    coachId: string | null;
    teamId: string | null;
    side: StaffMatchSide;
  }> = [
    { coachId: fixture.homeCoachId, teamId: fixture.homeTeamId, side: "home" },
    { coachId: fixture.awayCoachId, teamId: fixture.awayTeamId, side: "away" },
  ];

  for (const slot of coachSlots) {
    if (!slot.coachId) continue;
    const own = slot.side === "home" ? homeStats : awayStats;
    const opp = slot.side === "home" ? awayStats : homeStats;
    const cards = countCards(events, slot.teamId);
    const computed = computeCoachMatchRating({
      side: slot.side,
      homeScore: fixture.homeScore ?? 0,
      awayScore: fixture.awayScore ?? 0,
      teamTries: own?.tries ?? 0,
      oppTries: opp?.tries ?? 0,
      teamMetres: own?.metres ?? 0,
      oppMetres: opp?.metres ?? 0,
      teamTackles: own?.tackles ?? 0,
      teamTurnoversWon: own?.turnoversWon ?? 0,
      yellowCards: cards.yellow,
      redCards: cards.red,
    });

    const prevConditions = [
      eq(coachMatchRatings.coachId, slot.coachId),
      ne(coachMatchRatings.fixtureId, fixtureId),
      sql`${coachMatchRatings.rating} is not null`,
    ];
    if (fixture.competitionId) {
      prevConditions.push(eq(coachMatchRatings.competitionId, fixture.competitionId));
    }
    const [previous] = await db
      .select({
        fixtureId: coachMatchRatings.fixtureId,
        rating: coachMatchRatings.rating,
      })
      .from(coachMatchRatings)
      .innerJoin(fixtures, eq(coachMatchRatings.fixtureId, fixtures.id))
      .where(and(...prevConditions))
      .orderBy(desc(fixtures.kickoffAt))
      .limit(1);

    const trend = staffPerformanceTrend(previous?.rating, computed.rating);
    await upsertCoachRating({
      fixtureId,
      coachId: slot.coachId,
      teamId: slot.teamId,
      side: slot.side,
      competitionId: fixture.competitionId,
      seasonId: fixture.seasonId,
      computed,
      previousFixtureId: previous?.fixtureId ?? null,
      previousRating: previous?.rating ?? null,
      ratingChange: trend.change,
      performanceTrend: trend.trend,
    });
    coachesCalculated += 1;
  }

  let refereeCalculated = 0;
  if (fixture.refereeId) {
    const allCards = countCards(events, null);
    const computed = computeRefereeMatchRating({
      homeScore: fixture.homeScore ?? 0,
      awayScore: fixture.awayScore ?? 0,
      yellowCards: allCards.yellow,
      redCards: allCards.red,
      penaltyEvents: countPenaltyEvents(events),
    });

    const prevConditions = [
      eq(refereeMatchRatings.refereeId, fixture.refereeId),
      ne(refereeMatchRatings.fixtureId, fixtureId),
      sql`${refereeMatchRatings.rating} is not null`,
    ];
    if (fixture.competitionId) {
      prevConditions.push(eq(refereeMatchRatings.competitionId, fixture.competitionId));
    }
    const [previous] = await db
      .select({
        fixtureId: refereeMatchRatings.fixtureId,
        rating: refereeMatchRatings.rating,
      })
      .from(refereeMatchRatings)
      .innerJoin(fixtures, eq(refereeMatchRatings.fixtureId, fixtures.id))
      .where(and(...prevConditions))
      .orderBy(desc(fixtures.kickoffAt))
      .limit(1);

    const trend = staffPerformanceTrend(previous?.rating, computed.rating);
    await upsertRefereeRating({
      fixtureId,
      refereeId: fixture.refereeId,
      competitionId: fixture.competitionId,
      seasonId: fixture.seasonId,
      computed,
      previousFixtureId: previous?.fixtureId ?? null,
      previousRating: previous?.rating ?? null,
      ratingChange: trend.change,
      performanceTrend: trend.trend,
    });
    refereeCalculated = 1;
  }

  return { coachesCalculated, refereeCalculated };
}

export async function listStaffMatchRatingsForFixture(
  fixtureId: string,
): Promise<FixtureStaffRatingsBundle> {
  const db = getDb();
  const coachRows = await db
    .select({
      rating: coachMatchRatings,
      coachName: coaches.name,
      coachSlug: coaches.slug,
      teamName: teams.name,
    })
    .from(coachMatchRatings)
    .innerJoin(coaches, eq(coachMatchRatings.coachId, coaches.id))
    .leftJoin(teams, eq(coachMatchRatings.teamId, teams.id))
    .where(eq(coachMatchRatings.fixtureId, fixtureId));

  const [refRow] = await db
    .select({
      rating: refereeMatchRatings,
      refereeName: referees.name,
      refereeSlug: referees.slug,
    })
    .from(refereeMatchRatings)
    .innerJoin(referees, eq(refereeMatchRatings.refereeId, referees.id))
    .where(eq(refereeMatchRatings.fixtureId, fixtureId))
    .limit(1);

  const coachesOut: StaffMatchRatingDisplay[] = coachRows.map((row) => {
    const status = row.rating.ratingStatus as MatchRatingStatus;
    const rating = row.rating.manualOverrideRating ?? row.rating.rating;
    const trend = (row.rating.performanceTrend as PerformanceTrend | null) ?? null;
    return {
      entityType: "coach",
      entityId: row.rating.coachId,
      entityName: row.coachName,
      entitySlug: row.coachSlug,
      teamId: row.rating.teamId,
      teamName: row.teamName ?? null,
      side: (row.rating.side as StaffMatchSide) ?? null,
      rating,
      ratingStatus: status,
      modelVersion: row.rating.modelVersion,
      performanceBand: (row.rating.performanceBand as PerformanceBand | null) ?? null,
      ratingLabel: formatMatchRatingDisplay(rating, status),
      ratingExplanation: row.rating.ratingExplanation,
      positiveImpacts: asStringArray(row.rating.positiveImpacts),
      deductions: asStringArray(row.rating.deductions),
      matchContext: asStringArray(row.rating.matchContext),
      previousRating: row.rating.previousRating,
      ratingChange: row.rating.ratingChange,
      performanceTrend: trend,
      performanceTrendLabel: performanceTrendLabel(trend, row.rating.ratingChange),
    };
  });

  // Home first
  coachesOut.sort((a, b) => {
    if (a.side === b.side) return 0;
    if (a.side === "home") return -1;
    if (b.side === "home") return 1;
    return 0;
  });

  const referee: StaffMatchRatingDisplay | null = refRow
    ? (() => {
        const status = refRow.rating.ratingStatus as MatchRatingStatus;
        const rating = refRow.rating.manualOverrideRating ?? refRow.rating.rating;
        const trend = (refRow.rating.performanceTrend as PerformanceTrend | null) ?? null;
        return {
          entityType: "referee" as const,
          entityId: refRow.rating.refereeId,
          entityName: refRow.refereeName,
          entitySlug: refRow.refereeSlug,
          teamId: null,
          teamName: null,
          side: null,
          rating,
          ratingStatus: status,
          modelVersion: refRow.rating.modelVersion,
          performanceBand: (refRow.rating.performanceBand as PerformanceBand | null) ?? null,
          ratingLabel: formatMatchRatingDisplay(rating, status),
          ratingExplanation: refRow.rating.ratingExplanation,
          positiveImpacts: asStringArray(refRow.rating.positiveImpacts),
          deductions: asStringArray(refRow.rating.deductions),
          matchContext: asStringArray(refRow.rating.matchContext),
          previousRating: refRow.rating.previousRating,
          ratingChange: refRow.rating.ratingChange,
          performanceTrend: trend,
          performanceTrendLabel: performanceTrendLabel(trend, refRow.rating.ratingChange),
        };
      })()
    : null;

  return { fixtureId, coaches: coachesOut, referee };
}

export type StaffRatingLabRow = {
  id: string;
  entityType: "coach" | "referee";
  fixtureId: string;
  entityId: string;
  entitySlug: string;
  entityName: string;
  teamName: string | null;
  side: string | null;
  fixtureSlug: string;
  kickoffAt: Date | null;
  rating: number | null;
  previousRating: number | null;
  ratingChange: number | null;
  performanceTrend: string | null;
  ratingStatus: string;
  modelVersion: string;
  flags: string[];
};

export async function listStaffRatingLabRows(limit = 80): Promise<StaffRatingLabRow[]> {
  const db = getDb();
  const half = Math.max(10, Math.floor(limit / 2));

  const coachRows = await db
    .select({
      rating: coachMatchRatings,
      entityName: coaches.name,
      entitySlug: coaches.slug,
      teamName: teams.name,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(coachMatchRatings)
    .innerJoin(coaches, eq(coachMatchRatings.coachId, coaches.id))
    .leftJoin(teams, eq(coachMatchRatings.teamId, teams.id))
    .innerJoin(fixtures, eq(coachMatchRatings.fixtureId, fixtures.id))
    .orderBy(desc(fixtures.kickoffAt), desc(coachMatchRatings.rating))
    .limit(half);

  const refRows = await db
    .select({
      rating: refereeMatchRatings,
      entityName: referees.name,
      entitySlug: referees.slug,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(refereeMatchRatings)
    .innerJoin(referees, eq(refereeMatchRatings.refereeId, referees.id))
    .innerJoin(fixtures, eq(refereeMatchRatings.fixtureId, fixtures.id))
    .orderBy(desc(fixtures.kickoffAt), desc(refereeMatchRatings.rating))
    .limit(half);

  const coachesOut: StaffRatingLabRow[] = coachRows.map((row) => {
    const rating = row.rating.manualOverrideRating ?? row.rating.rating;
    const flags: string[] = [];
    if (rating != null && rating >= 8 && row.rating.side === "away") {
      flags.push("Strong away coaching rating");
    }
    if (rating != null && rating < 5) flags.push("Weak coaching rating");
    return {
      id: row.rating.id,
      entityType: "coach",
      fixtureId: row.rating.fixtureId,
      entityId: row.rating.coachId,
      entitySlug: row.entitySlug,
      entityName: row.entityName,
      teamName: row.teamName ?? null,
      side: row.rating.side,
      fixtureSlug: row.fixtureSlug,
      kickoffAt: row.kickoffAt,
      rating,
      previousRating: row.rating.previousRating,
      ratingChange: row.rating.ratingChange,
      performanceTrend: row.rating.performanceTrend,
      ratingStatus: row.rating.ratingStatus,
      modelVersion: row.rating.modelVersion,
      flags,
    };
  });

  const refsOut: StaffRatingLabRow[] = refRows.map((row) => {
    const rating = row.rating.manualOverrideRating ?? row.rating.rating;
    const flags: string[] = [];
    if (rating != null && rating < 5.5) flags.push("Below-average referee rating");
    if (rating != null && rating >= 8.5) flags.push("Excellent referee rating");
    return {
      id: row.rating.id,
      entityType: "referee",
      fixtureId: row.rating.fixtureId,
      entityId: row.rating.refereeId,
      entitySlug: row.entitySlug,
      entityName: row.entityName,
      teamName: null,
      side: null,
      fixtureSlug: row.fixtureSlug,
      kickoffAt: row.kickoffAt,
      rating,
      previousRating: row.rating.previousRating,
      ratingChange: row.rating.ratingChange,
      performanceTrend: row.rating.performanceTrend,
      ratingStatus: row.rating.ratingStatus,
      modelVersion: row.rating.modelVersion,
      flags,
    };
  });

  return [...coachesOut, ...refsOut]
    .sort((a, b) => {
      const at = a.kickoffAt?.getTime() ?? 0;
      const bt = b.kickoffAt?.getTime() ?? 0;
      if (bt !== at) return bt - at;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, limit);
}
