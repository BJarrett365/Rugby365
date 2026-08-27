/**
 * Fast head-to-head compare payload — reads persisted DB rows only.
 * Does not call getPublicPlayerProfile / overview v2 (those recompute on every request).
 */
import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMarketValues,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerRatings,
  playerValueHistory,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge } from "./player-profile-utils";
import { statsFromEventCounts, type PlayerScoringStats } from "./player-stats";
import type { CompareMetric } from "./player-compare-metrics";
import {
  auditPlayerValueHistory,
  backfillPlayerValueHistory,
  getPlayerValueTimeline,
  rebuildValueTimelineFromAppearances,
} from "./player-value-history-service";
import type {
  CompareLiteCard,
  CompareLitePayload,
  CompareLitePlayer,
  CompareLiteRecentMatch,
  CompareLiteScoring,
  CompareLiteTimeline,
} from "./player-compare-lite-types";

export type {
  CompareLiteCard,
  CompareLitePayload,
  CompareLitePlayer,
  CompareLiteRecentMatch,
  CompareLiteScoring,
  CompareLiteTimeline,
} from "./player-compare-lite-types";

const EMPTY_SCORING: CompareLiteScoring = {
  appearances: null,
  points: null,
  tries: null,
  conversions: null,
  penalties: null,
  dropGoals: null,
  metres: null,
  defendersBeaten: null,
  tackles: null,
  tacklesCompleted: null,
  tryAssists: null,
  turnoversWon: null,
  minutesPlayed: null,
  lineBreaks: null,
};

