/**
 * Admin + profile match-rating history: season averages, DNPs, ranking-over-time series.
 */
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  playerMatchRatings,
  playerRatings,
  playerSelectionTrends,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  MATCH_RATING_MODEL,
  computeFormRatingFromMatchRatings,
  formTrendLabel,
} from "./match-rating-math";
import { loadPlayerAppearances } from "./public-player-appearances-service";
import {
  buildSeasonDevelopmentRows,
  resolveAppearanceStatus,
  type AppearanceStatus,
  type DevelopmentAnnotation,
  type DevelopmentTimelinePoint,
} from "./player-development-timeline-utils";
import {
  formatSeasonRangeLabel,
  seasonSlugFromStartYear,
} from "./season-label-utils";
import { isInternationalCompetitionType, seasonLabelToPublicSlug } from "./public-player-filters";

export type PlayerRankingsStrip = {
  careerRating: number | null;
  /** Season match-v1 average (1–10). */
  seasonMatchAverage: number | null;
  formRating: number | null;
  formLabel: string;
  latestMatchRating: number | null;
  ratedAppearances: number;
  dnpCount: number;
};

export type RankingOverTimePoint = {
  seasonSlug: string;
  seasonLabel: string;
  average: number | null;
  ratedAppearances: number;
  dnpCount: number;
  changeFromPrevious: number | null;
};

export type PlayerMatchRatingsHistory = {
  playerId: string;
  playerName: string;
  strip: PlayerRankingsStrip;
  timeline: DevelopmentTimelinePoint[];
  seasonRows: ReturnType<typeof buildSeasonDevelopmentRows>;
  rankingOverTime: RankingOverTimePoint[];
  currentDomesticSlug: string;
  careerAverage: number | null;
};

function inferSeasonFromKickoff(
  kickoffAt: Date | null,
  competitionType: string | null,
): { label: string; slug: string } | null {
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) return null;
  if (isInternationalCompetitionType(competitionType)) {
    const y = kickoffAt.getFullYear();
    return { label: String(y), slug: String(y) };
  }
  const start =
    kickoffAt.getMonth() >= 7 ? kickoffAt.getFullYear() : kickoffAt.getFullYear() - 1;
  return { label: formatSeasonRangeLabel(start), slug: seasonSlugFromStartYear(start) };
}

