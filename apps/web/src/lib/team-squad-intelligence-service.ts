/**
 * Squad value + strength aggregates for Compare Teams MVP.
 */
import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  competitionSeasons,
  fixturePlayers,
  fixtures,
  playerMarketValues,
  playerMatchRatings,
  playerRatings,
  players,
  teams,
  venues,
  worldRankingFeeds,
  worldRankingRows,
} from "@rugby365/db";
import { getDb } from "./db";
import { allRelatedTeamIds, resolveCanonicalTeam } from "./coach-team-aliases";
import { formatGbpCompact } from "./player-value-math";
import { compareByPlayingPosition } from "./player-radar-positions";
import { computeTeamRating, TEAM_RATING_MODEL } from "./team-rating-math";
import type {
  PlayerMatchRatingPoint,
  TeamCompareSidePacket,
  TeamFormSummary,
  TeamLastMatchLineupMeta,
  TeamSquadPlayerRow,
  TeamSquadRole,
  TeamSquadScope,
  TeamSquadValueSummary,
} from "./team-squad-intelligence-types";

export type {
  TeamCompareSidePacket,
  TeamFormSummary,
  TeamSquadPlayerRow,
  TeamSquadValueSummary,
} from "./team-squad-intelligence-types";

function ageFromBirthDate(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 80 ? age : null;
}

const RECENT_SQUAD_MONTHS = 18;
const MATCH_RATING_HISTORY_LIMIT = 12;

type RawSquadPlayer = {
  id: string;
  slug: string;
  name: string;
  positionName: string | null;
  birthDate: Date | null;
  rating: number | null;
  marketValueGbp: number | null;
  imageUrl: string | null;
};

type LastMatchAppearance = {
  playerId: string;
  jerseyNumber: number | null;
  squadRole: string | null;
  positionName: string | null;
};

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function lineupRole(squadRole: string | null | undefined, jersey: number | null): TeamSquadRole {
  const role = (squadRole || "").toLowerCase();
  if (role.includes("start") || (jersey != null && jersey >= 1 && jersey <= 15 && !role.includes("sub") && !role.includes("bench") && !role.includes("repl"))) {
    return "starting";
  }
  if (role.includes("sub") || role.includes("bench") || role.includes("repl") || (jersey != null && jersey >= 16)) {
    return "bench";
  }
  if (jersey != null && jersey >= 1 && jersey <= 15) return "starting";
  return "squad";
}

function betterLineupRow(a: LastMatchAppearance, b: LastMatchAppearance): LastMatchAppearance {
  const aPos = a.positionName?.trim() ? 1 : 0;
  const bPos = b.positionName?.trim() ? 1 : 0;
  if (aPos !== bPos) return aPos > bPos ? a : b;
  const aJersey = a.jerseyNumber != null ? 1 : 0;
  const bJersey = b.jerseyNumber != null ? 1 : 0;
  return aJersey >= bJersey ? a : b;
}

async function loadPlayersByIds(ids: string[]): Promise<RawSquadPlayer[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      positionName: players.positionName,
      birthDate: players.birthDate,
      rating: playerRatings.playerRating,
      marketValueGbp: playerMarketValues.marketValueGbp,
      imageUrl: sql<string | null>`nullif(trim(coalesce(${players.imageUrl}, ${players.badgeImageUrl})), '')`,
    })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .leftJoin(
      playerMarketValues,
      and(eq(playerMarketValues.playerId, players.id), eq(playerMarketValues.isCurrent, true)),
    )
    .where(
      and(
        inArray(players.id, ids),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
      ),
    )
    .orderBy(asc(players.name));
}

