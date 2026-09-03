/**
 * Rugby365 Man of the Match from recorded match stats.
 * Weights: Attack 25, Defence 25, Work Rate 15, Breakdown 10,
 * Set Piece 10, Discipline 5, Impact/Clutch 10.
 *
 * Duplicate CMS fixtures often split attendance onto one copy and POTM onto
 * another. Public coach pages resolve extras across the same-day cluster.
 */
import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import {
  fixtures,
  playerMatchPerformanceStats,
  playerMatchRatings,
  players,
  teams,
} from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";

export type MotmPick = {
  fixtureId: string;
  playerId: string;
  playerName: string;
  score: number;
};

export type CoachMatchExtraInput = {
  id: string;
  kickoffAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  attendance: number | null;
  officialPotmName: string | null;
  officialPotmPlayerName: string | null;
  rugby365PotmName: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
};

export type CoachMatchExtras = {
  attendance: number | null;
  manOfTheMatch: string | null;
  rugby365PotmPlayerId: string | null;
};

type StatRow = {
  fixtureId: string;
  playerId: string;
  tries: number;
  tryAssists: number;
  metresCarried: number;
  carries: number;
  defendersBeaten: number;
  lineBreaks: number;
  tacklesMade: number;
  tacklesCompleted: number;
  dominantTackles: number;
  turnoversWon: number;
  ruckArrivalEffectiveness: number;
  points: number;
};

function n(v: number | null | undefined): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function scoreRow(row: StatRow, max: Record<string, number>): number {
  const attack = pct(
    n(row.tries) * 12 +
      n(row.tryAssists) * 8 +
      n(row.metresCarried) * 0.12 +
      n(row.carries) * 0.8 +
      n(row.defendersBeaten) * 2.5 +
      n(row.lineBreaks) * 4,
    max.attack || 1,
  );
  const defence = pct(
    n(row.tacklesMade) * 2 + n(row.tacklesCompleted) * 1.2 + n(row.dominantTackles) * 3,
    max.defence || 1,
  );
  const workRate = pct(n(row.carries) + n(row.tacklesMade) + n(row.tacklesCompleted), max.work || 1);
  const breakdown = pct(n(row.turnoversWon) * 8 + n(row.ruckArrivalEffectiveness), max.breakdown || 1);
  const setPiece = pct(n(row.ruckArrivalEffectiveness), max.setPiece || 1);
  const impact = pct(n(row.tries) * 15 + n(row.tryAssists) * 10 + n(row.turnoversWon) * 8 + n(row.points), max.impact || 1);
  return (
    attack * 0.25 +
    defence * 0.25 +
    workRate * 0.15 +
    breakdown * 0.1 +
    setPiece * 0.1 +
    70 * 0.05 +
    impact * 0.1
  );
}