async function loadNotSelectedDnps(
  playerId: string,
  excludeFixtureIds: Set<string>,
): Promise<DevelopmentTimelinePoint[]> {
  const db = getDb();
  const trends = await db
    .select({
      fixtureId: playerSelectionTrends.fixtureId,
      teamId: playerSelectionTrends.teamId,
      currentRole: playerSelectionTrends.currentRole,
      reason: playerSelectionTrends.reason,
      kickoffAt: fixtures.kickoffAt,
      fixtureSlug: fixtures.slug,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      seasonId: fixtures.seasonId,
      competitionId: fixtures.competitionId,
      seasonLabel: competitionSeasons.label,
      seasonSlugDb: competitionSeasons.slug,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.competitionType,
      teamName: teams.name,
    })
    .from(playerSelectionTrends)
    .innerJoin(fixtures, eq(playerSelectionTrends.fixtureId, fixtures.id))
    .leftJoin(competitionSeasons, eq(fixtures.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .leftJoin(teams, eq(playerSelectionTrends.teamId, teams.id))
    .where(
      and(
        eq(playerSelectionTrends.playerId, playerId),
        eq(playerSelectionTrends.currentRole, "not_selected"),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(240);

  const points: DevelopmentTimelinePoint[] = [];
  for (const row of trends) {
    if (!row.fixtureId || excludeFixtureIds.has(row.fixtureId)) continue;
    const kickoff = row.kickoffAt ? new Date(row.kickoffAt) : null;
    let seasonLabel = row.seasonLabel;
    let seasonSlug =
      seasonLabelToPublicSlug(row.seasonLabel) ??
      (row.seasonSlugDb && /^\d{4}(-\d{2})?$/.test(row.seasonSlugDb) ? row.seasonSlugDb : null);
    if (!seasonSlug) {
      const inferred = inferSeasonFromKickoff(kickoff, row.competitionType);
      if (inferred) {
        seasonLabel = seasonLabel ?? inferred.label;
        seasonSlug = inferred.slug;
      }
    }

    const homeAway =
      row.teamId && row.teamId === row.homeTeamId
        ? "home"
        : row.teamId && row.teamId === row.awayTeamId
          ? "away"
          : null;
    const opponentId =
      homeAway === "home" ? row.awayTeamId : homeAway === "away" ? row.homeTeamId : null;

    points.push({
      fixtureId: row.fixtureId,
      fixtureSlug: row.fixtureSlug,
      date: kickoff?.toISOString() ?? null,
      seasonSlug,
      seasonLabel,
      competitionSlug: row.competitionSlug,
      competitionName: row.competitionName,
      teamName: row.teamName ?? "—",
      opponentName: null,
      homeAway,
      result: null,
      resultLabel:
        row.homeScore != null && row.awayScore != null
          ? `${row.homeScore}–${row.awayScore}`
          : null,
      scoreLine:
        row.homeScore != null && row.awayScore != null
          ? `${row.homeScore}–${row.awayScore}`
          : null,
      positionName: null,
      jerseyNumber: null,
      started: null,
      minutes: 0,
      rating: null,
      ratingChange: null,
      tries: null,
      points: null,
      carries: null,
      metresCarried: null,
      tacklesMade: null,
      isInternational: isInternationalCompetitionType(row.competitionType),
      isPotm: false,
      modelVersion: null,
      appearanceStatus: "not_selected",
      annotations: ["dnp"],
      // stash for opponent resolve below
      ...(opponentId ? { _opponentId: opponentId } : {}),
    } as DevelopmentTimelinePoint & { _opponentId?: string });
  }

  const opponentIds = [
    ...new Set(
      points
        .map((p) => (p as DevelopmentTimelinePoint & { _opponentId?: string })._opponentId)
        .filter(Boolean) as string[],
    ),
  ];
  if (opponentIds.length) {
    const oppRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, opponentIds));
    const nameById = new Map(oppRows.map((t) => [t.id, t.name]));
    for (const p of points) {
      const ext = p as DevelopmentTimelinePoint & { _opponentId?: string };
      if (ext._opponentId) {
        p.opponentName = nameById.get(ext._opponentId) ?? null;
        delete ext._opponentId;
      }
    }
  }

  return points;
}

function appearanceToTimelinePoint(
  row: Awaited<ReturnType<typeof loadPlayerAppearances>>[number],
  extras: {
    ratingChange: number | null;
    isPotm: boolean;
    modelVersion: string | null;
    index: number;
    prevTeamName: string | null;
  },
): DevelopmentTimelinePoint {
  const appearanceStatus = resolveAppearanceStatus({
    rating: row.rating,
    minutes: row.minutes,
    started: row.started,
  });
  const annotations: DevelopmentAnnotation[] = [];
  if ((row.tries ?? 0) >= 2) annotations.push("multi_try");
  else if ((row.tries ?? 0) >= 1) annotations.push("try");
  if (extras.isPotm) annotations.push("potm");
  if (row.isInternational) annotations.push("intl");
  if (extras.index === 0) annotations.push("debut");
  if (extras.index === 24 || extras.index === 49 || extras.index === 99) {
    annotations.push("milestone");
  }
  if (extras.prevTeamName && extras.prevTeamName !== row.teamName) {
    annotations.push("transfer_debut");
  }
  if (appearanceStatus === "unused_bench" || appearanceStatus === "not_selected") {
    annotations.push("dnp");
  }

  return {
    fixtureId: row.fixtureId,
    fixtureSlug: row.fixtureSlug,
    date: row.kickoffAt,
    seasonSlug: row.seasonSlug,
    seasonLabel: row.seasonLabel,
    competitionSlug: row.competitionSlug,
    competitionName: row.competitionName,
    teamName: row.teamName,
    opponentName: row.opponentName,
    homeAway: row.homeAway,
    result: row.result,
    resultLabel: row.resultLabel,
    scoreLine:
      row.homeScore != null && row.awayScore != null
        ? `${row.homeScore}–${row.awayScore}`
        : null,
    positionName: row.positionName,
    jerseyNumber: row.jerseyNumber,
    started: row.started,
    minutes: row.minutes,
    rating: row.rating,
    ratingChange: extras.ratingChange,
    tries: row.tries,
    points: row.points,
    carries: row.carries,
    metresCarried: row.metresCarried,
    tacklesMade: row.tacklesMade,
    isInternational: row.isInternational,
    isPotm: extras.isPotm,
    modelVersion:
      extras.modelVersion ?? (row.rating != null ? MATCH_RATING_MODEL : null),
    appearanceStatus,
    annotations,
  };
}

export async function getPlayerMatchRatingsHistory(
  playerId: string,
  playerName: string,
): Promise<PlayerMatchRatingsHistory> {
  const db = getDb();
  const [appearances, careerRow, recentRatings] = await Promise.all([
    loadPlayerAppearances(playerId, { view: "all" }),
    db
      .select({
        playerRating: playerRatings.playerRating,
        manualOverrideRating: playerRatings.manualOverrideRating,
      })
      .from(playerRatings)
      .where(eq(playerRatings.playerId, playerId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        rating: playerMatchRatings.rating,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(playerMatchRatings)
      .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
      .where(
        and(
          eq(playerMatchRatings.playerId, playerId),
          eq(playerMatchRatings.modelVersion, MATCH_RATING_MODEL),
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(10),
  ]);

  const chronological = [...appearances].sort((a, b) =>
    (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""),
  );
  const timelineSource = chronological.slice(-180);
  const fixtureIds = timelineSource.map((r) => r.fixtureId);

  const ratingExtras =
    fixtureIds.length === 0
      ? []
      : await db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            ratingChange: playerMatchRatings.ratingChange,
            isRugby365Potm: playerMatchRatings.isRugby365Potm,
            modelVersion: playerMatchRatings.modelVersion,
          })
          .from(playerMatchRatings)
          .where(
            and(
              eq(playerMatchRatings.playerId, playerId),
              inArray(playerMatchRatings.fixtureId, fixtureIds),
            ),
          );

  const extraByFixture = new Map(ratingExtras.map((r) => [r.fixtureId, r]));

  const appearancePoints = timelineSource.map((row, index, arr) => {
    const extra = extraByFixture.get(row.fixtureId);
    return appearanceToTimelinePoint(row, {
      ratingChange: extra?.ratingChange ?? null,
      isPotm: Boolean(extra?.isRugby365Potm),
      modelVersion: extra?.modelVersion ?? null,
      index,
      prevTeamName: index > 0 ? arr[index - 1]!.teamName : null,
    });
  });

  const seen = new Set(appearancePoints.map((p) => p.fixtureId));
  const dnpPoints = await loadNotSelectedDnps(playerId, seen);
  const timeline = [...appearancePoints, ...dnpPoints].sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? ""),
  );

  const seasonRows = buildSeasonDevelopmentRows(timeline);
  const rankingOverTime: RankingOverTimePoint[] = [...seasonRows]
    .reverse()
    .map((r) => ({
      seasonSlug: r.seasonSlug,
      seasonLabel: r.seasonLabel,
      average: r.average,
      ratedAppearances: r.ratedAppearances,
      dnpCount: r.dnpCount,
      changeFromPrevious: r.changeFromPrevious,
    }));

  const form = computeFormRatingFromMatchRatings(
    recentRatings
      .map((r) => r.rating)
      .filter((n): n is number => n != null && Number.isFinite(n)),
    5,
  );

  const latestRated = timeline
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];

  const ratedAppearances = timeline.filter(
    (p) => p.rating != null && Number.isFinite(p.rating),
  ).length;
  const dnpCount = timeline.filter((p) => {
    const status =
      p.appearanceStatus ??
      resolveAppearanceStatus({
        rating: p.rating,
        minutes: p.minutes,
        started: p.started,
      });
    return status === "unused_bench" || status === "not_selected";
  }).length;

  const careerAverage =
    ratedAppearances > 0
      ? timeline
          .filter((p) => p.rating != null)
          .reduce((s, p) => s + (p.rating as number), 0) / ratedAppearances
      : null;

  const currentDomesticYear = new Date().getMonth() >= 7
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;
  const currentDomesticSlug = seasonSlugFromStartYear(currentDomesticYear);
  const currentSeasonAvg =
    seasonRows.find((r) => r.seasonSlug === currentDomesticSlug)?.average ??
    seasonRows[0]?.average ??
    null;

  const careerRating =
    careerRow?.manualOverrideRating ?? careerRow?.playerRating ?? null;

  return {
    playerId,
    playerName,
    strip: {
      careerRating: careerRating != null ? Math.round(careerRating) : null,
      seasonMatchAverage: currentSeasonAvg,
      formRating: form.formRating,
      formLabel: formTrendLabel(form.formTrend, form.formRating),
      latestMatchRating: latestRated?.rating ?? null,
      ratedAppearances,
      dnpCount,
    },
    timeline,
    seasonRows,
    rankingOverTime,
    currentDomesticSlug,
    careerAverage,
  };
}

export type { AppearanceStatus };
