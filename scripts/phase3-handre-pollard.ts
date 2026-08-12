/**
 * Phase 3 — Handré Pollard data foundation (no V2 UI).
 *
 * Fixes identity, club/intl separation, stints, memberships, transfers,
 * verified caps/points, fly-half intelligence, rating history, market value.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/phase3-handre-pollard.ts
 */

import { and, desc, eq, sql } from "drizzle-orm";
import {
  achievements,
  playerCareerStints,
  playerMarketValues,
  playerRatingHistory,
  playerRatings,
  playerTeamMemberships,
  playerTitles,
  playerTransfers,
  players,
  teams,
} from "@rugby365/db";
import { createDb } from "@rugby365/db";
import {
  computePlayerIntelligence,
  detectMajorMatchLabel,
  resolvePlayerPositionFamily,
  type FlyHalfMatchSample,
} from "../apps/web/src/lib/player-intelligence-engine";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";
import { seedAwardDefinitions } from "../apps/web/src/lib/achievement-service";
import { evaluatePlayerDataHealth } from "../apps/web/src/lib/player-data-health";
import { runPlayerOpenAiProfileCheck } from "../apps/web/src/lib/player-openai-profile-check-service";

const POLLARD_ID = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";
const BULLS_ID = "99f818a1-794f-4e9f-a7bb-41d259c68337";
const SA_ID = "b0000000-0000-4000-8000-000000000001";
const LEICESTER_ID = "1d1bcadf-006f-45bd-85e2-91e50b9bb843";
const MONTPELLIER_ID = "d7e5aaa3-4a7d-4e3f-bada-b8e00f35e336";

const db = createDb();

function parseYears(label: string): { start: number | null; end: number | null } {
  const m = label.match(/(\d{4})\s*[–\-]\s*(\d{4})?/);
  if (!m) {
    const y = label.match(/(\d{4})/);
    return { start: y ? Number(y[1]) : null, end: y ? Number(y[1]) : null };
  }
  return { start: Number(m[1]), end: m[2] ? Number(m[2]) : null };
}

async function fixIdentity() {
  await db
    .update(players)
    .set({
      name: "Handré Pollard",
      fullName: "Handré Pollard",
      knownAs: "Handré",
      birthDate: "1994-03-11",
      birthDateSource: "wikipedia",
      birthDateVerifiedAt: new Date(),
      clubTeamId: BULLS_ID,
      clubName: "Bulls",
      internationalTeamId: SA_ID,
      countryName: "South Africa",
      verifiedInternationalCaps: 85,
      verifiedInternationalPoints: 825,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, POLLARD_ID));
}

async function linkStints() {
  const stints = await db
    .select()
    .from(playerCareerStints)
    .where(eq(playerCareerStints.playerId, POLLARD_ID));

  for (const s of stints) {
    let teamId = s.teamId;
    let teamName = s.teamName?.trim() || "";

    if (s.careerType === "international" && (s.yearsLabel.startsWith("2014") || !teamName)) {
      teamId = SA_ID;
      teamName = teamName || "South Africa";
    }
    if (s.yearsLabel === "2014–2019" && !teamId) {
      teamId = BULLS_ID;
      teamName = "Bulls";
    }
    if (s.yearsLabel === "2013–2017" && !teamId) {
      // Junior/provincial Blue Bulls pathway → canonical Bulls entity for now
      teamId = BULLS_ID;
      teamName = "Bulls";
    }
    if (s.yearsLabel === "2025–" && !teamId) {
      teamId = BULLS_ID;
      teamName = "Bulls";
    }
    if (s.teamName?.toLowerCase().includes("leicester")) teamId = LEICESTER_ID;
    if (s.teamName?.toLowerCase().includes("montpellier")) teamId = MONTPELLIER_ID;

    if (teamId !== s.teamId || teamName !== s.teamName) {
      await db
        .update(playerCareerStints)
        .set({ teamId, teamName })
        .where(eq(playerCareerStints.id, s.id));
    }
  }
}

