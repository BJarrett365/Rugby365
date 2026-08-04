/**
 * Aggregate Betting Intelligence model pick accuracy across finished fixtures.
 */
import "server-only";
import { and, desc, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { getDb } from "./db";
import { isFixtureRatingsPublished } from "./match-rating-math";
import { BETTING_INTEL_MODEL } from "./match-betting-intelligence-math";
import { gradeModelPick } from "./match-betting-pick-grade";
import { enrichScheduleFixturesWithWinProbability } from "./schedule-win-probability";
import type { ScheduleFixture } from "./match-schedule-utils";

const FINISHED_STATUSES = [
  "full_time",
  "completed",
  "result",
  "finished",
  "ft",
  "Full Time",
  "Result",
  "Finished",
  "FT",
] as const;

export type BettingIntelAccuracyPoint = {
  dateKey: string;
  label: string;
  played: number;
  correct: number;
  wrong: number;
  accuracyPct: number | null;
  /** Rolling accuracy through this day (cumulative). */
  cumulativeAccuracyPct: number | null;
};

export type BettingIntelAccuracyMatch = {
  fixtureId: string;
  kickoffAt: string | null;
  competitionName: string | null;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeWinPct: number;
  awayWinPct: number;
  favored: "home" | "away";
  correct: boolean;
};

export type BettingIntelAccuracyReport = {
  sampled: number;
  graded: number;
  correct: number;
  wrong: number;
  accuracyPct: number | null;
  series: BettingIntelAccuracyPoint[];
  recent: BettingIntelAccuracyMatch[];
  modelVersion: string;
};

function dateKeyUtc(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Grade recent finished CMS fixtures with the same lightweight win model
 * used on the public fixtures board.
 */
export async function buildBettingIntelAccuracyReport(options?: {
  days?: number;
  limit?: number;
}): Promise<BettingIntelAccuracyReport> {
  const days = options?.days ?? 60;
  const limit = options?.limit ?? 180;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      competitionId: fixtures.competitionId,
      competitionName: fixtures.competitionName,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      round: fixtures.round,
      venueName: fixtures.venueName,
      venueId: fixtures.venueId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      isNeutralVenue: fixtures.isNeutralVenue,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(
      and(
        gte(fixtures.kickoffAt, since),
        lte(fixtures.kickoffAt, now),
        inArray(fixtures.status, [...FINISHED_STATUSES]),
        isNotNull(fixtures.homeScore),
        isNotNull(fixtures.awayScore),
        isNotNull(fixtures.homeTeamId),
        isNotNull(fixtures.awayTeamId),
        // Skip 0–0 placeholders / draws for lean grading
        ne(fixtures.homeScore, fixtures.awayScore),
        sql`(${fixtures.homeScore} > 0 OR ${fixtures.awayScore} > 0)`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(limit);

  const finished = rows.filter(
    (r) =>
      isFixtureRatingsPublished(r.status) &&
      r.homeScore != null &&
      r.awayScore != null &&
      r.homeScore !== r.awayScore,
  );

  const teamIds = [
    ...new Set(
      finished.flatMap((r) => [r.homeTeamId!, r.awayTeamId!]).filter(Boolean),
    ),
  ];
  const namedTeams = teamIds.length
    ? await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          imageUrl: teams.imageUrl,
        })
        .from(teams)
        .where(inArray(teams.id, teamIds))
    : [];
  const teamById = new Map(namedTeams.map((t) => [t.id, t]));

  const schedule: ScheduleFixture[] = finished.map((r) => {
    const home = r.homeTeamId ? teamById.get(r.homeTeamId) : null;
    const away = r.awayTeamId ? teamById.get(r.awayTeamId) : null;
    return {
      id: r.id,
      slug: r.slug,
      competitionId: r.competitionId,
      competitionName: r.competitionName,
      matchDate: r.kickoffAt ? r.kickoffAt.toISOString().slice(0, 10) : null,
      seasonLabel: null,
      kickoffAt: r.kickoffAt?.toISOString() ?? null,
      status: r.status,
      round: r.round,
      venue: r.venueName,
      venueId: r.venueId,
      homeScore: r.homeScore ?? 0,
      awayScore: r.awayScore ?? 0,
      isNeutralVenue: Boolean(r.isNeutralVenue),
      homeTeam: home
        ? { id: home.id, name: home.name, slug: home.slug, imageUrl: home.imageUrl }
        : null,
      awayTeam: away
        ? { id: away.id, name: away.name, slug: away.slug, imageUrl: away.imageUrl }
        : null,
      source: "db",
    };
  });

  const withWin = await enrichScheduleFixturesWithWinProbability(schedule);

  const graded: BettingIntelAccuracyMatch[] = [];
  for (const f of withWin) {
    const wp = f.winProbability;
    if (!wp || !f.homeTeam?.name || !f.awayTeam?.name) continue;
    const grade = gradeModelPick({
      homeWinPct: wp.homeWinPct,
      awayWinPct: wp.awayWinPct,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
    });
    if (!grade) continue;
    graded.push({
      fixtureId: f.id,
      kickoffAt: f.kickoffAt,
      competitionName: f.competitionName,
      homeName: f.homeTeam.name,
      awayName: f.awayTeam.name,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      homeWinPct: wp.homeWinPct,
      awayWinPct: wp.awayWinPct,
      favored: grade.favored,
      correct: grade.correct,
    });
  }

  const chronological = [...graded].sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return ta - tb;
  });

  const byDay = new Map<string, { played: number; correct: number; wrong: number }>();
  for (const row of chronological) {
    const key = dateKeyUtc(row.kickoffAt);
    if (!key) continue;
    const bucket = byDay.get(key) ?? { played: 0, correct: 0, wrong: 0 };
    bucket.played += 1;
    if (row.correct) bucket.correct += 1;
    else bucket.wrong += 1;
    byDay.set(key, bucket);
  }

  let cumPlayed = 0;
  let cumCorrect = 0;
  const series: BettingIntelAccuracyPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, bucket]) => {
      cumPlayed += bucket.played;
      cumCorrect += bucket.correct;
      return {
        dateKey,
        label: formatDayLabel(dateKey),
        played: bucket.played,
        correct: bucket.correct,
        wrong: bucket.wrong,
        accuracyPct:
          bucket.played > 0 ? Math.round((bucket.correct / bucket.played) * 1000) / 10 : null,
        cumulativeAccuracyPct:
          cumPlayed > 0 ? Math.round((cumCorrect / cumPlayed) * 1000) / 10 : null,
      };
    });

  const correct = graded.filter((g) => g.correct).length;
  const wrong = graded.length - correct;

  return {
    sampled: finished.length,
    graded: graded.length,
    correct,
    wrong,
    accuracyPct: graded.length
      ? Math.round((correct / graded.length) * 1000) / 10
      : null,
    series,
    recent: graded.slice(0, 25),
    modelVersion: BETTING_INTEL_MODEL,
  };
}