export function utcDayKey(kickoff: Date | string | null | undefined): string | null {
  if (!kickoff) return null;
  const d = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normalizeMatchTeamName(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/__legacy__.*$/, "")
    .replace(/unknown team.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchClusterKey(input: {
  kickoffAt?: Date | string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}): string | null {
  const day = utcDayKey(input.kickoffAt ?? null);
  if (!day) return null;
  const names = [normalizeMatchTeamName(input.homeTeamName), normalizeMatchTeamName(input.awayTeamName)]
    .filter((n) => n.length >= 3)
    .sort();
  if (names.length === 2) return `${day}|n|${names.join("|")}`;
  if (input.homeScore == null || input.awayScore == null) return `${day}|id`;
  return `${day}|s|${input.homeScore}-${input.awayScore}`;
}

export async function pickMotmFromMatchStats(fixtureIds: string[]): Promise<Map<string, MotmPick>> {
  const out = new Map<string, MotmPick>();
  const ids = [...new Set(fixtureIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: playerMatchPerformanceStats.fixtureId,
      playerId: playerMatchPerformanceStats.playerId,
      tries: playerMatchPerformanceStats.tries,
      tryAssists: playerMatchPerformanceStats.tryAssists,
      metresCarried: playerMatchPerformanceStats.metresCarried,
      carries: playerMatchPerformanceStats.carries,
      defendersBeaten: playerMatchPerformanceStats.defendersBeaten,
      lineBreaks: playerMatchPerformanceStats.lineBreaks,
      tacklesMade: playerMatchPerformanceStats.tacklesMade,
      tacklesCompleted: playerMatchPerformanceStats.tacklesCompleted,
      dominantTackles: playerMatchPerformanceStats.dominantTackles,
      turnoversWon: playerMatchPerformanceStats.turnoversWon,
      ruckArrivalEffectiveness: playerMatchPerformanceStats.ruckArrivalEffectiveness,
      points: playerMatchPerformanceStats.points,
      name: players.name,
    })
    .from(playerMatchPerformanceStats)
    .innerJoin(players, eq(playerMatchPerformanceStats.playerId, players.id))
    .where(inArray(playerMatchPerformanceStats.fixtureId, ids));

  const byFx = new Map<string, Array<StatRow & { name: string }>>();
  for (const row of rows) {
    const list = byFx.get(row.fixtureId) ?? [];
    list.push(row);
    byFx.set(row.fixtureId, list);
  }

  for (const [fixtureId, list] of byFx) {
    if (list.length < 3) continue;
    const raw = list.map((row) => ({
      attack:
        n(row.tries) * 12 +
        n(row.tryAssists) * 8 +
        n(row.metresCarried) * 0.12 +
        n(row.carries) * 0.8 +
        n(row.defendersBeaten) * 2.5 +
        n(row.lineBreaks) * 4,
      defence: n(row.tacklesMade) * 2 + n(row.tacklesCompleted) * 1.2 + n(row.dominantTackles) * 3,
      work: n(row.carries) + n(row.tacklesMade) + n(row.tacklesCompleted),
      breakdown: n(row.turnoversWon) * 8 + n(row.ruckArrivalEffectiveness),
      setPiece: n(row.ruckArrivalEffectiveness),
      impact: n(row.tries) * 15 + n(row.tryAssists) * 10 + n(row.turnoversWon) * 8 + n(row.points),
    }));
    const max = {
      attack: Math.max(...raw.map((r) => r.attack), 1),
      defence: Math.max(...raw.map((r) => r.defence), 1),
      work: Math.max(...raw.map((r) => r.work), 1),
      breakdown: Math.max(...raw.map((r) => r.breakdown), 1),
      setPiece: Math.max(...raw.map((r) => r.setPiece), 1),
      impact: Math.max(...raw.map((r) => r.impact), 1),
    };
    let best: MotmPick | null = null;
    for (const row of list) {
      const score = scoreRow(row, max);
      if (!best || score > best.score) {
        best = { fixtureId, playerId: row.playerId, playerName: row.name, score };
      }
    }
    if (best) out.set(fixtureId, best);
  }
  return out;
}

function dayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function resolveCoachMatchExtras(
  rows: CoachMatchExtraInput[],
): Promise<Map<string, CoachMatchExtras>> {
  const out = new Map<string, CoachMatchExtras>();
  if (rows.length === 0) return out;

  for (const row of rows) {
    out.set(row.id, {
      attendance: row.attendance && row.attendance > 0 ? row.attendance : null,
      manOfTheMatch:
        row.officialPotmName?.trim() ||
        row.officialPotmPlayerName?.trim() ||
        row.rugby365PotmName?.trim() ||
        null,
      rugby365PotmPlayerId: null,
    });
  }

  const days = [...new Set(rows.map((r) => utcDayKey(r.kickoffAt)).filter((d): d is string => Boolean(d)))];
  if (days.length === 0) return out;

  const db = getDb();
  const homeTeams = alias(teams, "extra_home");
  const awayTeams = alias(teams, "extra_away");
  const r365Players = alias(players, "extra_r365");
  const officialPlayers = alias(players, "extra_official");
  const dayClauses = days.map((day) => {
    const { start, end } = dayBounds(day);
    return and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end));
  });

  const siblings = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      attendance: fixtures.attendance,
      officialPotmName: fixtures.officialPotmName,
      rugby365PotmPlayerId: fixtures.rugby365PotmPlayerId,
      officialPotmPlayerId: fixtures.officialPotmPlayerId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      rugby365Name: r365Players.name,
      officialPlayerName: officialPlayers.name,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(r365Players, eq(fixtures.rugby365PotmPlayerId, r365Players.id))
    .leftJoin(officialPlayers, eq(fixtures.officialPotmPlayerId, officialPlayers.id))
    .where(or(...dayClauses));

  const clusters = new Map<string, typeof siblings>();
  const pushCluster = (key: string | null, sib: (typeof siblings)[number]) => {
    if (!key || key.endsWith("|id")) return;
    const list = clusters.get(key) ?? [];
    list.push(sib);
    clusters.set(key, list);
  };
  for (const sib of siblings) {
    pushCluster(
      matchClusterKey({
        kickoffAt: sib.kickoffAt,
        homeTeamName: sib.homeTeamName,
        awayTeamName: sib.awayTeamName,
        homeScore: sib.homeScore,
        awayScore: sib.awayScore,
      }),
      sib,
    );
    pushCluster(
      matchClusterKey({
        kickoffAt: sib.kickoffAt,
        homeScore: sib.homeScore,
        awayScore: sib.awayScore,
      }),
      sib,
    );
  }

  const clusterIds = new Set<string>();
  const rowClusters = new Map<string, typeof siblings>();
  for (const row of rows) {
    const nameKey = matchClusterKey({
      kickoffAt: row.kickoffAt,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    });
    const scoreKey = matchClusterKey({
      kickoffAt: row.kickoffAt,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    });
    const merged = new Map<string, (typeof siblings)[number]>();
    for (const item of [
      ...(nameKey ? (clusters.get(nameKey) ?? []) : []),
      ...(scoreKey ? (clusters.get(scoreKey) ?? []) : []),
      ...siblings.filter((s) => s.id === row.id),
    ]) {
      merged.set(item.id, item);
    }
    const cluster = [...merged.values()];
    rowClusters.set(row.id, cluster);
    for (const item of cluster) clusterIds.add(item.id);
  }

  const ids = [...clusterIds];
  const motmFromStats = ids.length > 0 ? await pickMotmFromMatchStats(ids) : new Map<string, MotmPick>();
  const flagged = new Map<string, { name: string; playerId: string; official: boolean }>();
  const bestRated = new Map<string, { name: string; playerId: string; rating: number }>();
  if (ids.length > 0) {
    try {
      const rated = await db
        .select({
          fixtureId: playerMatchRatings.fixtureId,
          playerId: playerMatchRatings.playerId,
          name: players.name,
          rating: playerMatchRatings.rating,
          official: playerMatchRatings.isOfficialPotm,
          rugby365: playerMatchRatings.isRugby365Potm,
        })
        .from(playerMatchRatings)
        .innerJoin(players, eq(playerMatchRatings.playerId, players.id))
        .where(inArray(playerMatchRatings.fixtureId, ids));
      for (const row of rated) {
        if (row.official || row.rugby365) {
          const prev = flagged.get(row.fixtureId);
          if (!prev || (row.official && !prev.official)) {
            flagged.set(row.fixtureId, {
              name: row.name,
              playerId: row.playerId,
              official: Boolean(row.official),
            });
          }
        }
        const value = Number(row.rating);
        if (!Number.isFinite(value) || value <= 0) continue;
        const prev = bestRated.get(row.fixtureId);
        if (!prev || value > prev.rating) {
          bestRated.set(row.fixtureId, { name: row.name, playerId: row.playerId, rating: value });
        }
      }
    } catch {
      // Ratings columns may be missing on older databases.
    }
  }

  for (const row of rows) {
    const cluster = rowClusters.get(row.id) ?? [];
    let attendance = out.get(row.id)?.attendance ?? null;
    let manOfTheMatch = out.get(row.id)?.manOfTheMatch ?? null;
    let rugby365PotmPlayerId: string | null = null;
    let statsPick: MotmPick | null = null;
    let flagPick: { name: string; playerId: string; official: boolean } | null = null;
    let ratedPick: { name: string; playerId: string; rating: number } | null = null;

    for (const item of cluster) {
      if (item.attendance != null && item.attendance > (attendance ?? 0)) attendance = item.attendance;
      manOfTheMatch =
        manOfTheMatch ||
        item.officialPotmName?.trim() ||
        item.officialPlayerName?.trim() ||
        item.rugby365Name?.trim() ||
        null;
      rugby365PotmPlayerId = rugby365PotmPlayerId || item.rugby365PotmPlayerId || item.officialPotmPlayerId || null;
      const stats = motmFromStats.get(item.id);
      if (stats && (!statsPick || stats.score > statsPick.score)) statsPick = stats;
      const flag = flagged.get(item.id);
      if (flag && (!flagPick || (flag.official && !flagPick.official))) flagPick = flag;
      const rated = bestRated.get(item.id);
      if (rated && (!ratedPick || rated.rating > ratedPick.rating)) ratedPick = rated;
    }

    if (!manOfTheMatch && flagPick) {
      manOfTheMatch = flagPick.name;
      rugby365PotmPlayerId = rugby365PotmPlayerId || flagPick.playerId;
    }
    if (!manOfTheMatch && statsPick) {
      manOfTheMatch = statsPick.playerName;
      rugby365PotmPlayerId = rugby365PotmPlayerId || statsPick.playerId;
    }
    if (!manOfTheMatch && ratedPick) {
      manOfTheMatch = ratedPick.name;
      rugby365PotmPlayerId = rugby365PotmPlayerId || ratedPick.playerId;
    }

    out.set(row.id, { attendance, manOfTheMatch, rugby365PotmPlayerId });
  }

  return out;
}

export async function attendanceFromSiblingFixtures(
  rows: Array<{
    id: string;
    kickoffAt: Date | null;
    homeScore: number | null;
    awayScore: number | null;
    attendance: number | null;
  }>,
): Promise<Map<string, number>> {
  const extras = await resolveCoachMatchExtras(
    rows.map((row) => ({
      ...row,
      officialPotmName: null,
      officialPotmPlayerName: null,
      rugby365PotmName: null,
    })),
  );
  const out = new Map<string, number>();
  for (const [id, extra] of extras) {
    if (extra.attendance != null && extra.attendance > 0) out.set(id, extra.attendance);
  }
  return out;
}