async function loadMatchRatingHistory(
  playerIds: string[],
): Promise<Map<string, PlayerMatchRatingPoint[]>> {
  const out = new Map<string, PlayerMatchRatingPoint[]>();
  if (playerIds.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({
      playerId: playerMatchRatings.playerId,
      fixtureId: playerMatchRatings.fixtureId,
      rating: playerMatchRatings.rating,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(fixtures.id, playerMatchRatings.fixtureId))
    .where(
      and(
        inArray(playerMatchRatings.playerId, playerIds),
        sql`${playerMatchRatings.rating} is not null`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  for (const row of rows) {
    const rating = row.rating != null && Number.isFinite(Number(row.rating)) ? Number(row.rating) : null;
    if (rating == null) continue;
    const list = out.get(row.playerId) ?? [];
    if (list.length >= MATCH_RATING_HISTORY_LIMIT) continue;
    list.push({
      fixtureId: row.fixtureId,
      kickoffAt: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
      rating,
    });
    out.set(row.playerId, list);
  }

  for (const [id, list] of out) {
    out.set(id, [...list].reverse());
  }
  return out;
}

async function loadLastMatchAppearances(
  teamIds: string[],
): Promise<{ meta: TeamLastMatchLineupMeta | null; appearances: LastMatchAppearance[] }> {
  const db = getDb();
  const now = new Date();
  const recentFixtures = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds)),
        lte(fixtures.kickoffAt, now),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(40);

  for (const fixture of recentFixtures) {
    const rows = await db
      .select({
        playerId: fixturePlayers.playerId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        positionName: fixturePlayers.positionName,
      })
      .from(fixturePlayers)
      .where(
        and(eq(fixturePlayers.fixtureId, fixture.id), inArray(fixturePlayers.teamId, teamIds)),
      );
    if (rows.length < 10) continue;

    const byJersey = new Map<string, LastMatchAppearance>();
    for (const row of rows) {
      const jersey = row.jerseyNumber;
      const role = lineupRole(row.squadRole, jersey);
      const key = jersey != null ? `j:${jersey}` : `p:${row.playerId}`;
      const next: LastMatchAppearance = {
        playerId: row.playerId,
        jerseyNumber: jersey,
        squadRole: role,
        positionName: row.positionName,
      };
      const prev = byJersey.get(key);
      byJersey.set(key, prev ? betterLineupRow(prev, next) : next);
    }
    const appearances = [...byJersey.values()];
    const starterCount = appearances.filter((r) => r.squadRole === "starting").length;
    if (starterCount < 8) continue;
    return {
      meta: {
        fixtureId: fixture.id,
        kickoffAt: fixture.kickoffAt ? new Date(fixture.kickoffAt).toISOString() : null,
        competitionName: fixture.competitionName ?? null,
        starterCount,
        substituteCount: appearances.filter((r) => r.squadRole === "bench").length,
      },
      appearances,
    };
  }

  return { meta: null, appearances: [] };
}

async function resolveRecentSquad(teamId: string): Promise<{
  scope: TeamSquadScope;
  lastMatchLineup: TeamLastMatchLineupMeta | null;
  players: TeamSquadPlayerRow[];
}> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const since = monthsAgo(RECENT_SQUAD_MONTHS);
  const until = daysFromNow(14);

  const [recentIds, lastMatch] = await Promise.all([
    db
      .selectDistinct({ playerId: fixturePlayers.playerId })
      .from(fixturePlayers)
      .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
      .where(
        and(
          inArray(fixturePlayers.teamId, teamIds),
          gte(fixtures.kickoffAt, since),
          lte(fixtures.kickoffAt, until),
        ),
      ),
    loadLastMatchAppearances(teamIds),
  ]);

  const idSet = new Set(recentIds.map((r) => r.playerId).filter(Boolean));
  for (const row of lastMatch.appearances) idSet.add(row.playerId);
  const ids = [...idSet];
  if (ids.length === 0) {
    return { scope: "unavailable", lastMatchLineup: lastMatch.meta, players: [] };
  }

  const [raw, history] = await Promise.all([loadPlayersByIds(ids), loadMatchRatingHistory(ids)]);
  const lastByPlayer = new Map(lastMatch.appearances.map((r) => [r.playerId, r]));

  const playersOut: TeamSquadPlayerRow[] = raw.map((p) => {
    const rating = p.rating != null && Number.isFinite(p.rating) ? p.rating : null;
    const stored =
      p.marketValueGbp != null && Number.isFinite(p.marketValueGbp) ? p.marketValueGbp : null;
    const last = lastByPlayer.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      positionName: last?.positionName || p.positionName,
      rating,
      marketValueGbp: stored,
      marketValueLabel: stored != null ? formatGbpCompact(stored) : null,
      marketValueIsStored: stored != null,
      age: ageFromBirthDate(p.birthDate),
      jerseyNumber: last?.jerseyNumber ?? null,
      squadRole: last ? lineupRole(last.squadRole, last.jerseyNumber) : "squad",
      imageUrl: p.imageUrl ?? null,
      matchRatingHistory: history.get(p.id) ?? [],
    };
  });

  return {
    scope: "recent_match_squads",
    lastMatchLineup: lastMatch.meta,
    players: playersOut.sort(compareByPlayingPosition),
  };
}

function valueSum(players: TeamSquadPlayerRow[]): number | null {
  const stored = players
    .map((p) => p.marketValueGbp)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (stored.length === 0) return null;
  return stored.reduce((s, v) => s + v, 0);
}

