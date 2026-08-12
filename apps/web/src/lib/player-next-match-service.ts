/**
 * Player Next Match — load candidates and resolve via PlayerNextMatchEngine.
 * Invalidation: re-query on page load (fixture status / membership / squad / transfer).
 */
import "server-only";

import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerTeamMemberships,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { buildMatchDetailPath } from "./match-schedule-utils";
import { resolveTeamCrestImageUrl } from "./crest-library-service";
import {
  isInternationalWindowActive,
  resolvePlayerNextMatch,
  type NextMatchCandidate,
  type NextMatchResolution,
  type NextMatchResolutionSource,
} from "./player-next-match-engine";

export type PlayerNextMatchCard = {
  id: string;
  slug: string;
  href: string | null;
  kickoffAt: string | null;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamCrestUrl: string | null;
  awayTeamCrestUrl: string | null;
  venueName: string | null;
  status: string | null;
  isLive: boolean;
  source: NextMatchResolutionSource;
  reason: string;
};

function buildHref(input: {
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

type FixtureRow = {
  id: string;
  slug: string;
  kickoffAt: Date | null;
  status: string;
  competitionName: string | null;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  competitionCode: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
  venueName: string | null;
  homeCrest: string | null;
  awayCrest: string | null;
};

async function toCandidates(rows: FixtureRow[]): Promise<NextMatchCandidate[]> {
  const teamIds = [
    ...new Set(
      rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter((id): id is string => Boolean(id)),
    ),
  ];
  const crestById = new Map<string, string | null>();
  await Promise.all(
    teamIds.map(async (id) => {
      crestById.set(id, await resolveTeamCrestImageUrl(id));
    }),
  );

  return rows.map((r) => ({
    fixtureId: r.id,
    slug: r.slug,
    kickoffAt: r.kickoffAt?.toISOString() ?? null,
    status: r.status,
    competitionName: r.competitionName,
    homeTeamId: r.homeTeamId,
    awayTeamId: r.awayTeamId,
    homeTeamName: r.homeTeamName,
    awayTeamName: r.awayTeamName,
    homeTeamCrestUrl:
      (r.homeTeamId ? crestById.get(r.homeTeamId) : null) ?? r.homeCrest ?? null,
    awayTeamCrestUrl:
      (r.awayTeamId ? crestById.get(r.awayTeamId) : null) ?? r.awayCrest ?? null,
    venueName: r.venueName,
    href: buildHref({
      planetRugbyUrl: r.planetRugbyUrl,
      externalMatchId: r.externalMatchId,
      competitionName: r.competitionName,
      competitionCode: r.competitionCode,
      homeTeamSlug: r.homeTeamSlug,
      awayTeamSlug: r.awayTeamSlug,
      homeTeamName: r.homeTeamName,
      awayTeamName: r.awayTeamName,
      kickoffAt: r.kickoffAt,
    }),
  }));
}

async function loadTeamFixtures(
  teamId: string,
  now: Date,
  limit = 12,
): Promise<FixtureRow[]> {
  const db = getDb();
  const homeTeams = alias(teams, "nm_home");
  const awayTeams = alias(teams, "nm_away");
  // Look back a few hours so LIVE fixtures still resolve after kickoff.
  const lookback = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  return db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      competitionCode: competitions.sdmsCompCode,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
      venueName: fixtures.venueName,
      homeCrest: homeTeams.imageUrl,
      awayCrest: awayTeams.imageUrl,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
        or(gte(fixtures.kickoffAt, lookback), sql`lower(${fixtures.status}) like '%live%'`),
      ),
    )
    .orderBy(asc(fixtures.kickoffAt))
    .limit(limit);
}

async function loadConfirmedSquadFixtures(
  playerId: string,
  now: Date,
): Promise<FixtureRow[]> {
  const db = getDb();
  const homeTeams = alias(teams, "nm_sq_home");
  const awayTeams = alias(teams, "nm_sq_away");
  const lookback = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  return db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      competitionCode: competitions.sdmsCompCode,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
      venueName: fixtures.venueName,
      homeCrest: homeTeams.imageUrl,
      awayCrest: awayTeams.imageUrl,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        eq(fixturePlayers.playerId, playerId),
        or(gte(fixtures.kickoffAt, lookback), sql`lower(${fixtures.status}) like '%live%'`),
      ),
    )
    .orderBy(asc(fixtures.kickoffAt))
    .limit(12);
}

