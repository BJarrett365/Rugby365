/**
 * Squad value + strength aggregates for Compare Teams MVP.
 */
import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import {
  competitionSeasons,
  fixturePlayers,
  fixtures,
  playerMarketValues,
  playerRatings,
  players,
  teams,
  venues,
  worldRankingFeeds,
  worldRankingRows,
} from "@rugby365/db";
import { getDb } from "./db";
import { allRelatedTeamIds, resolveCanonicalTeam } from "./coach-team-aliases";
import { baseMarketValueFromRating, formatGbpCompact } from "./player-value-math";
import { compareByPlayingPosition } from "./player-radar-positions";
import { computeTeamRating, TEAM_RATING_MODEL } from "./team-rating-math";
import type {
  TeamCompareSidePacket,
  TeamFormSummary,
  TeamSquadPlayerRow,
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

async function resolveSquadPlayers(teamId: string): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    positionName: string | null;
    birthDate: Date | null;
    rating: number | null;
    marketValueGbp: number | null;
  }>
> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);

  const clubOrIntl = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      positionName: players.positionName,
      birthDate: players.birthDate,
      rating: playerRatings.playerRating,
      marketValueGbp: playerMarketValues.marketValueGbp,
    })
    .from(players)
    .leftJoin(playerRatings, eq(playerRatings.playerId, players.id))
    .leftJoin(
      playerMarketValues,
      and(eq(playerMarketValues.playerId, players.id), eq(playerMarketValues.isCurrent, true)),
    )
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        or(inArray(players.clubTeamId, teamIds), inArray(players.internationalTeamId, teamIds)),
      ),
    )
    .orderBy(asc(players.name));

  if (clubOrIntl.length >= 8) return clubOrIntl;

  // Fallback: recent appearance squad for this team.
  const appearanceIds = await db
    .selectDistinct({ playerId: fixturePlayers.playerId })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .where(inArray(fixturePlayers.teamId, teamIds))
    .limit(80);

  const ids = appearanceIds.map((r) => r.playerId).filter(Boolean);
  if (ids.length === 0) return clubOrIntl;

  const appearancePlayers = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      positionName: players.positionName,
      birthDate: players.birthDate,
      rating: playerRatings.playerRating,
      marketValueGbp: playerMarketValues.marketValueGbp,
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

  const byId = new Map(clubOrIntl.map((p) => [p.id, p]));
  for (const p of appearancePlayers) byId.set(p.id, p);
  return [...byId.values()];
}

function buildSquadRows(
  raw: Awaited<ReturnType<typeof resolveSquadPlayers>>,
): TeamSquadPlayerRow[] {
  const withValues = raw.map((p) => {
    const rating = p.rating != null && Number.isFinite(p.rating) ? p.rating : null;
    const marketValueGbp =
      p.marketValueGbp != null && Number.isFinite(p.marketValueGbp)
        ? p.marketValueGbp
        : baseMarketValueFromRating(rating).midGbp;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      positionName: p.positionName,
      rating,
      marketValueGbp,
      marketValueLabel: formatGbpCompact(marketValueGbp),
      age: ageFromBirthDate(p.birthDate),
      squadRole: "squad" as const,
    };
  });

  // Prefer higher rating for XV/bench assignment, then position order for display.
  const byStrength = [...withValues].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const startingIds = new Set(byStrength.slice(0, 15).map((p) => p.id));
  const benchIds = new Set(byStrength.slice(15, 23).map((p) => p.id));

  return withValues
    .map((p) => ({
      ...p,
      squadRole: startingIds.has(p.id)
        ? ("starting" as const)
        : benchIds.has(p.id)
          ? ("bench" as const)
          : ("squad" as const),
    }))
    .sort(compareByPlayingPosition);
}

function summarizeSquad(squad: TeamSquadPlayerRow[]): TeamSquadValueSummary {
  const total = squad.reduce((s, p) => s + p.marketValueGbp, 0);
  const starting = squad.filter((p) => p.squadRole === "starting");
  const bench = squad.filter((p) => p.squadRole === "bench");
  const startingTotal = starting.reduce((s, p) => s + p.marketValueGbp, 0);
  const benchTotal = bench.reduce((s, p) => s + p.marketValueGbp, 0);
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
    squad.length > 0 ? Math.round(total / squad.length) : null;

  return {
    playerCount: squad.length,
    ratedPlayerCount: rated.length,
    totalSquadValueGbp: total,
    totalSquadValueLabel: formatGbpCompact(total),
    averagePlayerValueGbp: avgValue,
    averagePlayerValueLabel: avgValue != null ? formatGbpCompact(avgValue) : null,
    startingXvValueGbp: starting.length > 0 ? startingTotal : null,
    startingXvValueLabel: starting.length > 0 ? formatGbpCompact(startingTotal) : null,
    benchValueGbp: bench.length > 0 ? benchTotal : null,
    benchValueLabel: bench.length > 0 ? formatGbpCompact(benchTotal) : null,
    averageAge: avgAge,
    averageRating: avgRating,
  };
}

function isCompletedFixtureStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  return (
    s.includes("complete") ||
    s.includes("finish") ||
    s === "result" ||
    s === "ft" ||
    s === "full_time" ||
    s.includes("full_time")
  );
}

async function loadForm(teamId: string, limit = 10): Promise<TeamFormSummary> {
  const db = getDb();
  const teamIds = await allRelatedTeamIds([teamId]);
  const idSet = new Set(teamIds);
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
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(limit * 3);

  const completed = rows.filter((row) => isCompletedFixtureStatus(row.status)).slice(0, limit);

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

async function loadPrimaryCompetitionName(teamId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ competitionName: fixtures.competitionName })
    .from(fixtures)
    .where(
      and(
        or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
        sql`${fixtures.competitionName} is not null`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  return row?.competitionName ?? null;
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

  const [rawSquad, form, trophyCount, world, coachName, homeVenueName, competitionName] =
    await Promise.all([
      resolveSquadPlayers(team.id),
      loadForm(team.id, 10),
      loadTrophyCount(team.id),
      loadWorldRank(team.id),
      loadCoachName(team.id),
      loadHomeVenueName(team.id),
      loadPrimaryCompetitionName(team.id),
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

  const squad = buildSquadRows(rawSquad);
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
    squad,
  };
}
