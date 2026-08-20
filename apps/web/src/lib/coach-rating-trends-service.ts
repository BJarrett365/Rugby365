/**
 * Public / CMS Rating Trends for Rugby365 Coach Rating.
 * Prefers match-linked history (live | backfilled). Does not invent points.
 */

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { coachRatingHistory, teamCoachingStaff } from "@rugby365/db";
import { getDb } from "./db";
import { loadCoachEligibleMatches } from "./coach-career-record-service";
import {
  detectMajorMatchLabel,
  persistCoachRatingSnapshot,
} from "./coach-rating-service";
import {
  COACH_TREND_DIRECTION_VERSION,
  COACH_TREND_FILTER_LABELS,
  type CoachRatingTrendPoint,
  type CoachRatingTrendSummary,
  type CoachRatingTrendsBundle,
  type CoachTrendFilter,
} from "./coach-rating-trends-types";

export {
  COACH_TREND_FILTERS,
  COACH_TREND_FILTER_LABELS,
  COACH_TREND_DIRECTION_VERSION,
  type CoachTrendFilter,
  type CoachRatingTrendPoint,
  type CoachRatingTrendSummary,
  type CoachRatingTrendsBundle,
} from "./coach-rating-trends-types";

function mapRow(r: typeof coachRatingHistory.$inferSelect): CoachRatingTrendPoint {
  return {
    id: r.id,
    coachId: r.coachId,
    fixtureId: r.fixtureId,
    snapshotType: r.snapshotType,
    matchDate: r.matchDate?.toISOString() ?? r.calculatedAt.toISOString(),
    rating: r.rating,
    previousRating: r.previousRating,
    change: r.change,
    powerIndex: r.powerIndex,
    powerIndexChange: r.powerIndexChange,
    result: (r.result as "W" | "D" | "L" | null) ?? null,
    scoreFor: r.scoreFor,
    scoreAgainst: r.scoreAgainst,
    teamId: r.teamId,
    teamName: r.teamName,
    opponentId: r.opponentId,
    opponentName: r.opponentName,
    competitionName: r.competitionName,
    fixtureSlug: r.fixtureSlug,
    homeAwayNeutral: r.homeAwayNeutral,
    majorMatchLabel: r.majorMatchLabel,
    confidence: r.confidence,
    coverage: r.coverage,
    dataConfidence: r.dataConfidence,
    modelVersion: r.modelVersion,
    contributions: Array.isArray(r.contributions)
      ? (r.contributions as CoachRatingTrendPoint["contributions"])
      : [],
    intelligence: Array.isArray(r.intelligence)
      ? (r.intelligence as CoachRatingTrendPoint["intelligence"])
      : [],
  };
}

function computeTrendDirection(
  points: CoachRatingTrendPoint[],
): Pick<CoachRatingTrendSummary, "trend" | "trendLabel"> {
  if (points.length < 2) return { trend: null, trendLabel: null };
  const window = points.slice(-Math.min(5, points.length));
  const first = window[0]!.rating;
  const last = window[window.length - 1]!.rating;
  const delta = Math.round((last - first) * 10) / 10;
  if (delta >= 0.8) return { trend: "rising", trendLabel: "RISING" };
  if (delta <= -0.8) return { trend: "falling", trendLabel: "FALLING" };
  return { trend: "stable", trendLabel: "STABLE" };
}

export async function listMatchLinkedRatingHistory(
  coachId: string,
): Promise<CoachRatingTrendPoint[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(coachRatingHistory)
    .where(
      and(
        eq(coachRatingHistory.coachId, coachId),
        isNotNull(coachRatingHistory.fixtureId),
        inArray(coachRatingHistory.snapshotType, ["live", "backfilled"]),
      ),
    )
    .orderBy(asc(coachRatingHistory.matchDate), asc(coachRatingHistory.calculatedAt));
  return rows.map(mapRow);
}