export async function resolveClubMembershipVerified(
  playerId: string,
  clubTeamId: string | null,
): Promise<boolean> {
  if (!clubTeamId) return false;
  const db = getDb();
  const [membership] = await db
    .select({
      verifiedAt: playerTeamMemberships.verifiedAt,
      sourceProvider: playerTeamMemberships.sourceProvider,
      status: playerTeamMemberships.status,
      isCurrent: playerTeamMemberships.isCurrent,
      endDate: playerTeamMemberships.endDate,
    })
    .from(playerTeamMemberships)
    .where(
      and(
        eq(playerTeamMemberships.playerId, playerId),
        eq(playerTeamMemberships.teamId, clubTeamId),
        eq(playerTeamMemberships.isCurrent, true),
      ),
    )
    .limit(1);

  if (!membership) return false;
  if (membership.status && membership.status.toLowerCase() !== "active") return false;
  if (membership.endDate) {
    const end = Date.parse(membership.endDate);
    if (Number.isFinite(end) && end < Date.now() - 24 * 60 * 60 * 1000) return false;
  }
  return membership.verifiedAt != null || membership.sourceProvider === "rugbypass";
}

function toCard(resolution: NextMatchResolution): PlayerNextMatchCard | null {
  if (!resolution.match) {
    return {
      id: "",
      slug: "",
      href: null,
      kickoffAt: null,
      competitionName: null,
      homeTeamName: null,
      awayTeamName: null,
      homeTeamCrestUrl: null,
      awayTeamCrestUrl: null,
      venueName: null,
      status: null,
      isLive: false,
      source: "none",
      reason: resolution.reason,
    };
  }
  const m = resolution.match;
  return {
    id: m.fixtureId,
    slug: m.slug,
    href: m.href,
    kickoffAt: m.kickoffAt,
    competitionName: m.competitionName,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamCrestUrl: m.homeTeamCrestUrl,
    awayTeamCrestUrl: m.awayTeamCrestUrl,
    venueName: m.venueName,
    status: m.status,
    isLive: resolution.isLive,
    source: resolution.source,
    reason: resolution.reason,
  };
}

/**
 * Resolve the Next Match card for a player.
 * Always returns a card object (empty when none) so the UI can keep the shell.
 */
export async function getPlayerNextMatch(input: {
  playerId: string;
  clubTeamId: string | null;
  internationalTeamId: string | null;
  now?: Date;
}): Promise<{ card: PlayerNextMatchCard; audit: NextMatchResolution }> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const clubVerified = await resolveClubMembershipVerified(input.playerId, input.clubTeamId);

  const [squadRows, clubRows, intlRows] = await Promise.all([
    loadConfirmedSquadFixtures(input.playerId, now),
    input.clubTeamId ? loadTeamFixtures(input.clubTeamId, now) : Promise.resolve([]),
    input.internationalTeamId
      ? loadTeamFixtures(input.internationalTeamId, now)
      : Promise.resolve([]),
  ]);

  const [confirmedSquadFixtures, clubFixtures, internationalFixtures] = await Promise.all([
    toCandidates(squadRows),
    toCandidates(clubRows),
    toCandidates(intlRows),
  ]);

  const internationalWindowActive = isInternationalWindowActive({
    nowIso,
    internationalFixtures,
    horizonDays: 28,
  });

  const audit = resolvePlayerNextMatch({
    nowIso,
    confirmedSquadFixtures,
    clubFixtures,
    clubMembershipVerified: clubVerified,
    internationalFixtures,
    internationalWindowActive,
  });

  return { card: toCard(audit)!, audit };
}

/** Lightweight helpers for tests / CMS audit without DB crest resolution. */
export function mapResolutionToUpcomingShape(card: PlayerNextMatchCard | null) {
  if (!card || !card.id) return null;
  return {
    id: card.id,
    slug: card.slug,
    href: card.href,
    kickoffAt: card.kickoffAt,
    competitionName: card.competitionName,
    homeTeamName: card.homeTeamName,
    awayTeamName: card.awayTeamName,
    homeTeamCrestUrl: card.homeTeamCrestUrl,
    awayTeamCrestUrl: card.awayTeamCrestUrl,
    venueName: card.venueName,
  };
}

/** Deduplicate fixture ids when the same row appears in multiple candidate lists. */
export function uniqueFixtureIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export async function loadFixturesByIds(ids: string[]): Promise<FixtureRow[]> {
  const unique = uniqueFixtureIds(ids);
  if (!unique.length) return [];
  const db = getDb();
  const homeTeams = alias(teams, "nm_id_home");
  const awayTeams = alias(teams, "nm_id_away");
  return db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      externalMatchId: fixtures.externalMatchId,
      competitionCode: competitions.sdmsCompCode,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamSlug: homeTeams.slug,
      awayTeamSlug: awayTeams.slug,
      venueName: fixtures.venueName,
      homeCrest: homeTeams.imageUrl,
      awayCrest: awayTeams.imageUrl,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(inArray(fixtures.id, unique));
}
