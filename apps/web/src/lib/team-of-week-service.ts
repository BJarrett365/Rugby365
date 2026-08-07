/**
 * Team of the Week — generate, load, publish (round-scoped editions).
 */
import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  coachMatchRatings,
  coaches,
  competitions,
  competitionSeasons,
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  players,
  refereeMatchRatings,
  referees,
  teamMatchStats,
  teamOfWeekAwards,
  teamOfWeekEditionFixtures,
  teamOfWeekEditions,
  teamOfWeekSelections,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { isFixtureRatingsPublished } from "./match-rating-math";
import {
  extractRoundNumber,
  formatRoundName,
  normalizeRoundKey,
  selectImpactBench,
  selectPlayerOfWeek,
  selectStartingXv,
  TOTW_METHOD_VERSION,
  type TotwCandidate,
  type TotwPlayerStats,
  type TotwPick,
} from "./team-of-week-math";

export type TotwEditionStatus =
  | "draft"
  | "generated"
  | "under_review"
  | "approved"
  | "published"
  | "archived"
  | "locked";

function emptyStats(minutes: number): TotwPlayerStats {
  return {
    tries: 0,
    tryAssists: 0,
    tacklesMade: 0,
    tacklesCompleted: 0,
    dominantTackles: 0,
    turnoversWon: 0,
    carries: 0,
    metresCarried: 0,
    lineBreaks: 0,
    defendersBeaten: 0,
    points: 0,
    minutesPlayed: minutes,
    missedTackles: null,
    offloads: null,
    passes: null,
    kicksFromHand: null,
  };
}

function extrasNum(extras: unknown, key: string): number | null {
  if (!extras || typeof extras !== "object") return null;
  const v = (extras as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function listRoundsForSeason(input: {
  competitionId: string;
  seasonId: string;
}): Promise<
  Array<{
    roundKey: string;
    roundName: string;
    roundNumber: number | null;
    fixtureCount: number;
    completedCount: number;
    ratedPlayerCount: number;
    squadPlayerCount: number;
    status: string;
    dateFrom: string | null;
    dateTo: string | null;
    editionId: string | null;
    editionStatus: string | null;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      round: fixtures.round,
      status: fixtures.status,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, input.competitionId),
        eq(fixtures.seasonId, input.seasonId),
        sql`${fixtures.round} is not null`,
        sql`trim(${fixtures.round}) <> ''`,
      ),
    )
    .orderBy(asc(fixtures.kickoffAt));

  const fixtureIds = rows.map((r) => r.id);
  const [editions, ratingCounts, squadCounts] = await Promise.all([
    db
      .select({
        id: teamOfWeekEditions.id,
        roundKey: teamOfWeekEditions.roundKey,
        status: teamOfWeekEditions.status,
      })
      .from(teamOfWeekEditions)
      .where(
        and(
          eq(teamOfWeekEditions.competitionId, input.competitionId),
          eq(teamOfWeekEditions.seasonId, input.seasonId),
        ),
      ),
    fixtureIds.length
      ? db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            n: sql<number>`count(*)::int`,
          })
          .from(playerMatchRatings)
          .where(
            and(
              inArray(playerMatchRatings.fixtureId, fixtureIds),
              sql`${playerMatchRatings.rating} is not null`,
            ),
          )
          .groupBy(playerMatchRatings.fixtureId)
      : Promise.resolve([] as Array<{ fixtureId: string; n: number }>),
    fixtureIds.length
      ? db
          .select({
            fixtureId: fixturePlayers.fixtureId,
            n: sql<number>`count(*)::int`,
          })
          .from(fixturePlayers)
          .where(inArray(fixturePlayers.fixtureId, fixtureIds))
          .groupBy(fixturePlayers.fixtureId)
      : Promise.resolve([] as Array<{ fixtureId: string; n: number }>),
  ]);
  const editionByKey = new Map(editions.map((e) => [e.roundKey, e]));
  const ratingsByFixture = new Map(ratingCounts.map((r) => [r.fixtureId, Number(r.n)]));
  const squadByFixture = new Map(squadCounts.map((r) => [r.fixtureId, Number(r.n)]));

  type Acc = {
    roundKey: string;
    roundName: string;
    roundNumber: number | null;
    fixtureCount: number;
    completedCount: number;
    ratedPlayerCount: number;
    squadPlayerCount: number;
    kicks: Date[];
  };
  const byKey = new Map<string, Acc>();

  for (const f of rows) {
    const key = normalizeRoundKey(f.round);
    if (!key) continue;
    const acc = byKey.get(key) ?? {
      roundKey: key,
      roundName: formatRoundName(key, f.round),
      roundNumber: extractRoundNumber(f.round),
      fixtureCount: 0,
      completedCount: 0,
      ratedPlayerCount: 0,
      squadPlayerCount: 0,
      kicks: [],
    };
    acc.fixtureCount += 1;
    if (isFixtureRatingsPublished(f.status)) acc.completedCount += 1;
    acc.ratedPlayerCount += ratingsByFixture.get(f.id) ?? 0;
    acc.squadPlayerCount += squadByFixture.get(f.id) ?? 0;
    if (f.kickoffAt) acc.kicks.push(f.kickoffAt);
    byKey.set(key, acc);
  }

  return [...byKey.values()]
    .map((r) => {
      const kicks = r.kicks.sort((a, b) => a.getTime() - b.getTime());
      let status = "not_started";
      if (r.completedCount === 0 && r.fixtureCount > 0) {
        const anyStarted = kicks.some((k) => k.getTime() <= Date.now());
        status = anyStarted ? "in_progress" : "not_started";
      } else if (r.completedCount < r.fixtureCount) status = "in_progress";
      else if (r.ratedPlayerCount < 15) status = "awaiting_data";
      else status = "ready_to_generate";
      const ed = editionByKey.get(r.roundKey);
      if (ed) {
        if (ed.status === "published" || ed.status === "locked") status = ed.status;
        else if (ed.status === "generated" || ed.status === "under_review") status = ed.status;
        else if (ed.status === "approved") status = "approved";
        else status = "generated";
      }
      return {
        roundKey: r.roundKey,
        roundName: r.roundName,
        roundNumber: r.roundNumber,
        fixtureCount: r.fixtureCount,
        completedCount: r.completedCount,
        ratedPlayerCount: r.ratedPlayerCount,
        squadPlayerCount: r.squadPlayerCount,
        status,
        dateFrom: kicks[0]?.toISOString() ?? null,
        dateTo: kicks[kicks.length - 1]?.toISOString() ?? null,
        editionId: ed?.id ?? null,
        editionStatus: ed?.status ?? null,
      };
    })
    .sort((a, b) => (a.roundNumber ?? 999) - (b.roundNumber ?? 999) || a.roundKey.localeCompare(b.roundKey));
}

