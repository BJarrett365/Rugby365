/**
 * Sacha Feinberg-Mngomezulu profile foundation — identity, clubs, intelligence,
 * rating history, market value, scout.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-sacha-profile-v2.ts
 */
import { and, eq, sql } from "drizzle-orm";
import {
  playerCareerStints,
  playerRatingHistory,
  playerRatings,
  playerTeamMemberships,
  players,
} from "@rugby365/db";
import { createDb } from "@rugby365/db";
import {
  computePlayerIntelligence,
  detectMajorMatchLabel,
  resolvePlayerPositionFamily,
  type FlyHalfMatchSample,
} from "../apps/web/src/lib/player-intelligence-engine";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";

const SACHA_ID = "6ffbe0ac-79ab-4838-a778-25b010c9ffb3";
const SA_ID = "b0000000-0000-4000-8000-000000000001";

const db = createDb();

async function fixIdentity() {
  await db
    .update(players)
    .set({
      preferredFoot: "Right",
      squadNumber: 10,
      positionName: "Fly-Half",
      internationalTeamId: SA_ID,
      countryName: "South Africa",
      profileUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(players.id, SACHA_ID));
  console.log("identity: preferredFoot=Right, squadNumber=10");
}

async function ensureClubs() {
  const stormers =
    (await resolveTeam({ name: "Stormers", createIfMissing: false })) ??
    (await resolveTeam({ name: "DHL Stormers", createIfMissing: false }));
  const wp =
    (await resolveTeam({ name: "Western Province", createIfMissing: true })) ??
    null;

  if (stormers) {
    await db
      .update(players)
      .set({
        clubTeamId: stormers.id,
        clubName: "Stormers",
        updatedAt: new Date(),
      })
      .where(eq(players.id, SACHA_ID));
  }

  const stintSpecs: Array<{
    teamId: string | null;
    teamName: string;
    careerType: "club" | "international";
    yearsLabel: string;
    startYear: number;
    endYear: number | null;
  }> = [
    {
      teamId: wp?.id ?? null,
      teamName: "Western Province",
      careerType: "club",
      yearsLabel: "2021–",
      startYear: 2021,
      endYear: null,
    },
    {
      teamId: stormers?.id ?? null,
      teamName: "Stormers",
      careerType: "club",
      yearsLabel: "2022–present",
      startYear: 2022,
      endYear: null,
    },
    {
      teamId: SA_ID,
      teamName: "South Africa",
      careerType: "international",
      yearsLabel: "2024–present",
      startYear: 2024,
      endYear: null,
    },
  ];

  for (const spec of stintSpecs) {
    const existing = await db
      .select({ id: playerCareerStints.id })
      .from(playerCareerStints)
      .where(
        and(
          eq(playerCareerStints.playerId, SACHA_ID),
          eq(playerCareerStints.teamName, spec.teamName),
          eq(playerCareerStints.careerType, spec.careerType),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(playerCareerStints)
        .set({
          teamId: spec.teamId,
          yearsLabel: spec.yearsLabel,
          startYear: spec.startYear,
          endYear: spec.endYear,
        })
        .where(eq(playerCareerStints.id, existing[0].id));
    } else {
      await db.insert(playerCareerStints).values({
        playerId: SACHA_ID,
        teamId: spec.teamId,
        teamName: spec.teamName,
        careerType: spec.careerType,
        yearsLabel: spec.yearsLabel,
        startYear: spec.startYear,
        endYear: spec.endYear,
        sourceProvider: "manual",
      });
    }
  }

  async function upsertMembership(input: {
    teamId: string;
    membershipType: "club" | "provincial" | "international";
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
  }) {
    const [hit] = await db
      .select({ id: playerTeamMemberships.id })
      .from(playerTeamMemberships)
      .where(
        and(
          eq(playerTeamMemberships.playerId, SACHA_ID),
          eq(playerTeamMemberships.teamId, input.teamId),
          eq(playerTeamMemberships.membershipType, input.membershipType),
        ),
      )
      .limit(1);
    const patch = {
      startYear: input.startYear,
      endYear: input.endYear,
      isCurrent: input.isCurrent,
      status: "active",
      sourceProvider: "manual",
      verifiedAt: new Date(),
      updatedAt: new Date(),
    };
    if (hit) {
      await db.update(playerTeamMemberships).set(patch).where(eq(playerTeamMemberships.id, hit.id));
    } else {
      await db.insert(playerTeamMemberships).values({
        playerId: SACHA_ID,
        teamId: input.teamId,
        membershipType: input.membershipType,
        ...patch,
      });
    }
  }

  if (wp?.id) {
    await upsertMembership({
      teamId: wp.id,
      membershipType: "provincial",
      startYear: 2021,
      endYear: null,
      isCurrent: true,
    });
  }
  if (stormers?.id) {
    await upsertMembership({
      teamId: stormers.id,
      membershipType: "club",
      startYear: 2022,
      endYear: null,
      isCurrent: true,
    });
  }
  await upsertMembership({
    teamId: SA_ID,
    membershipType: "international",
    startYear: 2024,
    endYear: null,
    isCurrent: true,
  });

  console.log("clubs:", {
    stormers: stormers?.id ?? null,
    westernProvince: wp?.id ?? null,
  });
}

async function loadFlyHalfSamples(): Promise<FlyHalfMatchSample[]> {
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
    WHERE fp.player_id = ${SACHA_ID}::uuid
    ORDER BY f.kickoff_at ASC NULLS LAST
  `);

  const list =
    (rows as unknown as { rows?: Record<string, unknown>[] }).rows ??
    (rows as unknown as Record<string, unknown>[]);
  return list.map((r) => {
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

async function recalculateIntelligenceAndHistory() {
  const samples = await loadFlyHalfSamples();
  const intel = computePlayerIntelligence({
    positionFamily: resolvePlayerPositionFamily("fly-half"),
    matches: samples,
  });
  const scoreOf = (key: string) => intel.metrics.find((m) => m.key === key)?.score ?? null;

  await db
    .insert(playerRatings)
    .values({
      playerId: SACHA_ID,
      playerRating: intel.overallRating,
      currentAbility: intel.overallRating,
      formScore: scoreOf("current_form"),
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
      dataPoints: intel.dataPoints,
      calculatedAt: new Date(),
      updatedAt: new Date(),
      lastFiveMatchRatings: samples
        .filter((s) => s.matchRating != null)
        .slice(-5)
        .map((s) => Math.round((s.matchRating ?? 0) * 10) / 10),
    })
    .onConflictDoUpdate({
      target: playerRatings.playerId,
      set: {
        playerRating: intel.overallRating,
        currentAbility: intel.overallRating,
        formScore: scoreOf("current_form"),
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
        dataPoints: intel.dataPoints,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  await db.delete(playerRatingHistory).where(eq(playerRatingHistory.playerId, SACHA_ID));
  const rated = samples.filter((s) => s.matchRating != null);
  let prev: number | null = null;
  for (const m of rated) {
    const overall = Math.round(m.matchRating! * 10 * 10) / 10;
    const change = prev != null ? Math.round((overall - prev) * 10) / 10 : null;
    await db.insert(playerRatingHistory).values({
      playerId: SACHA_ID,
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
      form: scoreOf("current_form"),
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

  console.log("intelligence:", {
    overall: intel.overallRating,
    confidence: intel.confidence,
    coverage: intel.coverage,
    historyPoints: rated.length,
    samples: samples.length,
  });
  return intel;
}

async function main() {
  await fixIdentity();
  await ensureClubs();
  const intel = await recalculateIntelligenceAndHistory();

  try {
    const value = await calculateAndPersistPlayerValue(SACHA_ID);
    console.log("value:", {
      gbp: value?.marketValueGbp ?? null,
      factors: value?.factors?.length ?? 0,
    });
  } catch (e) {
    console.warn("value failed", e instanceof Error ? e.message : e);
  }

  try {
    const scout = await recalculatePlayerScoutProfile(SACHA_ID);
    console.log("scout:", {
      rri: scout?.rriScore ?? null,
      summaryLen: scout?.aiSummary?.length ?? 0,
    });
  } catch (e) {
    console.warn("scout failed", e instanceof Error ? e.message : e);
  }

  const [p] = await db
    .select({
      preferredFoot: players.preferredFoot,
      squadNumber: players.squadNumber,
      clubName: players.clubName,
    })
    .from(players)
    .where(eq(players.id, SACHA_ID))
    .limit(1);
  const stints = await db
    .select({ teamName: playerCareerStints.teamName, careerType: playerCareerStints.careerType })
    .from(playerCareerStints)
    .where(eq(playerCareerStints.playerId, SACHA_ID));
  console.log("done", { player: p, stints, ovr: intel.overallRating });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
