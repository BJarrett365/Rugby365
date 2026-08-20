/**
 * Recent Matches for Player Profile V2 Overview.
 *
 * Same spine as Recent Form (fixture_players → completed fixtures → match ratings /
 * minutes), filtered to real appearances: starters, or bench players who entered.
 * Unused replacements are excluded. Never invents rows or ratings.
 */
import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerMatchPerformanceStats,
  playerMatchRatings,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { buildMatchDetailPath } from "./match-schedule-utils";
import {
  buildRecentMatchLabel,
  isEligibleRecentAppearance,
} from "./player-recent-matches-utils";

export type PlayerRecentMatchRow = {
  id: string;
  href: string | null;
  kickoffAt: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Official score line for MATCH column, e.g. "Leinster 28 - 17 Toulouse". */
  matchLabel: string;
  competitionName: string | null;
  /** 0–10 match rating; null when missing (row still shown). */
  rating: number | null;
  yellowCards: number;
  redCards: number;
  /** Optional W/D/L from the player's team perspective. */
  result: "W" | "D" | "L" | null;
  squadRole: string | null;
  minutesPlayed: number | null;
};

export { isEligibleRecentAppearance, buildRecentMatchLabel } from "./player-recent-matches-utils";

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

function normalizeRating(r: number | null | undefined): number | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (r > 10) return Math.round((r / 10) * 10) / 10;
  return Math.round(r * 10) / 10;
}

function resultFromScores(
  teamId: string | null,
  homeTeamId: string | null,
  awayTeamId: string | null,
  homeScore: number | null,
  awayScore: number | null,
): "W" | "D" | "L" | null {
  if (!teamId || homeScore == null || awayScore == null) return null;
  const isHome = teamId === homeTeamId;
  const isAway = teamId === awayTeamId;
  if (!isHome && !isAway) return null;
  const forPts = isHome ? homeScore : awayScore;
  const against = isHome ? awayScore : homeScore;
  if (forPts > against) return "W";
  if (forPts < against) return "L";
  return "D";
}

function buildMatchHref(input: {
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  competitionName: string | null;
  competitionCode: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  kickoffAt: Date | null;
}): string | null {
  if (input.planetRugbyUrl) {
    try {
      const path = new URL(input.planetRugbyUrl).pathname;
      const parts = path.split("/").filter(Boolean);
      const matchesIdx = parts.indexOf("matches");
      if (matchesIdx >= 0 && parts.length >= matchesIdx + 6) {
        return `/${parts.slice(matchesIdx).join("/")}`;
      }
    } catch {
      /* ignore */
    }
  }

  const matchId = input.externalMatchId?.trim() || null;
  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const homeSlug = input.homeTeamSlug?.trim() || (input.homeTeamName ? slugify(input.homeTeamName) : "");
  const awaySlug = input.awayTeamSlug?.trim() || (input.awayTeamName ? slugify(input.awayTeamName) : "");
  const matchDate = input.kickoffAt ? input.kickoffAt.toISOString().slice(0, 10) : null;
  const competitionCode = input.competitionCode?.trim() || null;
  const competitionName = input.competitionName?.trim() || null;
  if (!matchId || !homeSlug || !awaySlug || !matchDate || !competitionCode || !competitionName) {
    return null;
  }
  return buildMatchDetailPath({
    matchId,
    competitionName,
    competitionId: competitionCode,
    homeTeamSlug: homeSlug,
    awayTeamSlug: awaySlug,
    matchDate,
  });
}

function cardCountsFromEvents(
  events: Array<{ eventType: string }>,
): { yellow: number; red: number } {
  let yellow = 0;
  let red = 0;
  for (const e of events) {
    const t = (e.eventType || "").toLowerCase();
    if (t.includes("red")) red += 1;
    else if (t.includes("yellow") || t.includes("sin_bin") || t.includes("sinbin")) yellow += 1;
  }
  return { yellow, red };
}

/**
 * Latest completed eligible appearances for the overview Recent Matches card.
 * Newest first. Does not invent ratings or card counts.
 */