function formatGbp(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n)}`;
}

function n(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

function classificationFromRating(rating: number | null): string | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  if (rating >= 90) return "World Class";
  if (rating >= 82) return "Elite";
  if (rating >= 75) return "Starter";
  if (rating >= 68) return "Squad";
  return "Developing";
}

async function loadCareerEventStats(playerId: string): Promise<PlayerScoringStats> {
  const db = getDb();
  const rows = await db
    .select({
      eventType: matchEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(matchEvents)
    .where(eq(matchEvents.playerId, playerId))
    .groupBy(matchEvents.eventType);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.eventType] = row.count;
  return statsFromEventCounts(counts);
}

async function loadAppearanceAgg(
  playerId: string,
  opts: { seasonYear?: number } = {},
): Promise<CompareLiteScoring> {
  const db = getDb();

  const appConditions = [eq(fixturePlayers.playerId, playerId)];
  if (opts.seasonYear != null) {
    appConditions.push(sql`extract(year from ${fixtures.kickoffAt}) = ${opts.seasonYear}`);
  }

  const [appsRow] = await db
    .select({
      appearances: sql<number>`count(*)::int`,
      points: sql<number>`coalesce(sum(${fixturePlayers.points}), 0)::int`,
      tries: sql<number>`coalesce(sum(${fixturePlayers.tries}), 0)::int`,
      conversions: sql<number>`coalesce(sum(${fixturePlayers.conversions}), 0)::int`,
      penalties: sql<number>`coalesce(sum(${fixturePlayers.penalties}), 0)::int`,
      dropGoals: sql<number>`coalesce(sum(${fixturePlayers.dropGoals}), 0)::int`,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixtures.id, fixturePlayers.fixtureId))
    .where(and(...appConditions));

  const perfConditions = [eq(playerMatchPerformanceStats.playerId, playerId)];
  if (opts.seasonYear != null) {
    perfConditions.push(sql`extract(year from ${fixtures.kickoffAt}) = ${opts.seasonYear}`);
  }

  const [perfRow] = await db
    .select({
      metres: sql<number>`coalesce(sum(${playerMatchPerformanceStats.metresCarried}), 0)::int`,
      defendersBeaten: sql<number>`coalesce(sum(${playerMatchPerformanceStats.defendersBeaten}), 0)::int`,
      tackles: sql<number>`coalesce(sum(${playerMatchPerformanceStats.tacklesMade}), 0)::int`,
      tacklesCompleted: sql<number>`coalesce(sum(${playerMatchPerformanceStats.tacklesCompleted}), 0)::int`,
      tryAssists: sql<number>`coalesce(sum(${playerMatchPerformanceStats.tryAssists}), 0)::int`,
      turnoversWon: sql<number>`coalesce(sum(${playerMatchPerformanceStats.turnoversWon}), 0)::int`,
      minutesPlayed: sql<number>`coalesce(sum(${playerMatchPerformanceStats.minutesPlayed}), 0)::int`,
      lineBreaks: sql<number>`coalesce(sum(${playerMatchPerformanceStats.lineBreaks}), 0)::int`,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(fixtures, eq(fixtures.id, playerMatchPerformanceStats.fixtureId))
    .where(and(...perfConditions));

  const apps = appsRow?.appearances ?? 0;
  if (apps <= 0 && !(perfRow?.minutesPlayed)) return { ...EMPTY_SCORING };

  return {
    appearances: apps > 0 ? apps : null,
    points: appsRow?.points ?? 0,
    tries: appsRow?.tries ?? 0,
    conversions: appsRow?.conversions ?? 0,
    penalties: appsRow?.penalties ?? 0,
    dropGoals: appsRow?.dropGoals ?? 0,
    metres: perfRow?.metres ?? 0,
    defendersBeaten: perfRow?.defendersBeaten ?? 0,
    tackles: perfRow?.tackles ?? 0,
    tacklesCompleted: perfRow?.tacklesCompleted ?? 0,
    tryAssists: perfRow?.tryAssists ?? 0,
    turnoversWon: perfRow?.turnoversWon ?? 0,
    minutesPlayed: perfRow?.minutesPlayed ?? 0,
    lineBreaks: perfRow?.lineBreaks ?? 0,
  };
}

async function loadRecentMatches(playerId: string, limit = 8): Promise<CompareLiteRecentMatch[]> {
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      teamId: fixturePlayers.teamId,
      minutesPlayed: playerMatchRatings.minutesPlayed,
      rating: playerMatchRatings.rating,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixtures.id, fixturePlayers.fixtureId))
    .leftJoin(
      playerMatchRatings,
      and(
        eq(playerMatchRatings.fixtureId, fixturePlayers.fixtureId),
        eq(playerMatchRatings.playerId, fixturePlayers.playerId),
      ),
    )
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(limit);

  const teamIds = [
    ...new Set(
      rows.flatMap((r) => [r.homeTeamId, r.awayTeamId, r.teamId].filter(Boolean) as string[]),
    ),
  ];
  const teamRows =
    teamIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name, shortName: teams.shortName })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [];
  const teamName = new Map(
    teamRows.map((t) => [t.id, t.shortName?.trim() || t.name] as const),
  );

  return rows.map((r) => {
    const home = teamName.get(r.homeTeamId ?? "") ?? "Home";
    const away = teamName.get(r.awayTeamId ?? "") ?? "Away";
    let result: "W" | "D" | "L" | null = null;
    if (r.homeScore != null && r.awayScore != null && r.teamId) {
      const isHome = r.teamId === r.homeTeamId;
      const mine = isHome ? r.homeScore : r.awayScore;
      const theirs = isHome ? r.awayScore : r.homeScore;
      result = mine > theirs ? "W" : mine < theirs ? "L" : "D";
    }
    return {
      id: r.fixtureId,
      kickoffAt: r.kickoffAt?.toISOString() ?? null,
      matchLabel: `${home} vs ${away}`,
      competitionName: null,
      result,
      rating: r.rating != null && Number.isFinite(r.rating) ? Math.round(r.rating * 10) / 10 : null,
      minutesPlayed: r.minutesPlayed ?? null,
    };
  });
}

async function loadLastFiveRatings(playerId: string): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({
      rating: playerMatchRatings.rating,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(fixtures.id, playerMatchRatings.fixtureId))
    .where(
      and(eq(playerMatchRatings.playerId, playerId), sql`${playerMatchRatings.rating} is not null`),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(5);
  return rows
    .map((r) => r.rating)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .map((v) => Math.round(v * 10) / 10);
}

/**
 * Ensure value history exists from real inputs only:
 * LIVE calc when empty, appearance-year reconstruction when history is too thin for a line,
 * and standard month-end backfill when period coverage allows.
 */
export async function ensurePersistedValueHistory(playerId: string): Promise<void> {
  await purgeFabricatedCompareSparseHistory(playerId);

  let audit = await auditPlayerValueHistory(playerId);
  if (audit.count === 0) {
    const { calculateAndPersistPlayerValue } = await import("./player-value-service");
    await calculateAndPersistPlayerValue(playerId);
    audit = await auditPlayerValueHistory(playerId);
  }

  const historicCount = audit.rows.filter((r) => (r.type ?? "").toUpperCase() !== "LIVE").length;
  if (historicCount < 2) {
    await rebuildValueTimelineFromAppearances(playerId);
  }

  // Recent month-end backfill when possible (no-op when coverage is thin).
  try {
    await backfillPlayerValueHistory(playerId, { range: 24 });
  } catch {
    /* ignore */
  }
}

/** Remove mock flat timelines written by the retired compare-sparse seeder. */
export async function purgeFabricatedCompareSparseHistory(playerId?: string): Promise<number> {
  const db = getDb();
  const fabricMatch = or(
    eq(playerValueHistory.calculationReason, "COMPARE_SPARSE_TIMELINE"),
    eq(playerValueHistory.modelVersion, "compare-sparse-v1"),
  );
  const cond = playerId
    ? and(eq(playerValueHistory.playerId, playerId), fabricMatch)
    : fabricMatch;
  const deleted = await db
    .delete(playerValueHistory)
    .where(cond!)
    .returning({ id: playerValueHistory.id });
  return deleted.length;
}

export async function getCompareLitePlayer(
  slug: string,
  options: { ensureValueHistory?: boolean } = {},
): Promise<CompareLitePlayer | null> {
  const db = getDb();
  const club = alias(teams, "compare_club");
  const nation = alias(teams, "compare_nation");

  const [row] = await db
    .select({
      playerId: players.id,
      slug: players.slug,
      name: players.name,
      fullName: players.fullName,
      knownAs: players.knownAs,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
      positionName: players.positionName,
      birthDate: players.birthDate,
      heightCm: players.heightCm,
      weightKg: players.weightKg,
      caps: players.verifiedInternationalCaps,
      clubName: club.name,
      nationName: nation.name,
      playerRating: playerRatings.playerRating,
      formScore: playerRatings.formScore,
      marketValueGbp: playerMarketValues.marketValueGbp,
    })
    .from(players)
    .leftJoin(club, eq(club.id, players.clubTeamId))
    .leftJoin(nation, eq(nation.id, players.internationalTeamId))
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .leftJoin(
      playerMarketValues,
      and(
        eq(playerMarketValues.playerId, players.id),
        eq(playerMarketValues.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(players.slug, slug),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
      ),
    )
    .limit(1);

  if (!row) return null;

  if (options.ensureValueHistory !== false) {
    try {
      await ensurePersistedValueHistory(row.playerId);
    } catch {
      /* leave timeline empty if backfill fails */
    }
  }

  const year = new Date().getUTCFullYear();
  const [eventStats, careerAgg, seasonAgg, recentMatches, lastFiveRatings] = await Promise.all([
    loadCareerEventStats(row.playerId),
    loadAppearanceAgg(row.playerId),
    loadAppearanceAgg(row.playerId, { seasonYear: year }),
    loadRecentMatches(row.playerId),
    loadLastFiveRatings(row.playerId),
  ]);

  const overall =
    row.playerRating != null && Number.isFinite(row.playerRating)
      ? Math.round(row.playerRating)
      : null;

  const career: CompareLiteScoring = {
    ...careerAgg,
    points: eventStats.points || careerAgg.points,
    tries: eventStats.tries || careerAgg.tries,
    conversions: eventStats.conversions,
    penalties: eventStats.penalties,
    dropGoals: eventStats.dropGoals,
  };

  return {
    playerId: row.playerId,
    slug: row.slug,
    name: row.knownAs?.trim() || row.name?.trim() || row.fullName?.trim() || row.slug,
    imageUrl: row.badgeImageUrl ?? row.imageUrl,
    positionName: row.positionName,
    clubName: row.clubName,
    nationName: row.nationName,
    age: calculatePlayerAge(row.birthDate),
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    overallRating: overall,
    formScore:
      row.formScore != null && Number.isFinite(row.formScore)
        ? Math.round(row.formScore * 10) / 10
        : null,
    classificationLabel: classificationFromRating(overall),
    marketValueGbp: row.marketValueGbp ?? null,
    caps: row.caps ?? null,
    career,
    season: seasonAgg,
    lastFiveRatings,
    recentMatches,
  };
}

export function toCompareLiteCard(player: CompareLitePlayer): CompareLiteCard {
  return {
    slug: player.slug,
    displayName: player.name,
    imageUrl: player.imageUrl,
    positionName: player.positionName,
    clubName: player.clubName,
    nationName: player.nationName,
    age: player.age,
    overallRating: player.overallRating,
    formScore: player.formScore,
    classificationLabel: player.classificationLabel,
    marketValueLabel: formatGbp(player.marketValueGbp),
    caps: player.caps,
    scoring: {
      appearances: player.season.appearances ?? player.career.appearances,
      points: player.season.points ?? player.career.points,
      tries: player.season.tries ?? player.career.tries,
      metres: player.season.metres ?? player.career.metres,
      defendersBeaten: player.season.defendersBeaten ?? player.career.defendersBeaten,
      tackles: player.season.tackles ?? player.career.tackles,
      tryAssists: player.season.tryAssists ?? player.career.tryAssists,
    },
    recentMatches: player.recentMatches,
    lastFiveRatings: player.lastFiveRatings,
  };
}

function buildLiteMetrics(a: CompareLitePlayer, b: CompareLitePlayer): CompareMetric[] {
  return [
    {
      key: "rating",
      label: "Overall Rating",
      group: "general",
      a: n(a.overallRating),
      b: n(b.overallRating),
    },
    {
      key: "age",
      label: "Age",
      group: "general",
      a: n(a.age),
      b: n(b.age),
      higherIsBetter: false,
    },
    {
      key: "height",
      label: "Height (cm)",
      group: "general",
      a: n(a.heightCm),
      b: n(b.heightCm),
    },
    {
      key: "weight",
      label: "Weight (kg)",
      group: "general",
      a: n(a.weightKg),
      b: n(b.weightKg),
    },
    {
      key: "market",
      label: "Market Value (£)",
      group: "general",
      a: n(a.marketValueGbp),
      b: n(b.marketValueGbp),
    },
    {
      key: "tries",
      label: "Tries",
      group: "attack",
      a: n(a.season.tries),
      b: n(b.season.tries),
    },
    {
      key: "points",
      label: "Points",
      group: "attack",
      a: n(a.season.points),
      b: n(b.season.points),
    },
    {
      key: "metres",
      label: "Metres",
      group: "attack",
      a: n(a.season.metres),
      b: n(b.season.metres),
    },
    {
      key: "breaks",
      label: "Line breaks",
      group: "attack",
      a: n(a.season.lineBreaks),
      b: n(b.season.lineBreaks),
    },
    {
      key: "beaten",
      label: "Defenders beaten",
      group: "attack",
      a: n(a.season.defendersBeaten),
      b: n(b.season.defendersBeaten),
    },
    {
      key: "assists",
      label: "Try assists",
      group: "attack",
      a: n(a.season.tryAssists),
      b: n(b.season.tryAssists),
    },
    {
      key: "tackles",
      label: "Tackles",
      group: "defence",
      a: n(a.season.tackles),
      b: n(b.season.tackles),
    },
    {
      key: "tackles_c",
      label: "Tackles completed",
      group: "defence",
      a: n(a.season.tacklesCompleted),
      b: n(b.season.tacklesCompleted),
    },
    {
      key: "turnovers",
      label: "Turnovers won",
      group: "defence",
      a: n(a.season.turnoversWon),
      b: n(b.season.turnoversWon),
    },
    {
      key: "apps",
      label: "Appearances",
      group: "career",
      a: n(a.career.appearances),
      b: n(b.career.appearances),
    },
    {
      key: "career_tries",
      label: "Career tries",
      group: "career",
      a: n(a.career.tries),
      b: n(b.career.tries),
    },
    {
      key: "career_pts",
      label: "Career points",
      group: "career",
      a: n(a.career.points),
      b: n(b.career.points),
    },
    {
      key: "caps",
      label: "International caps",
      group: "career",
      a: n(a.caps),
      b: n(b.caps),
    },
    {
      key: "minutes",
      label: "Minutes (availability)",
      group: "discipline",
      a: n(a.season.minutesPlayed),
      b: n(b.season.minutesPlayed),
    },
    {
      key: "career_conv",
      label: "Career conversions",
      group: "kicking",
      a: n(a.career.conversions),
      b: n(b.career.conversions),
    },
    {
      key: "career_pen",
      label: "Career penalties",
      group: "kicking",
      a: n(a.career.penalties),
      b: n(b.career.penalties),
    },
    {
      key: "career_dg",
      label: "Career drop goals",
      group: "kicking",
      a: n(a.career.dropGoals),
      b: n(b.career.dropGoals),
    },
  ];
}

async function loadTimeline(playerId: string): Promise<CompareLiteTimeline> {
  const timeline = await getPlayerValueTimeline(playerId);
  return {
    displayPoints: timeline.displayPoints,
    rangeStartIso: timeline.rangeStartIso,
    rangeEndIso: timeline.rangeEndIso,
    summary: timeline.summary,
  };
}

export async function getCompareLitePayload(
  slugA: string,
  slugB: string,
): Promise<CompareLitePayload | null> {
  const [playerA, playerB] = await Promise.all([
    getCompareLitePlayer(slugA),
    getCompareLitePlayer(slugB),
  ]);
  if (!playerA || !playerB) return null;

  const [valueTimelineA, valueTimelineB] = await Promise.all([
    loadTimeline(playerA.playerId),
    loadTimeline(playerB.playerId),
  ]);

  return {
    playerA,
    playerB,
    metrics: buildLiteMetrics(playerA, playerB),
    valueTimelineA,
    valueTimelineB,
  };
}

/** Diagnostic: how many value history rows exist (no writes). */
export async function countValueHistoryRows(playerId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, playerId));
  return row?.count ?? 0;
}