function summarizeSquad(squad: TeamSquadPlayerRow[]): TeamSquadValueSummary {
  const stored = squad.filter((p) => p.marketValueGbp != null);
  const total = valueSum(squad);
  const starting = squad.filter((p) => p.squadRole === "starting");
  const bench = squad.filter((p) => p.squadRole === "bench");
  const startingTotal = valueSum(starting);
  const benchTotal = valueSum(bench);
  const rated = squad.filter((p) => p.rating != null);
  const ages = squad.map((p) => p.age).filter((a): a is number => a != null);
  const avgRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length) * 10) / 10
      : null;
  const avgAge =
    ages.length > 0
      ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
      : null;
  const avgValue =
    stored.length > 0 && total != null ? Math.round(total / stored.length) : null;

  return {
    playerCount: squad.length,
    ratedPlayerCount: rated.length,
    storedValueCount: stored.length,
    totalSquadValueGbp: total,
    totalSquadValueLabel: total != null ? formatGbpCompact(total) : null,
    averagePlayerValueGbp: avgValue,
    averagePlayerValueLabel: avgValue != null ? formatGbpCompact(avgValue) : null,
    startingXvValueGbp: startingTotal,
    startingXvValueLabel: startingTotal != null ? formatGbpCompact(startingTotal) : null,
    benchValueGbp: benchTotal,
    benchValueLabel: benchTotal != null ? formatGbpCompact(benchTotal) : null,
    averageAge: avgAge,
    averageRating: avgRating,
  };
}

function isCompletedFixtureStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().replace(/[\s-]+/g, "_");
  return (
    s === "full_time" ||
    s === "finished" ||
    s === "completed" ||
    s === "complete" ||
    s === "result" ||
    s === "ft" ||
    s.includes("full_time") ||
    s.includes("complete") ||
    s.includes("finish")
  );
}

async function loadForm(teamId: string, limit = 10): Promise<TeamFormSummary> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const idSet = new Set(teamIds);
  const completedStatuses = ["full_time", "finished", "completed", "ft", "result"];
  const rows = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(
      and(
        or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds)),
        isNotNull(fixtures.homeScore),
        isNotNull(fixtures.awayScore),
        inArray(fixtures.status, completedStatuses),
        sql`${fixtures.kickoffAt} is not null`,
        sql`${fixtures.kickoffAt} < now()`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(Math.max(limit * 4, 40));

  const completed = rows
    .filter((row) => isCompletedFixtureStatus(row.status))
    // Prefer real results over 0–0 placeholder imports when we have enough depth.
    .filter((row, _, all) => {
      const isZeroDraw = (row.homeScore ?? 0) === 0 && (row.awayScore ?? 0) === 0;
      if (!isZeroDraw) return true;
      const nonZero = all.filter((r) => !((r.homeScore ?? 0) === 0 && (r.awayScore ?? 0) === 0));
      return nonZero.length < limit;
    })
    .slice(0, limit);

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const lastResults: Array<"W" | "D" | "L"> = [];

  for (const row of completed) {
    const isHome = row.homeTeamId != null && idSet.has(row.homeTeamId);
    const teamScore = isHome ? row.homeScore : row.awayScore;
    const oppScore = isHome ? row.awayScore : row.homeScore;
    pointsFor += teamScore ?? 0;
    pointsAgainst += oppScore ?? 0;
    if ((teamScore ?? 0) > (oppScore ?? 0)) {
      won += 1;
      lastResults.push("W");
    } else if ((teamScore ?? 0) < (oppScore ?? 0)) {
      lost += 1;
      lastResults.push("L");
    } else {
      drawn += 1;
      lastResults.push("D");
    }
  }

  const played = completed.length;
  return {
    played,
    won,
    drawn,
    lost,
    winPct: played > 0 ? Math.round(((won / played) * 1000) / 10) : null,
    pointsFor,
    pointsAgainst,
    lastResults,
  };
}

async function loadTrophyCount(teamId: string): Promise<number> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(competitionSeasons)
    .where(inArray(competitionSeasons.championTeamId, teamIds));
  return Number(row?.value ?? 0);
}

async function loadWorldRank(teamId: string): Promise<{
  position: number | null;
  points: number | null;
}> {
  const db = getDb();
  const [feed] = await db
    .select()
    .from(worldRankingFeeds)
    .where(eq(worldRankingFeeds.category, "mru"))
    .limit(1);
  if (!feed?.currentSnapshotId) return { position: null, points: null };
  const teamIds = await allRelatedTeamIds([teamId]);

  const [row] = await db
    .select({
      position: worldRankingRows.position,
      points: worldRankingRows.points,
    })
    .from(worldRankingRows)
    .where(
      and(
        eq(worldRankingRows.snapshotId, feed.currentSnapshotId),
        inArray(worldRankingRows.teamId, teamIds),
      ),
    )
    .limit(1);
  if (row) {
    return {
      position: row.position ?? null,
      points: row.points != null ? Number(row.points) : null,
    };
  }

  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const teamName = team?.name?.trim();
  if (!teamName) return { position: null, points: null };

  const [named] = await db
    .select({
      position: worldRankingRows.position,
      points: worldRankingRows.points,
    })
    .from(worldRankingRows)
    .where(
      and(
        eq(worldRankingRows.snapshotId, feed.currentSnapshotId),
        ilike(worldRankingRows.teamName, teamName),
      ),
    )
    .limit(1);

  return {
    position: named?.position ?? null,
    points: named?.points != null ? Number(named.points) : null,
  };
}