export async function getPlayerRecentMatches(
  playerId: string,
  options: { limit?: number } = {},
): Promise<PlayerRecentMatchRow[]> {
  const limit = options.limit ?? 5;
  const db = getDb();
  const homeTeams = alias(teams, "prm_home");
  const awayTeams = alias(teams, "prm_away");

  // Over-fetch so unused bench rows can be filtered without undershooting limit.
  const fetchLimit = Math.max(limit * 4, 24);

  const fpRows = await db
    .select({
      fixtureId: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      competitionCode: competitions.sdmsCompCode,
      competitionNameJoined: competitions.name,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
      teamId: fixturePlayers.teamId,
      squadRole: fixturePlayers.squadRole,
      jerseyNumber: fixturePlayers.jerseyNumber,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(fetchLimit);

  const completed = fpRows.filter((r) => isCompletedFixtureStatus(r.status));
  if (!completed.length) return [];

  const fixtureIds = completed.map((r) => r.fixtureId);

  const [perfRows, ratingRows, cardRows] = await Promise.all([
    db
      .select({
        fixtureId: playerMatchPerformanceStats.fixtureId,
        minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
      })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.playerId, playerId),
          inArray(playerMatchPerformanceStats.fixtureId, fixtureIds),
        ),
      ),
    db
      .select({
        fixtureId: playerMatchRatings.fixtureId,
        rating: playerMatchRatings.rating,
        minutesPlayed: playerMatchRatings.minutesPlayed,
      })
      .from(playerMatchRatings)
      .where(
        and(
          eq(playerMatchRatings.playerId, playerId),
          inArray(playerMatchRatings.fixtureId, fixtureIds),
        ),
      ),
    db
      .select({
        fixtureId: matchEvents.fixtureId,
        eventType: matchEvents.eventType,
      })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.playerId, playerId),
          inArray(matchEvents.fixtureId, fixtureIds),
          or(
            sql`lower(${matchEvents.eventType}) like '%yellow%'`,
            sql`lower(${matchEvents.eventType}) like '%red%'`,
            sql`lower(${matchEvents.eventType}) like '%sin%bin%'`,
            sql`lower(${matchEvents.eventType}) like '%sin_bin%'`,
          ),
        ),
      ),
  ]);

  const minutesByFixture = new Map<string, number>();
  for (const r of perfRows) {
    if (r.minutesPlayed > 0) minutesByFixture.set(r.fixtureId, r.minutesPlayed);
  }
  for (const r of ratingRows) {
    if (!minutesByFixture.has(r.fixtureId) && r.minutesPlayed > 0) {
      minutesByFixture.set(r.fixtureId, r.minutesPlayed);
    }
  }
  // Explicit zero from perf wins over missing (unused bench evidence).
  for (const r of perfRows) {
    if (r.minutesPlayed === 0 && !minutesByFixture.has(r.fixtureId)) {
      minutesByFixture.set(r.fixtureId, 0);
    }
  }

  const ratingByFixture = new Map(
    ratingRows.map((r) => [r.fixtureId, normalizeRating(r.rating)]),
  );

  const cardsByFixture = new Map<string, Array<{ eventType: string }>>();
  for (const e of cardRows) {
    const list = cardsByFixture.get(e.fixtureId) ?? [];
    list.push(e);
    cardsByFixture.set(e.fixtureId, list);
  }

  const out: PlayerRecentMatchRow[] = [];
  for (const row of completed) {
    const minutes = minutesByFixture.has(row.fixtureId)
      ? (minutesByFixture.get(row.fixtureId) as number)
      : null;
    const rating = ratingByFixture.get(row.fixtureId) ?? null;
    if (
      !isEligibleRecentAppearance({
        squadRole: row.squadRole,
        jerseyNumber: row.jerseyNumber,
        minutesPlayed: minutes,
        rating,
      })
    ) {
      continue;
    }

    const competitionName = row.competitionNameJoined ?? row.competitionName ?? null;
    const homeScore =
      row.homeScore != null && Number.isFinite(row.homeScore) ? row.homeScore : null;
    const awayScore =
      row.awayScore != null && Number.isFinite(row.awayScore) ? row.awayScore : null;
    const cards = cardCountsFromEvents(cardsByFixture.get(row.fixtureId) ?? []);

    out.push({
      id: row.fixtureId,
      href: buildMatchHref({
        planetRugbyUrl: row.planetRugbyUrl,
        externalMatchId: row.externalMatchId,
        competitionName,
        competitionCode: row.competitionCode,
        homeTeamSlug: row.homeTeamSlug,
        awayTeamSlug: row.awayTeamSlug,
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        kickoffAt: row.kickoffAt,
      }),
      kickoffAt: row.kickoffAt?.toISOString() ?? null,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore,
      awayScore,
      matchLabel: buildRecentMatchLabel({
        homeTeamName: row.homeTeamName,
        awayTeamName: row.awayTeamName,
        homeScore,
        awayScore,
      }),
      competitionName,
      rating,
      yellowCards: cards.yellow,
      redCards: cards.red,
      result: resultFromScores(
        row.teamId,
        row.homeTeamId,
        row.awayTeamId,
        homeScore,
        awayScore,
      ),
      squadRole: row.squadRole,
      minutesPlayed: minutes,
    });

    if (out.length >= limit) break;
  }

  return out;
}