async function loadRoundFixtures(input: {
  competitionId: string;
  seasonId: string;
  roundKey: string;
}) {
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      round: fixtures.round,
      status: fixtures.status,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
      refereeId: fixtures.refereeId,
      externalMatchId: fixtures.externalMatchId,
    })
    .from(fixtures)
    .where(
      and(eq(fixtures.competitionId, input.competitionId), eq(fixtures.seasonId, input.seasonId)),
    );

  if (input.roundKey === "team-of-the-tournament") {
    return rows.filter((f) => {
      const ext = f.externalMatchId ?? "";
      if (ext.startsWith("rwc-wiki-statistics:") || ext.startsWith("rwc-opta-leaderboard:")) {
        return false;
      }
      return isFixtureRatingsPublished(f.status);
    });
  }

  return rows.filter((f) => normalizeRoundKey(f.round) === input.roundKey);
}

async function buildCandidates(fixtureIds: string[]): Promise<TotwCandidate[]> {
  if (!fixtureIds.length) return [];
  const db = getDb();

  const [ratingRows, perfRows, fixtureRows] = await Promise.all([
    db
      .select({
        fixtureId: playerMatchRatings.fixtureId,
        playerId: playerMatchRatings.playerId,
        teamId: playerMatchRatings.teamId,
        positionName: playerMatchRatings.positionName,
        jerseyNumber: playerMatchRatings.jerseyNumber,
        squadRole: playerMatchRatings.squadRole,
        minutesPlayed: playerMatchRatings.minutesPlayed,
        rating: playerMatchRatings.rating,
      })
      .from(playerMatchRatings)
      .where(
        and(
          inArray(playerMatchRatings.fixtureId, fixtureIds),
          sql`${playerMatchRatings.rating} is not null`,
        ),
      ),
    db
      .select()
      .from(playerMatchPerformanceStats)
      .where(inArray(playerMatchPerformanceStats.fixtureId, fixtureIds)),
    db
      .select({
        id: fixtures.id,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(fixtures)
      .where(inArray(fixtures.id, fixtureIds)),
  ]);

  const playerIds = [...new Set(ratingRows.map((r) => r.playerId))];
  const teamIds = [...new Set(ratingRows.map((r) => r.teamId))];
  const [teamRows, playerRows] = await Promise.all([
    teamIds.length
      ? db
          .select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            imageUrl: teams.imageUrl,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : Promise.resolve([]),
    playerIds.length
      ? db
          .select({
            id: players.id,
            name: players.name,
            slug: players.slug,
            imageUrl: players.imageUrl,
          })
          .from(players)
          .where(inArray(players.id, playerIds))
      : Promise.resolve([]),
  ]);

  const fixtureById = new Map(fixtureRows.map((f) => [f.id, f]));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const playerById = new Map(playerRows.map((p) => [p.id, p]));
  const perfByKey = new Map(
    perfRows.map((p) => [`${p.fixtureId}:${p.playerId}`, p] as const),
  );

  // Keep best rating per player across the round.
  const bestByPlayer = new Map<string, TotwCandidate>();

  for (const r of ratingRows) {
    if (r.rating == null || r.rating < 5.5) continue;
    if (r.minutesPlayed < 20) continue;
    const fx = fixtureById.get(r.fixtureId);
    const team = teamById.get(r.teamId);
    const player = playerById.get(r.playerId);
    if (!fx || !team || !player) continue;

    const won =
      fx.homeTeamId === r.teamId
        ? (fx.homeScore ?? 0) > (fx.awayScore ?? 0)
        : (fx.awayScore ?? 0) > (fx.homeScore ?? 0);

    const perf = perfByKey.get(`${r.fixtureId}:${r.playerId}`);
    const stats: TotwPlayerStats = perf
      ? {
          tries: perf.tries ?? 0,
          tryAssists: perf.tryAssists ?? 0,
          tacklesMade: perf.tacklesMade ?? 0,
          tacklesCompleted: perf.tacklesCompleted ?? 0,
          dominantTackles: perf.dominantTackles ?? 0,
          turnoversWon: perf.turnoversWon ?? 0,
          carries: perf.carries ?? 0,
          metresCarried: perf.metresCarried ?? 0,
          lineBreaks: perf.lineBreaks ?? 0,
          defendersBeaten: perf.defendersBeaten ?? 0,
          points: perf.points ?? 0,
          minutesPlayed: perf.minutesPlayed || r.minutesPlayed,
          missedTackles: extrasNum(perf.extras, "missedTackles"),
          offloads: extrasNum(perf.extras, "offloads"),
          passes: extrasNum(perf.extras, "passes"),
          kicksFromHand:
            extrasNum(perf.extras, "kicksFromHand") ?? extrasNum(perf.extras, "kicks"),
        }
      : emptyStats(r.minutesPlayed);

    const candidate: TotwCandidate = {
      playerId: r.playerId,
      playerName: player.name,
      playerSlug: player.slug,
      imageUrl: player.imageUrl,
      teamId: r.teamId,
      teamName: team.name,
      teamSlug: team.slug,
      teamImageUrl: team.imageUrl,
      fixtureId: r.fixtureId,
      positionName: r.positionName,
      jerseyNumber: r.jerseyNumber,
      squadRole: r.squadRole,
      matchRating: r.rating,
      stats,
      wonMatch: won,
    };

    const prev = bestByPlayer.get(r.playerId);
    if (!prev || candidate.matchRating > prev.matchRating) {
      bestByPlayer.set(r.playerId, candidate);
    }
  }

  return [...bestByPlayer.values()];
}

function pickToRow(
  editionId: string,
  pick: TotwPick,
  sortOrder: number,
): typeof teamOfWeekSelections.$inferInsert {
  const c = pick.candidate;
  return {
    editionId,
    playerId: c.playerId,
    teamId: c.teamId,
    fixtureId: c.fixtureId,
    selectionType: pick.selectionType,
    positionCode: pick.slot.code,
    shirtNumber: pick.slot.shirt,
    matchRating: c.matchRating,
    selectionScore: pick.selectionScore,
    confidencePct: pick.confidencePct,
    rankAtPosition: pick.rankAtPosition,
    shortReason: pick.shortReason,
    fullReason: pick.fullReason,
    isAutomated: true,
    isManualOverride: false,
    sortOrder,
    snapshot: {
      playerName: c.playerName,
      playerSlug: c.playerSlug,
      imageUrl: c.imageUrl,
      teamName: c.teamName,
      teamSlug: c.teamSlug,
      teamImageUrl: c.teamImageUrl,
      positionLabel: pick.slot.label,
      stats: c.stats,
      gapToNext: pick.gapToNext,
    },
  };
}

async function buildRoundSummary(fixtureIds: string[]) {
  if (!fixtureIds.length) {
    return {
      matchesPlayed: 0,
      totalTries: 0,
      totalPoints: 0,
      totalTackles: 0,
      totalMetres: 0,
      yellowCards: 0,
      redCards: 0,
      highestRatedPlayer: null as null | { name: string; rating: number },
    };
  }
  const db = getDb();
  const [teamStats, ratings, fx] = await Promise.all([
    db
      .select({
        tries: teamMatchStats.tries,
        metres: teamMatchStats.metres,
        tackles: teamMatchStats.tackles,
      })
      .from(teamMatchStats)
      .where(inArray(teamMatchStats.fixtureId, fixtureIds)),
    db
      .select({
        rating: playerMatchRatings.rating,
        playerId: playerMatchRatings.playerId,
      })
      .from(playerMatchRatings)
      .where(
        and(
          inArray(playerMatchRatings.fixtureId, fixtureIds),
          sql`${playerMatchRatings.rating} is not null`,
        ),
      )
      .orderBy(desc(playerMatchRatings.rating))
      .limit(1),
    db
      .select({
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(fixtures)
      .where(inArray(fixtures.id, fixtureIds)),
  ]);

  let totalTries = 0;
  let totalTackles = 0;
  let totalMetres = 0;
  for (const t of teamStats) {
    totalTries += t.tries ?? 0;
    totalTackles += t.tackles ?? 0;
    totalMetres += t.metres ?? 0;
  }
  let totalPoints = 0;
  for (const f of fx) totalPoints += (f.homeScore ?? 0) + (f.awayScore ?? 0);

  let highestRatedPlayer: { name: string; rating: number } | null = null;
  if (ratings[0]?.playerId && ratings[0].rating != null) {
    const p = await db
      .select({ name: players.name })
      .from(players)
      .where(eq(players.id, ratings[0].playerId))
      .limit(1);
    highestRatedPlayer = {
      name: p[0]?.name ?? "Player",
      rating: ratings[0].rating,
    };
  }

  return {
    matchesPlayed: fixtureIds.length,
    totalTries,
    totalPoints,
    totalTackles,
    totalMetres,
    yellowCards: 0,
    redCards: 0,
    highestRatedPlayer,
  };
}

async function selectCoachOfWeek(fixtureIds: string[]) {
  if (!fixtureIds.length) return null;
  const db = getDb();
  const rows = await db
    .select({
      coachId: coachMatchRatings.coachId,
      teamId: coachMatchRatings.teamId,
      fixtureId: coachMatchRatings.fixtureId,
      rating: coachMatchRatings.rating,
      coachName: coaches.name,
      coachSlug: coaches.slug,
      imageUrl: coaches.imageUrl,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamImageUrl: teams.imageUrl,
    })
    .from(coachMatchRatings)
    .innerJoin(coaches, eq(coachMatchRatings.coachId, coaches.id))
    .leftJoin(teams, eq(coachMatchRatings.teamId, teams.id))
    .where(
      and(
        inArray(coachMatchRatings.fixtureId, fixtureIds),
        sql`${coachMatchRatings.rating} is not null`,
      ),
    )
    .orderBy(desc(coachMatchRatings.rating))
    .limit(1);

  const row = rows[0];
  if (!row?.coachId || row.rating == null) return null;
  return {
    awardType: "COACH_OF_WEEK" as const,
    coachId: row.coachId,
    teamId: row.teamId,
    fixtureId: row.fixtureId,
    rating: row.rating,
    score: row.rating,
    shortReason: `Match rating ${row.rating.toFixed(1)}`,
    fullReason: `${row.coachName} posted the strongest coach match rating of the round (${row.rating.toFixed(1)}).`,
    snapshot: {
      name: row.coachName,
      slug: row.coachSlug,
      imageUrl: row.imageUrl,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      teamImageUrl: row.teamImageUrl,
      limitedData: true,
    },
  };
}

async function selectRefereeOfWeek(fixtureIds: string[]) {
  if (!fixtureIds.length) return null;
  const db = getDb();
  const rows = await db
    .select({
      refereeId: refereeMatchRatings.refereeId,
      fixtureId: refereeMatchRatings.fixtureId,
      rating: refereeMatchRatings.rating,
      name: referees.name,
      slug: referees.slug,
      imageUrl: referees.imageUrl,
    })
    .from(refereeMatchRatings)
    .innerJoin(referees, eq(refereeMatchRatings.refereeId, referees.id))
    .where(
      and(
        inArray(refereeMatchRatings.fixtureId, fixtureIds),
        sql`${refereeMatchRatings.rating} is not null`,
      ),
    )
    .orderBy(desc(refereeMatchRatings.rating))
    .limit(1);

  const row = rows[0];
  if (!row?.refereeId || row.rating == null) return null;
  return {
    awardType: "REFEREE_OF_WEEK" as const,
    refereeId: row.refereeId,
    fixtureId: row.fixtureId,
    rating: row.rating,
    score: row.rating,
    shortReason: `Match rating ${row.rating.toFixed(1)}`,
    fullReason: `${row.name} earned Referee of the Week on available match-rating data (${row.rating.toFixed(1)}). Decision-accuracy metrics are not stored — shown as limited data.`,
    snapshot: {
      name: row.name,
      slug: row.slug,
      imageUrl: row.imageUrl,
      limitedData: true,
    },
  };
}

function topTeamFromStarting(starting: TotwPick[]) {
  const counts = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      teamSlug: string | null;
      teamImageUrl: string | null;
      n: number;
      pdHint: number;
    }
  >();
  for (const p of starting) {
    const cur = counts.get(p.candidate.teamId) ?? {
      teamId: p.candidate.teamId,
      teamName: p.candidate.teamName,
      teamSlug: p.candidate.teamSlug,
      teamImageUrl: p.candidate.teamImageUrl,
      n: 0,
      pdHint: 0,
    };
    cur.n += 1;
    if (p.candidate.wonMatch) cur.pdHint += 1;
    counts.set(p.candidate.teamId, cur);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!best) return null;
  return {
    awardType: "TEAM_OF_WEEK" as const,
    teamId: best.teamId,
    rating: null as number | null,
    score: best.n,
    shortReason: `${best.n} players selected`,
    fullReason: `${best.teamName} contributed the most Team of the Week selections (${best.n}).`,
    snapshot: {
      teamName: best.teamName,
      teamSlug: best.teamSlug,
      teamImageUrl: best.teamImageUrl,
      selections: best.n,
      name: best.teamName,
      slug: best.teamSlug,
    },
  };
}

async function findPreviousPublishedEdition(input: {
  competitionId: string;
  seasonId: string;
  roundNumber: number | null;
  roundKey: string;
  excludeId?: string;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(teamOfWeekEditions)
    .where(
      and(
        eq(teamOfWeekEditions.competitionId, input.competitionId),
        eq(teamOfWeekEditions.seasonId, input.seasonId),
        inArray(teamOfWeekEditions.status, ["published", "locked"]),
        input.excludeId ? ne(teamOfWeekEditions.id, input.excludeId) : sql`true`,
      ),
    )
    .orderBy(desc(teamOfWeekEditions.roundNumber), desc(teamOfWeekEditions.publishedAt));

  if (input.roundNumber != null) {
    return (
      rows.find((r) => r.roundNumber != null && r.roundNumber < input.roundNumber!) ?? null
    );
  }
  return rows.find((r) => r.roundKey !== input.roundKey) ?? null;
}

async function buildDroppedOut(
  editionId: string,
  previousEditionId: string | null,
  currentPlayerIds: Set<string>,
): Promise<Array<typeof teamOfWeekSelections.$inferInsert>> {
  if (!previousEditionId) return [];
  const db = getDb();
  const prev = await db
    .select()
    .from(teamOfWeekSelections)
    .where(
      and(
        eq(teamOfWeekSelections.editionId, previousEditionId),
        eq(teamOfWeekSelections.selectionType, "STARTING"),
      ),
    );

  const out: Array<typeof teamOfWeekSelections.$inferInsert> = [];
  let sort = 200;
  for (const row of prev) {
    if (!row.playerId || currentPlayerIds.has(row.playerId)) continue;
    const snap = (row.snapshot ?? {}) as Record<string, unknown>;
    out.push({
      editionId,
      playerId: row.playerId,
      teamId: row.teamId,
      fixtureId: null,
      selectionType: "DROPPED_OUT",
      positionCode: row.positionCode,
      shirtNumber: row.shirtNumber,
      matchRating: row.matchRating,
      selectionScore: row.selectionScore,
      confidencePct: row.confidencePct,
      rankAtPosition: null,
      shortReason: "Not selected this round",
      fullReason: `${String(snap.playerName ?? "Player")} featured in the previous Team of the Week but was not selected this round.`,
      isAutomated: true,
      isManualOverride: false,
      sortOrder: sort++,
      snapshot: {
        ...snap,
        previousShirt: row.shirtNumber,
        previousRating: row.matchRating,
      },
    });
  }
  return out;
}

export async function generateTeamOfWeek(input: {
  competitionId: string;
  seasonId: string;
  roundKey: string;
  createdBy?: string;
  forceProvisional?: boolean;
}): Promise<{ editionId: string; provisional: boolean; startingCount: number }> {
  const db = getDb();
  const roundFixtures = await loadRoundFixtures(input);
  if (!roundFixtures.length) {
    throw new Error("No fixtures found for this competition round");
  }

  const completed = roundFixtures.filter((f) => isFixtureRatingsPublished(f.status));
  const includeIds = completed.map((f) => f.id);
  const provisional =
    Boolean(input.forceProvisional) || completed.length < roundFixtures.length;

  if (!includeIds.length) {
    throw new Error("No completed fixtures with ratings in this round yet");
  }

  const candidates = await buildCandidates(includeIds);
  if (candidates.length < 8) {
    throw new Error(
      `Not enough rated players in this round (${candidates.length}). ` +
        `${includeIds.length} completed fixtures are linked, but squads/line-ups and match ratings are missing. ` +
        `Import Planet Rugby line-ups + stats for these matches (or pick a competition round that already has ratings, e.g. Nations Championship).`,
    );
  }

  const { starting, closeCalls, usedIds } = selectStartingXv(candidates);
  const bench = selectImpactBench(candidates, usedIds);
  const potw = selectPlayerOfWeek(starting);
  const summary = await buildRoundSummary(includeIds);
  const coachAward = await selectCoachOfWeek(includeIds);
  const refAward = await selectRefereeOfWeek(includeIds);
  const teamAward = topTeamFromStarting(starting);

  const sample = roundFixtures[0];
  const roundName =
    input.roundKey === "team-of-the-tournament"
      ? "Team of the Tournament"
      : formatRoundName(input.roundKey, sample?.round);
  const roundNumber =
    input.roundKey === "team-of-the-tournament" ? null : extractRoundNumber(sample?.round);
  const kicks = roundFixtures
    .map((f) => f.kickoffAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());

  const previous = await findPreviousPublishedEdition({
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    roundNumber,
    roundKey: input.roundKey,
  });

  const existing = await db
    .select({ id: teamOfWeekEditions.id, status: teamOfWeekEditions.status })
    .from(teamOfWeekEditions)
    .where(
      and(
        eq(teamOfWeekEditions.competitionId, input.competitionId),
        eq(teamOfWeekEditions.seasonId, input.seasonId),
        eq(teamOfWeekEditions.roundKey, input.roundKey),
      ),
    )
    .limit(1);

  if (existing[0]?.status === "locked" || existing[0]?.status === "published") {
    throw new Error("This round is published/locked. Unpublish before regenerating.");
  }

  let editionId = existing[0]?.id;
  if (editionId) {
    await db.delete(teamOfWeekSelections).where(eq(teamOfWeekSelections.editionId, editionId));
    await db.delete(teamOfWeekAwards).where(eq(teamOfWeekAwards.editionId, editionId));
    await db
      .delete(teamOfWeekEditionFixtures)
      .where(eq(teamOfWeekEditionFixtures.editionId, editionId));
    await db
      .update(teamOfWeekEditions)
      .set({
        roundName,
        roundNumber,
        roundStartDate: kicks[0] ?? null,
        roundEndDate: kicks[kicks.length - 1] ?? null,
        status: "generated",
        isProvisional: provisional,
        fixtureCount: roundFixtures.length,
        completedFixtureCount: completed.length,
        methodVersion: TOTW_METHOD_VERSION,
        previousEditionId: previous?.id ?? null,
        roundSummary: summary,
        generatedAt: new Date(),
        createdBy: input.createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(teamOfWeekEditions.id, editionId));
  } else {
    const inserted = await db
      .insert(teamOfWeekEditions)
      .values({
        competitionId: input.competitionId,
        seasonId: input.seasonId,
        roundKey: input.roundKey,
        roundNumber,
        roundName,
        roundStartDate: kicks[0] ?? null,
        roundEndDate: kicks[kicks.length - 1] ?? null,
        status: "generated",
        isProvisional: provisional,
        fixtureCount: roundFixtures.length,
        completedFixtureCount: completed.length,
        methodVersion: TOTW_METHOD_VERSION,
        previousEditionId: previous?.id ?? null,
        roundSummary: summary,
        generatedAt: new Date(),
        createdBy: input.createdBy ?? null,
      })
      .returning({ id: teamOfWeekEditions.id });
    editionId = inserted[0]!.id;
  }

  await db.insert(teamOfWeekEditionFixtures).values(
    roundFixtures.map((f) => ({
      editionId: editionId!,
      fixtureId: f.id,
      fixtureStatus: f.status,
      included: includeIds.includes(f.id),
    })),
  );

  const selectionRows = [
    ...starting.map((p, i) => pickToRow(editionId!, p, i + 1)),
    ...bench.map((p, i) => pickToRow(editionId!, p, 50 + i)),
    ...closeCalls.slice(0, 12).map((p, i) => pickToRow(editionId!, p, 100 + i)),
  ];

  const currentIds = new Set(starting.map((p) => p.candidate.playerId));
  const dropped = await buildDroppedOut(editionId!, previous?.id ?? null, currentIds);
  selectionRows.push(...dropped);

  // Snapshot approved Shirt Library kits (or safe fallback) — never draft kits.
  const { resolveTeamOfWeekShirt } = await import("./shirt-library-service");
  for (const row of selectionRows) {
    if (!row.teamId) continue;
    const resolved = await resolveTeamOfWeekShirt({
      teamId: row.teamId,
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      fixtureId: row.fixtureId,
      teamName: String((row.snapshot as { teamName?: string })?.teamName ?? ""),
    });
    row.shirtId = resolved.shirtId;
    row.shirtVersionId = resolved.versionId;
    row.kitType = resolved.kitType;
    row.shirtSelectionMethod = resolved.selectionMethod;
    row.snapshot = {
      ...(row.snapshot as Record<string, unknown>),
      shirtSvgConfig: resolved.svgConfig,
      shirtIsFallback: resolved.isFallback,
      shirtApprovalStatus: resolved.approvalStatus,
    };
  }

  if (selectionRows.length) {
    await db.insert(teamOfWeekSelections).values(selectionRows);
  }

  const awards: Array<typeof teamOfWeekAwards.$inferInsert> = [];
  if (potw) {
    awards.push({
      editionId: editionId!,
      awardType: "PLAYER_OF_WEEK",
      playerId: potw.candidate.playerId,
      teamId: potw.candidate.teamId,
      fixtureId: potw.candidate.fixtureId,
      rating: potw.candidate.matchRating,
      score: potw.selectionScore,
      shortReason: potw.shortReason,
      fullReason: potw.fullReason,
      snapshot: {
        playerName: potw.candidate.playerName,
        playerSlug: potw.candidate.playerSlug,
        imageUrl: potw.candidate.imageUrl,
        teamName: potw.candidate.teamName,
        teamImageUrl: potw.candidate.teamImageUrl,
        positionLabel: potw.slot.label,
        stats: potw.candidate.stats,
      },
    });
  }
  if (coachAward) {
    awards.push({
      editionId: editionId!,
      ...coachAward,
      playerId: null,
      refereeId: null,
    });
  }
  if (refAward) {
    awards.push({
      editionId: editionId!,
      ...refAward,
      playerId: null,
      coachId: null,
      teamId: null,
    });
  }
  if (teamAward) {
    awards.push({
      editionId: editionId!,
      ...teamAward,
      playerId: null,
      coachId: null,
      refereeId: null,
      fixtureId: null,
    });
  }
  if (awards.length) await db.insert(teamOfWeekAwards).values(awards);

  return {
    editionId: editionId!,
    provisional,
    startingCount: starting.length,
  };
}

export async function publishTeamOfWeekEdition(
  editionId: string,
  approvedBy?: string,
  options?: { allowProvisional?: boolean },
): Promise<{ publicPath: string | null; wasProvisional: boolean }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamOfWeekEditions)
    .where(eq(teamOfWeekEditions.id, editionId))
    .limit(1);
  if (!row) throw new Error("Edition not found");
  if (row.isProvisional && !options?.allowProvisional) {
    throw new Error(
      "This edition is provisional (round still incomplete). Confirm publish with allowProvisional to go live anyway.",
    );
  }

  const [[competition], [season]] = await Promise.all([
    db
      .select({ slug: competitions.slug })
      .from(competitions)
      .where(eq(competitions.id, row.competitionId))
      .limit(1),
    db
      .select({ year: competitionSeasons.year })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, row.seasonId))
      .limit(1),
  ]);

  await db
    .update(teamOfWeekEditions)
    .set({
      status: "published",
      publishedAt: new Date(),
      approvedAt: row.approvedAt ?? new Date(),
      approvedBy: approvedBy ?? row.approvedBy,
      lockedAt: new Date(),
      // Once published, treat as final for public archive even if generated early.
      isProvisional: false,
      updatedAt: new Date(),
    })
    .where(eq(teamOfWeekEditions.id, editionId));

  const year = season?.year ?? new Date().getFullYear();
  const publicPath =
    competition?.slug != null
      ? `/competitions/${competition.slug}/team-of-the-week/${year}/${row.roundKey}`
      : null;

  return { publicPath, wasProvisional: row.isProvisional };
}

export async function unpublishTeamOfWeekEdition(editionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(teamOfWeekEditions)
    .set({
      status: "under_review",
      publishedAt: null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(teamOfWeekEditions.id, editionId));
}

export async function getTeamOfWeekEditionBundle(editionId: string) {
  const db = getDb();
  const [edition] = await db
    .select()
    .from(teamOfWeekEditions)
    .where(eq(teamOfWeekEditions.id, editionId))
    .limit(1);
  if (!edition) return null;

  const [selections, awards, [competition], [season]] = await Promise.all([
    db
      .select()
      .from(teamOfWeekSelections)
      .where(eq(teamOfWeekSelections.editionId, editionId))
      .orderBy(asc(teamOfWeekSelections.sortOrder)),
    db.select().from(teamOfWeekAwards).where(eq(teamOfWeekAwards.editionId, editionId)),
    db
      .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
      .from(competitions)
      .where(eq(competitions.id, edition.competitionId))
      .limit(1),
    db
      .select({
        id: competitionSeasons.id,
        label: competitionSeasons.label,
        year: competitionSeasons.year,
        slug: competitionSeasons.slug,
      })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, edition.seasonId))
      .limit(1),
  ]);

  return { edition, selections, awards, competition: competition ?? null, season: season ?? null };
}