async function loadCoachName(teamId: string): Promise<string | null> {
  const { getTeamCoachingStaff } = await import("./coach-admin-service");
  const staff = await getTeamCoachingStaff(teamId);
  const head =
    staff.current.find((s) => /head|director/i.test(s.roleLabel ?? s.role ?? "")) ??
    staff.current[0];
  return head?.coachName ?? null;
}

async function loadHomeVenueName(teamId: string): Promise<string | null> {
  const db = getDb();
  const canonical = await resolveCanonicalTeam(teamId);
  const id = canonical?.id ?? teamId;
  const [team] = await db
    .select({ homeVenueId: teams.homeVenueId })
    .from(teams)
    .where(eq(teams.id, id))
    .limit(1);
  if (!team?.homeVenueId) return null;
  const [venue] = await db
    .select({ name: venues.name })
    .from(venues)
    .where(eq(venues.id, team.homeVenueId))
    .limit(1);
  return venue?.name ?? null;
}

async function loadLastCompletedCompetitionName(teamId: string): Promise<string | null> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const rows = await db
    .select({ competitionName: fixtures.competitionName, status: fixtures.status })
    .from(fixtures)
    .where(
      and(
        or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds)),
        sql`${fixtures.competitionName} is not null`,
        lte(fixtures.kickoffAt, new Date()),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(12);
  const completed = rows.find((r) => isCompletedFixtureStatus(r.status));
  return completed?.competitionName ?? rows[0]?.competitionName ?? null;
}

export async function getTeamCompareSidePacket(
  slug: string,
): Promise<TeamCompareSidePacket | null> {
  const db = getDb();
  const { normalizeSlug } = await import("./fixture-admin-service");
  const trimmed = slug.trim();
  const normalized = normalizeSlug(trimmed);
  let [team] = await db.select().from(teams).where(eq(teams.slug, trimmed)).limit(1);
  if (!team && normalized && normalized !== trimmed) {
    [team] = await db.select().from(teams).where(eq(teams.slug, normalized)).limit(1);
  }
  if (!team) return null;
  const canonical = await resolveCanonicalTeam(team.id);
  if (canonical && canonical.id !== team.id) {
    const [preferred] = await db.select().from(teams).where(eq(teams.id, canonical.id)).limit(1);
    if (preferred) team = preferred;
  }

  const [recentSquad, form, trophyCount, world, coachName, homeVenueName, competitionName] =
    await Promise.all([
      resolveRecentSquad(team.id),
      loadForm(team.id, 10),
      loadTrophyCount(team.id),
      loadWorldRank(team.id),
      loadCoachName(team.id),
      loadHomeVenueName(team.id),
      loadLastCompletedCompetitionName(team.id),
    ]);

  let foundedYear = team.foundedYear;
  if (foundedYear == null) {
    const siblingIds = await allRelatedTeamIds([team.id]);
    const siblingYears = await db
      .select({ foundedYear: teams.foundedYear })
      .from(teams)
      .where(inArray(teams.id, siblingIds));
    foundedYear = siblingYears.find((row) => row.foundedYear != null)?.foundedYear ?? null;
  }

  const squad = recentSquad.players;
  const squadValue = summarizeSquad(squad);
  const top23 = [...squad]
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 23);
  const avgTop23 =
    top23.length > 0
      ? top23.reduce((s, p) => s + (p.rating ?? 0), 0) / top23.length
      : squadValue.averageRating;

  const rating = computeTeamRating({
    avgTop23Rating: avgTop23,
    formWinPct: form.winPct,
    squadValueGbp: squadValue.totalSquadValueGbp,
    ratedPlayerCount: squadValue.ratedPlayerCount,
    trophyCount,
  });

  return {
    id: team.id,
    slug: team.slug,
    name: team.name,
    shortName: team.shortName,
    imageUrl: team.imageUrl,
    countryName: team.countryName,
    teamType: team.teamType,
    foundedYear,
    competitionName,
    coachName,
    homeVenueName,
    worldRank: world.position,
    worldRankPoints: world.points,
    trophyCount,
    form,
    squadValue,
    rating: {
      modelVersion: rating.modelVersion || TEAM_RATING_MODEL,
      overall: rating.overall,
      components: rating.components,
    },
    squadScope: recentSquad.scope,
    lastMatchLineup: recentSquad.lastMatchLineup,
    squad,
  };
}
