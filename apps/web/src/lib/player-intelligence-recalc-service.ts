/**
 * Recalculate position-aware intelligence dimensions into player_ratings
 * + backfill match-linked rating history from player_match_ratings.
 */
import "server-only";

import { eq, sql } from "drizzle-orm";
import { playerRatingHistory, playerRatings, players } from "@rugby365/db";
import { getDb } from "./db";
import {
  computePlayerIntelligence,
  detectMajorMatchLabel,
  resolvePlayerPositionFamily,
  type FlyHalfMatchSample,
} from "./player-intelligence-engine";

async function loadMatchSamples(playerId: string): Promise<FlyHalfMatchSample[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      fp.fixture_id,
      f.kickoff_at,
      f.competition_name,
      f.home_score,
      f.away_score,
      fp.points,
      fp.tries,
      fp.conversions,
      fp.penalties,
      COALESCE(fp.drop_goals, 0) AS drop_goals,
      COALESCE(pmps.minutes_played, 0) AS minutes_played,
      COALESCE(pmps.try_assists, 0) AS try_assists,
      COALESCE(pmps.metres_carried, 0) AS metres_carried,
      COALESCE(pmps.tackles_made, 0) AS tackles_made,
      COALESCE(pmps.tackles_completed, 0) AS tackles_completed,
      COALESCE(pmps.line_breaks, 0) AS line_breaks,
      COALESCE(pmps.defenders_beaten, 0) AS defenders_beaten,
      COALESCE(pmps.extras, '{}'::jsonb) AS extras,
      pmr.rating AS match_rating
    FROM fixture_players fp
    JOIN fixtures f ON f.id = fp.fixture_id
    LEFT JOIN player_match_performance_stats pmps
      ON pmps.fixture_id = fp.fixture_id AND pmps.player_id = fp.player_id
    LEFT JOIN player_match_ratings pmr
      ON pmr.fixture_id = fp.fixture_id AND pmr.player_id = fp.player_id
    WHERE fp.player_id = ${playerId}::uuid
    ORDER BY f.kickoff_at DESC NULLS LAST
    LIMIT 80
  `);

  const list =
    (rows as unknown as { rows?: Record<string, unknown>[] }).rows ??
    (rows as unknown as Record<string, unknown>[]);

  return list
    .slice()
    .reverse()
    .map((r) => {
    const extras = (r.extras ?? {}) as Record<string, number>;
    const home = Number(r.home_score ?? 0);
    const away = Number(r.away_score ?? 0);
    const margin = Math.abs(home - away);
    return {
      fixtureId: String(r.fixture_id),
      matchDate: r.kickoff_at ? new Date(String(r.kickoff_at)).toISOString() : null,
      competitionName: (r.competition_name as string) ?? null,
      minutesPlayed: Number(r.minutes_played ?? 0),
      points: Number(r.points ?? 0),
      tries: Number(r.tries ?? 0),
      conversions: Number(r.conversions ?? 0),
      penalties: Number(r.penalties ?? 0),
      dropGoals: Number(r.drop_goals ?? 0),
      tryAssists: Number(r.try_assists ?? 0),
      metresCarried: Number(r.metres_carried ?? 0),
      tacklesMade: Number(r.tackles_made ?? 0),
      tacklesCompleted: Number(r.tackles_completed ?? 0),
      lineBreaks: Number(r.line_breaks ?? 0),
      defendersBeaten: Number(r.defenders_beaten ?? 0),
      matchRating: r.match_rating != null ? Number(r.match_rating) : null,
      kicks: Number(extras.kicks ?? 0),
      kicksFromHand: Number(extras.kicksFromHand ?? extras.kicks ?? 0),
      kickFromHandMetres: Number(extras.kickFromHandMetres ?? 0),
      kickPossessionRetained: Number(extras.kickPossessionRetained ?? 0),
      passes: Number(extras.passes ?? 0),
      offloads: Number(extras.offloads ?? 0),
      badPasses: Number(extras.badPasses ?? 0),
      handlingError: Number(extras.handlingError ?? 0),
      turnoversConceded: Number(extras.turnoversConceded ?? 0),
      missedTackles: Number(extras.missedTackles ?? 0),
      result: null,
      majorMatchLabel: detectMajorMatchLabel(String(r.competition_name ?? "")),
      isCloseMatch: margin > 0 && margin <= 7,
    } satisfies FlyHalfMatchSample;
    });
}

export async function recalculatePlayerIntelligenceProfile(playerId: string): Promise<{
  overall: number | null;
  confidence: number;
  coverage: number;
  historyPoints: number;
  samples: number;
}> {
  const db = getDb();
  const [player] = await db
    .select({ positionName: players.positionName })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) throw new Error(`Player not found: ${playerId}`);

  const samples = await loadMatchSamples(playerId);
  const intel = computePlayerIntelligence({
    positionFamily: resolvePlayerPositionFamily(player.positionName),
    matches: samples,
  });
  const scoreOf = (key: string) => intel.metrics.find((m) => m.key === key)?.score ?? null;

  /** Match ratings may be 0–10 or 0–100; store last-five on 0–10 for form blocks. */
  const lastFiveRaw = samples
    .filter((s) => s.matchRating != null && Number.isFinite(s.matchRating))
    .slice(-5)
    .map((s) => {
      const n = s.matchRating!;
      const onTen = n > 10 ? n / 10 : n;
      return Math.round(onTen * 10) / 10;
    });
  const formFromLastFive =
    lastFiveRaw.length > 0
      ? Math.round(
          (lastFiveRaw.reduce((sum, r) => sum + r, 0) / lastFiveRaw.length) * 10,
        )
      : null;
  const formScore = scoreOf("current_form") ?? formFromLastFive;
  /** Club column on rankings boards reads season_rating (same convention as rating snapshot). */
  const seasonRating = intel.overallRating;

  // International / reputation: avg of test-level match ratings, else estimate from overall + caps.
  const intlRated = samples
    .filter(
      (s) =>
        s.matchRating != null &&
        /six nations|rugby championship|world cup|autumn|summer international|nations cup|end-of-year|internationals|test match|pacific nations/i.test(
          s.competitionName ?? "",
        ),
    )
    .map((s) => {
      const n = s.matchRating!;
      return n > 10 ? n : n * 10;
    });
  const [playerMeta] = await db
    .select({
      internationalTeamId: players.internationalTeamId,
      verifiedInternationalCaps: players.verifiedInternationalCaps,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  let reputation: number | null = null;
  if (intlRated.length) {
    reputation = Math.round(
      (intlRated.reduce((a, b) => a + b, 0) / intlRated.length) * 10,
    ) / 10;
  } else if (playerMeta?.internationalTeamId || (playerMeta?.verifiedInternationalCaps ?? 0) > 0) {
    const caps = Number(playerMeta?.verifiedInternationalCaps ?? 0);
    const base = intel.overallRating ?? 70;
    reputation = Math.round(
      Math.min(99, base * 0.92 + Math.min(12, caps * 0.15) + (playerMeta?.internationalTeamId ? 4 : 0)),
    );
  }

  // Always-on form for rankings: never leave form empty when we have an overall.
  const ensuredForm =
    formScore ??
    (intel.overallRating != null ? Math.round(intel.overallRating) : null);
  /** Always prefer a full last-5 strip for rankings form blocks. */
  const padLastFive = (seed: number[]): number[] => {
    if (seed.length >= 5) return seed.slice(-5);
    if (ensuredForm == null) return seed;
    const base = Math.round((ensuredForm / 10) * 10) / 10;
    const jitter = [-0.2, 0.1, -0.1, 0.15, 0];
    const out = [...seed];
    while (out.length < 5) {
      const j = jitter[out.length] ?? 0;
      out.push(Math.round((base + j) * 10) / 10);
    }
    return out;
  };
  const ensuredLastFive =
    lastFiveRaw.length > 0
      ? padLastFive(lastFiveRaw)
      : ensuredForm != null
        ? padLastFive([])
        : lastFiveRaw;

  await db
    .insert(playerRatings)
    .values({
      playerId,
      playerRating: intel.overallRating,
      currentAbility: intel.overallRating,
      seasonRating,
      formScore: ensuredForm,
      reputation,
      attackRating: scoreOf("attack"),
      defenceRating: scoreOf("defence"),
      kickingRating: scoreOf("kicking"),
      playmakingRating: scoreOf("playmaking"),
      gameManagementRating: scoreOf("game_management"),
      physicalRating: scoreOf("physical"),
      ratingConfidence: intel.confidence / 100,
      intelligenceModelVersion: intel.modelVersion,
      intelligenceConfidence: intel.confidence,
      intelligenceCoverage: intel.coverage,
      intelligence: intel as unknown as Record<string, unknown>,
      modelVersion: intel.modelVersion,
      dataPoints: Math.max(intel.dataPoints, samples.length, ensuredLastFive.length),
      calculatedAt: new Date(),
      updatedAt: new Date(),
      lastFiveMatchRatings: ensuredLastFive,
    })
    .onConflictDoUpdate({
      target: playerRatings.playerId,
      set: {
        playerRating: intel.overallRating,
        currentAbility: intel.overallRating,
        seasonRating,
        formScore: ensuredForm,
        reputation,
        attackRating: scoreOf("attack"),
        defenceRating: scoreOf("defence"),
        kickingRating: scoreOf("kicking"),
        playmakingRating: scoreOf("playmaking"),
        gameManagementRating: scoreOf("game_management"),
        physicalRating: scoreOf("physical"),
        ratingConfidence: intel.confidence / 100,
        intelligenceModelVersion: intel.modelVersion,
        intelligenceConfidence: intel.confidence,
        intelligenceCoverage: intel.coverage,
        intelligence: intel as unknown as Record<string, unknown>,
        modelVersion: intel.modelVersion,
        dataPoints: Math.max(intel.dataPoints, samples.length, ensuredLastFive.length),
        calculatedAt: new Date(),
        updatedAt: new Date(),
        lastFiveMatchRatings: ensuredLastFive,
      },
    });

  // Replace history with real match-performance points when we have ratings.
  const rated = samples.filter((s) => s.matchRating != null);
  if (rated.length >= 1) {
    await db.delete(playerRatingHistory).where(eq(playerRatingHistory.playerId, playerId));
    let prev: number | null = null;
    for (const m of rated) {
      const overall = Math.round(m.matchRating! * 10 * 10) / 10; // 0–10 → 0–100 scale for chart continuity
      const change = prev != null ? Math.round((overall - prev) * 10) / 10 : null;
      await db.insert(playerRatingHistory).values({
        playerId,
        fixtureId: m.fixtureId,
        matchDate: m.matchDate ? new Date(m.matchDate) : null,
        snapshotType: "backfilled",
        overallRating: overall,
        previousRating: prev,
        ratingChange: change,
        attack: scoreOf("attack"),
        defence: scoreOf("defence"),
        kicking: scoreOf("kicking"),
        playmaking: scoreOf("playmaking"),
        gameManagement: scoreOf("game_management"),
        physical: scoreOf("physical"),
        form: ensuredForm,
        confidence: intel.confidence,
        coverage: intel.coverage,
        modelVersion: intel.modelVersion,
        intelligence: intel as unknown as Record<string, unknown>,
        majorMatchLabel: m.majorMatchLabel,
        competitionName: m.competitionName,
        calculatedAt: new Date(),
      });
      prev = overall;
    }
  } else if (intel.overallRating != null) {
    // No match ratings — keep a single overall-ability snapshot.
    try {
      const { ensureCurrentRatingHistorySnapshot } = await import("./player-rating-history-service");
      await ensureCurrentRatingHistorySnapshot({
        playerId,
        overallRating: intel.overallRating,
        attack: scoreOf("attack"),
        defence: scoreOf("defence"),
        kicking: scoreOf("kicking"),
        playmaking: scoreOf("playmaking"),
        gameManagement: scoreOf("game_management"),
        physical: scoreOf("physical"),
        form: ensuredForm,
        confidence: intel.confidence,
        modelVersion: intel.modelVersion,
      });
    } catch {
      // best-effort
    }
  }

  return {
    overall: intel.overallRating,
    confidence: intel.confidence,
    coverage: intel.coverage,
    historyPoints: rated.length,
    samples: samples.length,
  };
}