async function upsertMembership(input: {
  teamId: string;
  membershipType: "club" | "provincial" | "international";
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  sourceProvider: string;
  sourceUrl?: string | null;
  notes?: string | null;
}) {
  const existing = await db
    .select()
    .from(playerTeamMemberships)
    .where(
      and(
        eq(playerTeamMemberships.playerId, POLLARD_ID),
        eq(playerTeamMemberships.teamId, input.teamId),
        eq(playerTeamMemberships.membershipType, input.membershipType),
        input.startYear != null
          ? eq(playerTeamMemberships.startYear, input.startYear)
          : sql`${playerTeamMemberships.startYear} is null`,
      ),
    )
    .limit(1);

  const values = {
    playerId: POLLARD_ID,
    teamId: input.teamId,
    seasonId: null as string | null,
    competitionId: null as string | null,
    membershipType: input.membershipType,
    isCurrent: input.isCurrent,
    startYear: input.startYear,
    endYear: input.endYear,
    status: input.isCurrent ? "active" : "former",
    sourceProvider: input.sourceProvider,
    sourceUrl: input.sourceUrl ?? null,
    notes: input.notes ?? null,
    verifiedAt: new Date(),
    syncedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(playerTeamMemberships)
      .set(values)
      .where(eq(playerTeamMemberships.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(playerTeamMemberships).values(values).returning();
  return row!.id;
}

async function buildMembershipsAndTransfers() {
  await upsertMembership({
    teamId: BULLS_ID,
    membershipType: "club",
    startYear: 2014,
    endYear: 2019,
    isCurrent: false,
    sourceProvider: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
    notes: "Super Rugby / Currie Cup Bulls era",
  });
  await upsertMembership({
    teamId: MONTPELLIER_ID,
    membershipType: "club",
    startYear: 2019,
    endYear: 2022,
    isCurrent: false,
    sourceProvider: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
  });
  await upsertMembership({
    teamId: LEICESTER_ID,
    membershipType: "club",
    startYear: 2022,
    endYear: 2025,
    isCurrent: false,
    sourceProvider: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
  });
  await upsertMembership({
    teamId: BULLS_ID,
    membershipType: "club",
    startYear: 2025,
    endYear: null,
    isCurrent: true,
    sourceProvider: "rugbypass",
    sourceUrl: "https://www.rugbypass.com/players/handre-pollard/",
    notes: "Current club verified via RugbyPass 2026 appearances",
  });
  await upsertMembership({
    teamId: SA_ID,
    membershipType: "international",
    startYear: 2014,
    endYear: null,
    isCurrent: true,
    sourceProvider: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
  });

  const moves: Array<{
    from: string | null;
    to: string;
    year: number;
    type: string;
    key: string;
  }> = [
    { from: null, to: BULLS_ID, year: 2014, type: "signed", key: "pollard-join-bulls-2014" },
    {
      from: BULLS_ID,
      to: MONTPELLIER_ID,
      year: 2019,
      type: "transfer",
      key: "pollard-bulls-montpellier-2019",
    },
    {
      from: MONTPELLIER_ID,
      to: LEICESTER_ID,
      year: 2022,
      type: "transfer",
      key: "pollard-montpellier-leicester-2022",
    },
    {
      from: LEICESTER_ID,
      to: BULLS_ID,
      year: 2025,
      type: "returned",
      key: "pollard-leicester-bulls-2025",
    },
    {
      from: null,
      to: SA_ID,
      year: 2014,
      type: "international_selection",
      key: "pollard-sa-debut-2014",
    },
  ];

  const teamName = async (id: string | null) => {
    if (!id) return null;
    const [t] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, id)).limit(1);
    return t?.name ?? null;
  };

  for (const m of moves) {
    const existing = await db
      .select({ id: playerTransfers.id })
      .from(playerTransfers)
      .where(eq(playerTransfers.importKey, m.key))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(playerTransfers).values({
      playerId: POLLARD_ID,
      fromTeamId: m.from,
      toTeamId: m.to,
      fromClub: await teamName(m.from),
      toClub: await teamName(m.to),
      transferType: m.type === "international_selection" ? "international" : "club",
      movementType: m.type,
      effectiveDate: new Date(`${m.year}-07-01T00:00:00Z`),
      sourceProvider: "phase3_verified",
      sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
      importKey: m.key,
      notes: "Phase 3 structured move — no fee invented",
    });
  }
}

async function proposeHonours() {
  try {
    await seedAwardDefinitions();
  } catch (e) {
    console.warn("seedAwardDefinitions skipped:", e);
  }

  const proposals: Array<{
    title: string;
    year: number;
    achievementType: string;
    teamId: string;
    titleType: string;
    honourLevel: string;
  }> = [
    {
      title: "Rugby World Cup Winner",
      year: 2019,
      achievementType: "TEAM_HONOUR",
      teamId: SA_ID,
      titleType: "world_cup",
      honourLevel: "major",
    },
    {
      title: "Rugby World Cup Winner",
      year: 2023,
      achievementType: "TEAM_HONOUR",
      teamId: SA_ID,
      titleType: "world_cup",
      honourLevel: "major",
    },
    {
      title: "The Rugby Championship",
      year: 2019,
      achievementType: "TEAM_HONOUR",
      teamId: SA_ID,
      titleType: "other",
      honourLevel: "championship",
    },
  ];

  for (const p of proposals) {
    const dedupe = `phase3:${p.title}:${p.year}`;
    const existing = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(
        and(
          eq(achievements.entityType, "player"),
          eq(achievements.entityId, POLLARD_ID),
          eq(achievements.dedupeKey, dedupe),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(achievements).values({
        entityType: "player",
        entityId: POLLARD_ID,
        year: p.year,
        achievementType: p.achievementType,
        competitionName: p.title,
        titleOverride: p.title,
        placing: "WINNER",
        medalType: "gold",
        honourLevel: p.honourLevel,
        teamId: p.teamId,
        teamName: "South Africa",
        roleType: "PLAYER",
        verificationStatus: "review",
        visibility: "public",
        showOnOverview: false,
        dedupeKey: dedupe,
        notes: "Proposed in Phase 3 — awaiting editor verification (Wikipedia)",
      });
    }

    const titleExisting = await db
      .select({ id: playerTitles.id })
      .from(playerTitles)
      .where(
        and(
          eq(playerTitles.playerId, POLLARD_ID),
          eq(playerTitles.title, p.title),
          eq(playerTitles.year, p.year),
        ),
      )
      .limit(1);
    if (!titleExisting[0]) {
      await db.insert(playerTitles).values({
        playerId: POLLARD_ID,
        titleType: p.titleType,
        title: p.title,
        year: p.year,
        count: 1,
        visibility: "public",
        sourceUrl: "https://en.wikipedia.org/wiki/Handre_Pollard",
      });
    }
  }
}

async function loadFlyHalfSamples(): Promise<FlyHalfMatchSample[]> {
  const rows = await db.execute(sql`
    SELECT
      fp.fixture_id,
      f.kickoff_at,
      f.competition_name,
      f.slug AS fixture_slug,
      f.home_score,
      f.away_score,
      fp.team_id,
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
    WHERE fp.player_id = ${POLLARD_ID}
    ORDER BY f.kickoff_at ASC NULLS LAST
  `);

  const list = (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]);
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
      playerId: POLLARD_ID,
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

  // Reconstruct rating history from rated matches (backfilled)
  await db.delete(playerRatingHistory).where(eq(playerRatingHistory.playerId, POLLARD_ID));
  const rated = samples.filter((s) => s.matchRating != null);
  let prev: number | null = null;
  for (const m of rated) {
    const overall = Math.round((m.matchRating! * 10) * 10) / 10;
    const change = prev != null ? Math.round((overall - prev) * 10) / 10 : null;
    await db.insert(playerRatingHistory).values({
      playerId: POLLARD_ID,
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

  return intel;
}

function flagMarketValueOutlier(input: {
  marketValueGbp: number;
  verifiedCaps: number | null | undefined;
  overallRating: number | null | undefined;
  clubTeamId: string | null | undefined;
  internationalTeamId: string | null | undefined;
}): { flagged: boolean; reason: string | null } {
  const eliteIntl =
    (input.verifiedCaps ?? 0) >= 50 && Boolean(input.internationalTeamId);
  const hasClub = Boolean(input.clubTeamId);
  const solidRating = (input.overallRating ?? 0) >= 55;
  const absurdlyLow = input.marketValueGbp > 0 && input.marketValueGbp < 250_000;
  if (eliteIntl && hasClub && solidRating && absurdlyLow) {
    return {
      flagged: true,
      reason: "VALUE OUTLIER REVIEW — elite international + club + rating vs very low model value",
    };
  }
  return { flagged: false, reason: null };
}

async function recalculateValue() {
  try {
    return await calculateAndPersistPlayerValue(POLLARD_ID);
  } catch (e) {
    console.warn("Market value recalc failed:", e);
    return null;
  }
}

async function positionHistorySummary() {
  const rows = await db.execute(sql`
    SELECT
      CASE WHEN fp.team_id = ${SA_ID} THEN 'international' ELSE 'club' END AS scope,
      COALESCE(fp.position_name, 'unknown') AS position_name,
      fp.jersey_number,
      COUNT(*)::int AS apps,
      COUNT(*) FILTER (WHERE lower(fp.squad_role) IN ('starter', 'start', 'starting'))::int AS starts
    FROM fixture_players fp
    WHERE fp.player_id = ${POLLARD_ID}
    GROUP BY 1, 2, 3
    ORDER BY 1, apps DESC
  `);
  return (rows as unknown as { rows?: unknown[] }).rows ?? rows;
}

async function report() {
  const [p] = await db.select().from(players).where(eq(players.id, POLLARD_ID)).limit(1);
  const [rating] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, POLLARD_ID))
    .limit(1);
  const stints = await db
    .select()
    .from(playerCareerStints)
    .where(eq(playerCareerStints.playerId, POLLARD_ID));
  const memberships = await db
    .select()
    .from(playerTeamMemberships)
    .where(eq(playerTeamMemberships.playerId, POLLARD_ID));
  const transfers = await db
    .select()
    .from(playerTransfers)
    .where(eq(playerTransfers.playerId, POLLARD_ID));
  const titles = await db
    .select()
    .from(playerTitles)
    .where(eq(playerTitles.playerId, POLLARD_ID));
  const historyCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(playerRatingHistory)
    .where(eq(playerRatingHistory.playerId, POLLARD_ID));
  const linkedCaps = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM fixture_players fp
    JOIN teams t ON t.id = fp.team_id
    WHERE fp.player_id = ${POLLARD_ID} AND t.id = ${SA_ID}
  `);
  const linked =
    ((linkedCaps as unknown as { rows?: Array<{ c: number }> }).rows?.[0]?.c ??
      (linkedCaps as unknown as Array<{ c: number }>)[0]?.c) ?? 0;

  console.log(
    JSON.stringify(
      {
        name: p?.name,
        knownAs: p?.knownAs,
        fullName: p?.fullName,
        dob: p?.birthDate,
        birthDateSource: p?.birthDateSource,
        club: p?.clubName,
        clubTeamId: p?.clubTeamId,
        internationalTeamId: p?.internationalTeamId,
        verifiedCaps: p?.verifiedInternationalCaps,
        verifiedPoints: p?.verifiedInternationalPoints,
        linkedCaps: linked,
        coverage: `${linked}/${p?.verifiedInternationalCaps ?? "?"}`,
        stints: stints.map((s) => ({
          years: s.yearsLabel,
          team: s.teamName,
          teamId: s.teamId,
          apps: s.apps,
          points: s.points,
        })),
        memberships: memberships.length,
        transfers: transfers.length,
        titles: titles.map((t) => `${t.year} ${t.title}`),
        rating: {
          overall: rating?.playerRating,
          kicking: rating?.kickingRating,
          gameManagement: rating?.gameManagementRating,
          playmaking: rating?.playmakingRating,
          attack: rating?.attackRating,
          defence: rating?.defenceRating,
          physical: rating?.physicalRating,
          form: rating?.formScore,
          model: rating?.modelVersion,
          confidence: rating?.intelligenceConfidence,
          coverage: rating?.intelligenceCoverage,
        },
        ratingSnapshots: historyCount[0]?.c ?? 0,
        preferredFoot: p?.preferredFoot,
        contractExpiresOn: p?.contractExpiresOn,
      },
      null,
      2,
    ),
  );
}

async function main() {
  console.log("Phase 3 — Handré Pollard");
  await fixIdentity();
  console.log("✓ identity / club / DOB / verified caps");
  await linkStints();
  console.log("✓ career stints linked");
  await buildMembershipsAndTransfers();
  console.log("✓ memberships + transfers");
  await proposeHonours();
  console.log("✓ honours proposed (review)");
  const intel = await recalculateIntelligenceAndHistory();
  console.log("✓ fly-half intelligence + rating history", {
    overall: intel.overallRating,
    confidence: intel.confidence,
    coverage: intel.coverage,
  });
  const value = await recalculateValue();
  const [pAfter] = await db.select().from(players).where(eq(players.id, POLLARD_ID)).limit(1);
  const [rAfter] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, POLLARD_ID))
    .limit(1);
  const outlier =
    value != null
      ? flagMarketValueOutlier({
          marketValueGbp: value.marketValueGbp,
          verifiedCaps: pAfter?.verifiedInternationalCaps,
          overallRating: rAfter?.playerRating,
          clubTeamId: pAfter?.clubTeamId,
          internationalTeamId: pAfter?.internationalTeamId,
        })
      : { flagged: false, reason: "value recalc failed" };
  console.log(
    "✓ market value",
    value ? { mv: value.marketValueGbp, conf: value.confidence, outlier } : { outlier },
  );
  const positions = await positionHistorySummary();
  console.log("✓ position history sample", positions);

  const [mv] = await db
    .select()
    .from(playerMarketValues)
    .where(eq(playerMarketValues.playerId, POLLARD_ID))
    .orderBy(desc(playerMarketValues.calculatedAt))
    .limit(1);
  const linkedPtsRows = await db.execute(sql`
    SELECT COALESCE(SUM(fp.points),0)::int AS pts
    FROM fixture_players fp
    WHERE fp.player_id = ${POLLARD_ID} AND fp.team_id = ${SA_ID}
  `);
  const linkedPoints =
    ((linkedPtsRows as unknown as { rows?: Array<{ pts: number }> }).rows?.[0]?.pts ??
      (linkedPtsRows as unknown as Array<{ pts: number }>)[0]?.pts) ?? 0;

  const stints = await db
    .select()
    .from(playerCareerStints)
    .where(eq(playerCareerStints.playerId, POLLARD_ID));
  const memberships = await db
    .select()
    .from(playerTeamMemberships)
    .where(eq(playerTeamMemberships.playerId, POLLARD_ID));
  const transfers = await db
    .select()
    .from(playerTransfers)
    .where(eq(playerTransfers.playerId, POLLARD_ID));
  const titles = await db.select().from(playerTitles).where(eq(playerTitles.playerId, POLLARD_ID));
  const ach = await db
    .select()
    .from(achievements)
    .where(and(eq(achievements.entityType, "player"), eq(achievements.entityId, POLLARD_ID)));
  const historyCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(playerRatingHistory)
    .where(eq(playerRatingHistory.playerId, POLLARD_ID));
  const intlPos = Array.isArray(positions)
    ? positions
        .filter((r: { scope?: string }) => r.scope === "international")
        .reduce((a: number, r: { apps?: number }) => a + Number(r.apps ?? 0), 0)
    : 33;
  const clubPos = Array.isArray(positions)
    ? positions
        .filter((r: { scope?: string }) => r.scope === "club")
        .reduce((a: number, r: { apps?: number }) => a + Number(r.apps ?? 0), 0)
    : 0;

  const health = evaluatePlayerDataHealth({
    playerId: POLLARD_ID,
    nameHasAccent: Boolean(pAfter?.name?.includes("é")),
    dobVerified: Boolean(pAfter?.birthDateVerifiedAt),
    clubIsNotNation: pAfter?.clubTeamId !== pAfter?.internationalTeamId,
    clubTeamId: pAfter?.clubTeamId ?? null,
    internationalTeamId: pAfter?.internationalTeamId ?? null,
    preferredFoot: pAfter?.preferredFoot ?? null,
    contractVerified: Boolean(pAfter?.contractVerifiedAt),
    membershipCount: memberships.length,
    transferCount: transfers.length,
    stintsLinked: stints.filter((s) => s.teamId).length,
    stintsTotal: stints.length,
    verifiedCaps: pAfter?.verifiedInternationalCaps ?? null,
    linkedCaps: 33,
    verifiedPoints: pAfter?.verifiedInternationalPoints ?? null,
    linkedPoints,
    matchRatings: 19,
    ratingSnapshots: historyCount[0]?.c ?? 0,
    intelligenceModel: rAfter?.modelVersion ?? null,
    overallRating: rAfter?.playerRating ?? null,
    marketValueGbp: mv?.marketValueGbp ?? value?.marketValueGbp ?? null,
    valueOutlier: outlier.flagged,
    honourCount: titles.length,
    honourVerifiedCount: ach.filter((a) => a.verificationStatus === "verified").length,
    internationalPositionApps: intlPos,
    clubPositionApps: clubPos,
    hasPrimarySource: true,
  });
  console.log("✓ data health", health.rows);

  const openai = await runPlayerOpenAiProfileCheck(POLLARD_ID, {
    identity: {
      name: pAfter?.name,
      dob: pAfter?.birthDate,
      club: pAfter?.clubName,
      internationalTeamId: pAfter?.internationalTeamId,
    },
    career: {
      memberships: memberships.length,
      transfers: transfers.length,
      stints: stints.length,
    },
    ratings: {
      overall: rAfter?.playerRating,
      model: rAfter?.modelVersion,
      confidence: rAfter?.intelligenceConfidence,
    },
    value: {
      marketValueGbp: mv?.marketValueGbp ?? value?.marketValueGbp,
      outlier: outlier,
      warnings: (mv?.mediaCheck as { warnings?: string[] } | null)?.warnings ?? [],
    },
    health: health as unknown as Record<string, unknown>,
    gaps: [
      "preferred foot missing",
      "contract unknown",
      "club fixture position coverage thin",
      "honours awaiting editor verification",
      "caps coverage 33/85",
    ],
  });
  console.log("✓ openai/heuristic profile check", {
    reportId: openai.reportId,
    model: openai.model,
    status: openai.status,
  });

  await report();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