export async function getCoachRatingTrends(
  coachId: string,
  filter: CoachTrendFilter = "last_24",
): Promise<CoachRatingTrendsBundle> {
  let points = await listMatchLinkedRatingHistory(coachId);

  const now = Date.now();
  if (filter === "months_12") {
    const cut = now - 365 * 24 * 3600 * 1000;
    points = points.filter((p) => (p.matchDate ? Date.parse(p.matchDate) >= cut : false));
  } else if (filter === "months_24") {
    const cut = now - 730 * 24 * 3600 * 1000;
    points = points.filter((p) => (p.matchDate ? Date.parse(p.matchDate) >= cut : false));
  } else if (filter === "current_tenure") {
    const db = getDb();
    const [current] = await db
      .select()
      .from(teamCoachingStaff)
      .where(
        and(eq(teamCoachingStaff.coachId, coachId), eq(teamCoachingStaff.isCurrent, true)),
      )
      .limit(1);
    if (current?.startDate) {
      const start = Date.parse(`${current.startDate}T00:00:00.000Z`);
      points = points.filter((p) => (p.matchDate ? Date.parse(p.matchDate) >= start : false));
    }
  } else if (filter === "last_5") {
    points = points.slice(-5);
  } else if (filter === "last_10") {
    points = points.slice(-10);
  } else if (filter === "last_24") {
    points = points.slice(-24);
  }
  // career = all match-linked points

  const ratings = points.map((p) => p.rating);
  const current = ratings.length ? ratings[ratings.length - 1]! : null;
  const first = ratings.length ? ratings[0]! : null;
  const rangeChange =
    current != null && first != null ? Math.round((current - first) * 10) / 10 : null;
  const high = ratings.length ? Math.max(...ratings) : null;
  const low = ratings.length ? Math.min(...ratings) : null;
  const { trend, trendLabel } = computeTrendDirection(points);

  const db = getDb();
  const assignments = await db
    .select()
    .from(teamCoachingStaff)
    .where(eq(teamCoachingStaff.coachId, coachId))
    .orderBy(asc(teamCoachingStaff.startDate));

  const tenures = assignments
    .filter((a) => a.startDate)
    .map((a) => ({
      year: Number(a.startDate!.slice(0, 4)),
      label: a.overviewLabel || a.teamDisplayName || a.role,
      startDate: a.startDate,
    }));

  return {
    points,
    summary: {
      current,
      rangeChange,
      high,
      low,
      trend,
      trendLabel,
      trendVersion: COACH_TREND_DIRECTION_VERSION,
      pointCount: points.length,
      filter,
      filterLabel: COACH_TREND_FILTER_LABELS[filter],
    },
    tenures: filter === "career" ? tenures : [],
  };
}

/**
 * Reconstruct match-linked rating history by walking eligible matches chronologically.
 * Stores snapshot_type = backfilled. Does not invent ratings — recalculates as-of each match.
 */
export async function backfillCoachMatchRatingHistory(
  coachId: string,
  options: { limit?: number; overwrite?: boolean; filter?: "career" | "current_team" } = {},
): Promise<{ written: number; skipped: number; matches: number }> {
  const matches = await loadCoachEligibleMatches(coachId, {
    primaryOnly: true,
    filter: options.filter === "current_team" ? "current_team" : undefined,
  });
  const chronological = [...matches].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  const slice =
    options.limit && options.limit > 0 ? chronological.slice(-options.limit) : chronological;

  const db = getDb();
  let written = 0;
  let skipped = 0;

  for (const m of slice) {
    if (!m.kickoffAt) {
      skipped += 1;
      continue;
    }
    if (!options.overwrite) {
      const [existing] = await db
        .select({ id: coachRatingHistory.id })
        .from(coachRatingHistory)
        .where(
          and(eq(coachRatingHistory.coachId, coachId), eq(coachRatingHistory.fixtureId, m.id)),
        )
        .limit(1);
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    await persistCoachRatingSnapshot(coachId, {
      asOfDate: m.kickoffAt,
      fixtureId: m.id,
      snapshotType: "backfilled",
      match: {
        teamId: m.teamId,
        opponentId: m.opponentTeamId,
        matchDate: m.kickoffAt,
        homeAwayNeutral: m.side,
        result: m.result,
        scoreFor: m.forScore,
        scoreAgainst: m.againstScore,
        competitionName: m.competitionName,
        teamName: m.teamName,
        opponentName: m.opponentName,
        fixtureSlug: m.slug,
        majorMatchLabel: detectMajorMatchLabel(m.competitionName),
      },
    });
    written += 1;
  }

  return { written, skipped, matches: slice.length };
}

/** CMS listing — all history including recalculated, newest first. */
export async function listCoachRatingHistoryForCms(coachId: string, limit = 100) {
  const db = getDb();
  return db
    .select()
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.coachId, coachId))
    .orderBy(desc(coachRatingHistory.calculatedAt))
    .limit(limit);
}

export async function getCoachRatingHistoryPoint(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(coachRatingHistory)
    .where(eq(coachRatingHistory.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
}