export async function listPublishedEditionsForCompetition(competitionId: string) {
  const db = getDb();
  return db
    .select({
      id: teamOfWeekEditions.id,
      seasonId: teamOfWeekEditions.seasonId,
      roundKey: teamOfWeekEditions.roundKey,
      roundName: teamOfWeekEditions.roundName,
      roundNumber: teamOfWeekEditions.roundNumber,
      status: teamOfWeekEditions.status,
      publishedAt: teamOfWeekEditions.publishedAt,
      roundStartDate: teamOfWeekEditions.roundStartDate,
      roundEndDate: teamOfWeekEditions.roundEndDate,
      seasonLabel: competitionSeasons.label,
      seasonYear: competitionSeasons.year,
    })
    .from(teamOfWeekEditions)
    .innerJoin(competitionSeasons, eq(teamOfWeekEditions.seasonId, competitionSeasons.id))
    .where(
      and(
        eq(teamOfWeekEditions.competitionId, competitionId),
        inArray(teamOfWeekEditions.status, ["published", "locked"]),
      ),
    )
    .orderBy(desc(competitionSeasons.year), desc(teamOfWeekEditions.roundNumber));
}

export async function findPublishedEditionByRound(input: {
  competitionId: string;
  year: number;
  roundKey: string;
}) {
  const db = getDb();
  const seasons = await db
    .select({ id: competitionSeasons.id })
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.competitionId, input.competitionId),
        eq(competitionSeasons.year, input.year),
      ),
    );
  if (!seasons.length) return null;
  const seasonIds = seasons.map((s) => s.id);
  const [row] = await db
    .select()
    .from(teamOfWeekEditions)
    .where(
      and(
        eq(teamOfWeekEditions.competitionId, input.competitionId),
        inArray(teamOfWeekEditions.seasonId, seasonIds),
        eq(teamOfWeekEditions.roundKey, input.roundKey),
        inArray(teamOfWeekEditions.status, ["published", "locked"]),
      ),
    )
    .limit(1);
  return row ?? null;
}
