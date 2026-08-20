import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import {
  coachAwards,
  coachEducation,
  coachHonours,
  coachMedals,
  coachMilestones,
  coachPlayingStints,
  coachRatingHistory,
  coaches,
  competitions,
  fixtures,
  teams,
} from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { getCoachDetail, type CoachingStaffRow } from "./coach-admin-service";
import { normalizeSlug } from "./fixture-admin-service";
import type { CoachSocialAccounts } from "./coach-types";
import {
  getCoachCareerRecord,
  getCoachImpact,
  loadCoachEligibleMatches,
  type CoachCareerRecord,
  type CoachImpactResult,
} from "./coach-career-record-service";
import {
  calculateCoachRatingBundle,
  listCoachWorldRankings,
  type CoachRatingBundle,
} from "./coach-rating-service";
import { getCoachRatingTrends } from "./coach-rating-trends-service";
import {
  getCoachPlayerDevelopment,
  getCoachSelectionStability,
  type CoachPlayerDevelopment,
  type CoachSelectionStability,
} from "./coach-derived-metrics-service";
import { resolveTeamCrestImageUrl } from "./crest-library-service";
import { getCoachPerspectiveResult } from "./coach-perspective-result";
import { buildMatchDetailPath } from "./match-schedule-utils";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  isPublicCareerRecord,
  overviewRoleLabel,
  overviewTeamName,
} from "./coach-career-visibility";
import {
  buildPublicAwardsFromAchievements,
  buildPublicAwardsFromLegacy,
  buildPublicMedalsFromAchievements,
  buildPublicMedalsFromLegacy,
  countMajorHonoursWon,
  listEntityAchievements,
} from "./achievement-service";
import type { PublicAwardRow, PublicMedalRow } from "./achievement-types";
import { isMajorHonourWin, placingFromLegacyAchievementType } from "./achievement-types";

/** Local Match Centre path from stored Planet Rugby URL or CMS fields. */
function buildPublicCoachMatchHref(input: {
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
      /* ignore bad URLs */
    }
  }

  const matchId = input.externalMatchId?.trim() || null;
  const homeSlug =
    input.homeTeamSlug?.trim() ||
    (input.homeTeamName
      ? input.homeTeamName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : "");
  const awaySlug =
    input.awayTeamSlug?.trim() ||
    (input.awayTeamName
      ? input.awayTeamName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : "");
  const matchDate = input.kickoffAt
    ? input.kickoffAt.toISOString().slice(0, 10)
    : null;
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

export type PublicCoachMatch = {
  id: string;
  slug: string;
  /** Public Match Centre path (`/matches/{id}/...`), null when insufficient data. */
  href: string | null;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  side: "home" | "away";
  result: "W" | "D" | "L" | null;
  /** Coach's team in this fixture. */
  coachTeamId: string | null;
  coachTeamName: string | null;
  opponentId: string | null;
  opponentName: string | null;
  opponentCrestUrl: string | null;
  /** Coach-perspective score. */
  pointsFor: number;
  pointsAgainst: number;
  /** H | A | N */
  venueType: "H" | "A" | "N";
  venueName: string | null;
};

export type PublicCoachProfile = {
  id: string;
  slug: string;
  name: string;
  knownAs: string | null;
  fullName: string | null;
  displayName: string;
  nationality: string | null;
  secondNationality: string | null;
  birthDate: string | null;
  age: number | null;
  placeOfBirth: string | null;
  countryOfBirth: string | null;
  heightCm: number | null;
  heightLabel: string | null;
  formerPlayingPositions: string | null;
  coachingCareerStartYear: number | null;
  appointedOn: string | null;
  contractExpiresOn: string | null;
  preferredSystem: string | null;
  coachingStyle: string | null;
  preferredSystemProvenance: string;
  coachingStyleProvenance: string;
  imageUrl: string | null;
  bioSummary: string | null;
  wikipediaUrl: string | null;
  socialAccounts: CoachSocialAccounts;
  verified: boolean;
  assignments: CoachingStaffRow[];
  currentRole: CoachingStaffRow | null;
  currentTeamCrestUrl: string | null;
  recentMatches: PublicCoachMatch[];
  upcomingMatch: {
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
  } | null;
  careerRecord: CoachCareerRecord;
  impact: CoachImpactResult;
  ratings: CoachRatingBundle;
  playingStints: Array<
    typeof coachPlayingStints.$inferSelect & {
      crestUrl: string | null;
    }
  >;
  education: Array<typeof coachEducation.$inferSelect>;
  honours: Array<typeof coachHonours.$inferSelect>;
  awards: Array<typeof coachAwards.$inferSelect>;
  medals: Array<typeof coachMedals.$inferSelect>;
  /** Normalised overview rows (prefer shared achievements when present). */
  publicAwards: PublicAwardRow[];
  publicMedals: PublicMedalRow[];
  /** Verified MAJOR/CHAMPIONSHIP winners only — derived, never stored. */
  majorHonoursCount: number;
  milestones: Array<typeof coachMilestones.$inferSelect>;
  majorHonoursGrouped: Array<{
    key: string;
    label: string;
    count: number;
    honourLevel: string;
    kind: "honour" | "series" | "award";
  }>;
  careerSnapshot: Array<{
    value: number | string;
    label: string;
    /** caps | points | world_cup | championship | award | matches | wins | win_rate */
    icon: string;
  }>;
  ratingHistory: Array<{ date: string; rating: number; change: number | null }>;
  ratingTrends: Awaited<ReturnType<typeof getCoachRatingTrends>>;
  worldRankings: Awaited<ReturnType<typeof listCoachWorldRankings>>;
  selectionStability: CoachSelectionStability;
  playerDevelopment: CoachPlayerDevelopment;
  timeline: Array<{
    id: string;
    year: number;
    yearsLabel: string;
    role: string;
    teamName: string;
    teamSlug: string | null;
    crestUrl: string | null;
    careerType: string;
    isCurrent: boolean;
    badgeKind: string;
  }>;
  preview: boolean;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    noIndex: boolean;
  };
};

function heightLabel(cm: number | null | undefined): string | null {
  if (cm == null || cm <= 0) return null;
  const inchesTotal = cm / 2.54;
  const feet = Math.floor(inchesTotal / 12);
  const inches = Math.round(inchesTotal % 12);
  return `${(cm / 100).toFixed(2)}m (${feet}'${inches}")`;
}

/** Short nationality code for caps label (e.g. South Africa → SA CAPS). */
function internationalCapsLabel(
  nationality: string | null | undefined,
  stintCountry: string | null | undefined,
): string {
  const raw = (stintCountry || nationality || "INTL").trim();
  const lower = raw.toLowerCase();
  const known: Record<string, string> = {
    "south africa": "SA",
    "new zealand": "NZ",
    australia: "AUS",
    england: "ENG",
    ireland: "IRE",
    wales: "WAL",
    scotland: "SCO",
    france: "FRA",
    argentina: "ARG",
    italy: "ITA",
    japan: "JPN",
    fiji: "FIJ",
    samoa: "SAM",
    tonga: "TON",
  };
  if (known[lower]) return `${known[lower]} CAPS`;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words.map((w) => w[0]!.toUpperCase()).join("")} CAPS`;
  }
  return `${raw.slice(0, 3).toUpperCase()} CAPS`;
}

function buildCareerSnapshot(input: {
  nationality: string | null;
  playingStints: Array<{
    teamType: string;
    apps: number | null;
    points: number | null;
    country: string | null;
  }>;
  honours: Array<{
    roleType: string;
    achievementType: string;
    honourLevel: string;
    competitionName: string | null;
  }>;
  awards: Array<{ result: string; isMajor: boolean; awardName: string }>;
  careerRecord: { played: number; wins: number; winRate: number | null };
}): PublicCoachProfile["careerSnapshot"] {
  const intlStints = input.playingStints.filter((s) => s.teamType === "international");
  const intlCaps = intlStints.reduce((s, r) => s + (r.apps ?? 0), 0);
  const intlPoints = intlStints.reduce((s, r) => s + (r.points ?? 0), 0);
  const worldCups = input.honours.filter(
    (h) =>
      h.roleType === "coach" &&
      (h.achievementType === "winner" || h.achievementType === "champion") &&
      (h.competitionName || "").toLowerCase().includes("world cup"),
  ).length;
  const championships = input.honours.filter(
    (h) =>
      h.roleType === "coach" &&
      (h.achievementType === "winner" || h.achievementType === "champion") &&
      /(rugby championship|tri.?nations|six nations)/i.test(h.competitionName || ""),
  ).length;
  const worldRugbyCoachAwards = input.awards.filter(
    (a) => a.result === "winner" && /world rugby coach of the year/i.test(a.awardName),
  );
  const majorAwards = input.awards.filter((a) => a.result === "winner" && a.isMajor);
  const awardCount =
    worldRugbyCoachAwards.length > 0 ? worldRugbyCoachAwards.length : majorAwards.length;
  const awardLabel =
    worldRugbyCoachAwards.length > 0
      ? "WORLD RUGBY COACH OF THE YEAR"
      : "MAJOR COACHING AWARDS";

  const achievementRows: PublicCoachProfile["careerSnapshot"] = [];
  if (intlCaps > 0) {
    achievementRows.push({
      value: intlCaps,
      label: internationalCapsLabel(input.nationality, intlStints[0]?.country),
      icon: "caps",
    });
  }
  if (intlPoints > 0) {
    achievementRows.push({
      value: intlPoints,
      label: "INTERNATIONAL POINTS",
      icon: "points",
    });
  }
  if (worldCups > 0) {
    achievementRows.push({
      value: worldCups,
      label: "WORLD CUPS AS COACH",
      icon: "world_cup",
    });
  }
  if (championships > 0) {
    achievementRows.push({
      value: championships,
      label: "RUGBY CHAMPIONSHIPS",
      icon: "championship",
    });
  }
  if (awardCount > 0) {
    achievementRows.push({
      value: awardCount,
      label: awardLabel,
      icon: "award",
    });
  }

  if (achievementRows.length > 0) return achievementRows.slice(0, 5);

  // Fallback only when no richer person-career data exists (Career Record owns match KPIs).
  const fallback: PublicCoachProfile["careerSnapshot"] = [];
  if (input.careerRecord.played > 0) {
    fallback.push({
      value: input.careerRecord.played,
      label: "MATCHES COACHED",
      icon: "matches",
    });
  }
  if (input.careerRecord.wins > 0) {
    fallback.push({ value: input.careerRecord.wins, label: "WINS", icon: "wins" });
  }
  if (input.careerRecord.winRate != null) {
    fallback.push({
      value: `${input.careerRecord.winRate}%`,
      label: "WIN RATE",
      icon: "win_rate",
    });
  }
  return fallback.slice(0, 5);
}

/** Public brand name — prefer knownAs + surname over JOHAN "RASSIE" ERASMUS. */
function formatDisplayName(name: string, knownAs: string | null, fullName: string | null): string {
  const aka = knownAs?.trim();
  if (aka) {
    const last = fullName?.trim().split(/\s+/).filter(Boolean).at(-1);
    if (last && !aka.toLowerCase().includes(last.toLowerCase())) {
      return `${aka} ${last}`.toUpperCase();
    }
    if (aka.split(/\s+/).length >= 2) return aka.toUpperCase();
  }
  return name.toUpperCase();
}

function groupMajorHonours(
  honours: Array<typeof coachHonours.$inferSelect>,
  awards: Array<typeof coachAwards.$inferSelect>,
) {
  // Major honour won = major/domestic_major + winner only (not runner-up / bronze / series cups)
  const winners = honours.filter((h) => {
    const placing = placingFromLegacyAchievementType(h.achievementType);
    return (
      h.roleType === "coach" &&
      isMajorHonourWin({
        honourLevel:
          h.honourLevel === "major"
            ? "MAJOR"
            : h.honourLevel === "domestic_major"
              ? "CHAMPIONSHIP"
              : h.honourLevel === "secondary"
                ? "CHAMPIONSHIP"
                : "CUP",
        placing,
      })
    );
  });

  const byComp = new Map<string, { label: string; count: number; level: string }>();
  for (const h of winners) {
    const label = (h.competitionName || "Honour").toUpperCase();
    const key = label;
    const cur = byComp.get(key) ?? { label, count: 0, level: h.honourLevel };
    cur.count += 1;
    byComp.set(key, cur);
  }

  const grouped: PublicCoachProfile["majorHonoursGrouped"] = [...byComp.entries()]
    .sort((a, b) => {
      const rank = (l: string) =>
        l === "major" ? 0 : l === "domestic_major" ? 1 : l === "secondary" ? 2 : 3;
      return rank(a[1].level) - rank(b[1].level) || b[1].count - a[1].count;
    })
    .slice(0, 5)
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      honourLevel: v.level,
      kind: "honour" as const,
    }));

  // Personal awards are separate — do not inflate Major Honours tiles
  void awards;

  return grouped.slice(0, 6);
}

export async function getPublicCoachProfile(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PublicCoachProfile | null> {
  const preview = Boolean(options.preview);
  const db = getDb();
  const normalized = normalizeSlug(slug);
  const [row] = await db.select().from(coaches).where(eq(coaches.slug, normalized)).limit(1);
  if (!row) return null;

  if (!preview) {
    if (row.isPublic === false || row.publishStatus === "hidden" || row.publishStatus === "draft") {
      return null;
    }
  }

  const detail = await getCoachDetail(row.id);
  if (!detail) return null;

  const coachId = row.id;
  const currentRole =
    detail.assignments.find((a) => a.isCurrent && a.isPrimaryCoach) ??
    detail.assignments.find((a) => a.isCurrent) ??
    detail.assignments[0] ??
    null;

  const [
    playingStints,
    education,
    honours,
    awards,
    medals,
    milestones,
    careerRecord,
    impact,
    ratings,
    ratingHistoryRows,
    ratingTrends,
    worldRankings,
    selectionStability,
    playerDevelopment,
  ] = await Promise.all([
    db
      .select()
      .from(coachPlayingStints)
      .where(eq(coachPlayingStints.coachId, coachId))
      .orderBy(asc(coachPlayingStints.sortOrder), asc(coachPlayingStints.startYear)),
    db
      .select()
      .from(coachEducation)
      .where(eq(coachEducation.coachId, coachId))
      .orderBy(asc(coachEducation.sortOrder)),
    db
      .select()
      .from(coachHonours)
      .where(eq(coachHonours.coachId, coachId))
      .orderBy(desc(coachHonours.year), asc(coachHonours.sortOrder)),
    db
      .select()
      .from(coachAwards)
      .where(eq(coachAwards.coachId, coachId))
      .orderBy(desc(coachAwards.year), asc(coachAwards.sortOrder)),
    db
      .select()
      .from(coachMedals)
      .where(eq(coachMedals.coachId, coachId))
      .orderBy(desc(coachMedals.year)),
    db
      .select()
      .from(coachMilestones)
      .where(eq(coachMilestones.coachId, coachId))
      .orderBy(asc(coachMilestones.milestoneYear), asc(coachMilestones.sortOrder)),
    getCoachCareerRecord(coachId),
    getCoachImpact(coachId),
    calculateCoachRatingBundle(coachId),
    db
      .select()
      .from(coachRatingHistory)
      .where(eq(coachRatingHistory.coachId, coachId))
      .orderBy(asc(coachRatingHistory.calculatedAt))
      .limit(48),
    getCoachRatingTrends(coachId, "last_24"),
    listCoachWorldRankings(50),
    getCoachSelectionStability(coachId),
    getCoachPlayerDevelopment(coachId),
  ]);

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");

  // Prefer tenure-derived eligible matches for recent results (not FK-only).
  const eligibleRecent = await loadCoachEligibleMatches(coachId, { limit: 24 });
  const eligibleIds = eligibleRecent.map((m) => m.id);

  const matchSelect = {
    id: fixtures.id,
    slug: fixtures.slug,
    kickoffAt: fixtures.kickoffAt,
    status: fixtures.status,
    competitionName: fixtures.competitionName,
    planetRugbyUrl: fixtures.planetRugbyUrl,
    externalMatchId: fixtures.externalMatchId,
    competitionCode: competitions.sdmsCompCode,
    homeTeamName: homeTeams.name,
    awayTeamName: awayTeams.name,
    homeTeamSlug: homeTeams.slug,
    awayTeamSlug: awayTeams.slug,
    homeScore: fixtures.homeScore,
    awayScore: fixtures.awayScore,
    homeCoachId: fixtures.homeCoachId,
    awayCoachId: fixtures.awayCoachId,
    homeTeamId: fixtures.homeTeamId,
    awayTeamId: fixtures.awayTeamId,
    venueName: fixtures.venueName,
    isNeutralVenue: fixtures.isNeutralVenue,
    homeCrest: homeTeams.imageUrl,
    awayCrest: awayTeams.imageUrl,
  } as const;

  const matchRows =
    eligibleIds.length > 0
      ? await db
          .select(matchSelect)
          .from(fixtures)
          .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
          .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
          .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
          .where(inArray(fixtures.id, eligibleIds))
          .orderBy(desc(fixtures.kickoffAt))
      : await db
          .select(matchSelect)
          .from(fixtures)
          .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
          .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
          .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
          .where(or(eq(fixtures.homeCoachId, coachId), eq(fixtures.awayCoachId, coachId)))
          .orderBy(desc(fixtures.kickoffAt))
          .limit(24);

  const eligibleById = new Map(eligibleRecent.map((m) => [m.id, m]));

  const completed = matchRows.filter((m) => {
    const s = (m.status || "").toLowerCase().replace(/\s+/g, "_");
    return (
      s.includes("complete") ||
      s.includes("finish") ||
      s === "result" ||
      s === "ft" ||
      s === "full_time" ||
      s.includes("full_time")
    );
  });

  const recentSlice = completed.slice(0, 8);
  const opponentIdsForCrest = [
    ...new Set(
      recentSlice
        .map((m) => {
          const eligible = eligibleById.get(m.id);
          const side: "home" | "away" =
            eligible?.side ?? (m.homeCoachId === coachId ? "home" : "away");
          return (
            eligible?.opponentTeamId ??
            (side === "home" ? m.awayTeamId : m.homeTeamId) ??
            null
          );
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const opponentCrestById = new Map<string, string | null>();
  await Promise.all(
    opponentIdsForCrest.map(async (teamId) => {
      opponentCrestById.set(teamId, await resolveTeamCrestImageUrl(teamId));
    }),
  );

  const recentMatches: PublicCoachMatch[] = recentSlice.map((m) => {
    const eligible = eligibleById.get(m.id);
    const side: "home" | "away" =
      eligible?.side ?? (m.homeCoachId === coachId ? "home" : "away");
    const coachTeamId =
      eligible?.teamId ??
      (side === "home" ? m.homeTeamId : m.awayTeamId) ??
      null;

    const perspective = getCoachPerspectiveResult(
      {
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        homeCrestUrl: m.homeCrest,
        awayCrestUrl: m.awayCrest,
        isNeutralVenue: m.isNeutralVenue,
        competitionName: m.competitionName,
        kickoffAt: m.kickoffAt,
        storedResult: eligible?.result ?? null,
      },
      coachTeamId,
    );

    const opponentId = perspective.opponentTeamId;
    const opponentCrest =
      (opponentId ? opponentCrestById.get(opponentId) : null) ??
      perspective.opponentCrest;

    const pointsFor = perspective.pointsFor ?? 0;
    const pointsAgainst = perspective.pointsAgainst ?? 0;
    const venueType =
      perspective.venueType ?? (side === "home" ? "H" : "A");

    return {
      id: m.id,
      slug: m.slug,
      href: buildPublicCoachMatchHref({
        planetRugbyUrl: m.planetRugbyUrl,
        externalMatchId: m.externalMatchId,
        competitionName: m.competitionName,
        competitionCode: m.competitionCode,
        homeTeamSlug: m.homeTeamSlug,
        awayTeamSlug: m.awayTeamSlug,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        kickoffAt: m.kickoffAt,
      }),
      kickoffAt: m.kickoffAt?.toISOString() ?? null,
      status: m.status,
      competitionName: m.competitionName,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
      side: perspective.venueType === "A" ? "away" : "home",
      result: perspective.result,
      coachTeamId: perspective.coachTeamId,
      coachTeamName: perspective.coachTeamName,
      opponentId,
      opponentName: perspective.opponentName,
      opponentCrestUrl: opponentCrest,
      pointsFor,
      pointsAgainst,
      venueType,
      venueName: m.venueName ?? null,
    };
  });

  const now = new Date();
  // Upcoming = next fixture for current team (not coach FK — FKs are for completed history).
  let upcomingMatch: PublicCoachProfile["upcomingMatch"] = null;
  if (currentRole?.teamId) {
    const upcomingRows = await db
      .select({
        id: fixtures.id,
        slug: fixtures.slug,
        kickoffAt: fixtures.kickoffAt,
        status: fixtures.status,
        competitionName: fixtures.competitionName,
        planetRugbyUrl: fixtures.planetRugbyUrl,
        externalMatchId: fixtures.externalMatchId,
        competitionCode: competitions.sdmsCompCode,
        homeTeamName: homeTeams.name,
        awayTeamName: awayTeams.name,
        homeTeamSlug: homeTeams.slug,
        awayTeamSlug: awayTeams.slug,
        venueName: fixtures.venueName,
        homeCrest: homeTeams.imageUrl,
        awayCrest: awayTeams.imageUrl,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
      })
      .from(fixtures)
      .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
      .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
      .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
      .where(
        and(
          or(
            eq(fixtures.homeTeamId, currentRole.teamId),
            eq(fixtures.awayTeamId, currentRole.teamId),
          ),
          gte(fixtures.kickoffAt, now),
        ),
      )
      .orderBy(asc(fixtures.kickoffAt))
      .limit(8);

    const upcomingRow = upcomingRows.find((m) => {
      const s = (m.status || "").toLowerCase();
      return !s.includes("complete") && !s.includes("finish") && s !== "result" && s !== "ft";
    });
    if (upcomingRow) {
      upcomingMatch = {
        id: upcomingRow.id,
        slug: upcomingRow.slug,
        href: buildPublicCoachMatchHref({
          planetRugbyUrl: upcomingRow.planetRugbyUrl,
          externalMatchId: upcomingRow.externalMatchId,
          competitionName: upcomingRow.competitionName,
          competitionCode: upcomingRow.competitionCode,
          homeTeamSlug: upcomingRow.homeTeamSlug,
          awayTeamSlug: upcomingRow.awayTeamSlug,
          homeTeamName: upcomingRow.homeTeamName,
          awayTeamName: upcomingRow.awayTeamName,
          kickoffAt: upcomingRow.kickoffAt,
        }),
        kickoffAt: upcomingRow.kickoffAt?.toISOString() ?? null,
        competitionName: upcomingRow.competitionName,
        homeTeamName: upcomingRow.homeTeamName,
        awayTeamName: upcomingRow.awayTeamName,
        homeTeamCrestUrl: upcomingRow.homeCrest ?? null,
        awayTeamCrestUrl: upcomingRow.awayCrest ?? null,
        venueName: upcomingRow.venueName ?? null,
      };
    }
  } else {
    const upcomingRow = matchRows.find(
      (m) => m.kickoffAt && m.kickoffAt > now && !(m.status || "").toLowerCase().includes("complete"),
    );
    if (upcomingRow) {
      upcomingMatch = {
        id: upcomingRow.id,
        slug: upcomingRow.slug,
        href: buildPublicCoachMatchHref({
          planetRugbyUrl: upcomingRow.planetRugbyUrl,
          externalMatchId: upcomingRow.externalMatchId,
          competitionName: upcomingRow.competitionName,
          competitionCode: upcomingRow.competitionCode,
          homeTeamSlug: upcomingRow.homeTeamSlug,
          awayTeamSlug: upcomingRow.awayTeamSlug,
          homeTeamName: upcomingRow.homeTeamName,
          awayTeamName: upcomingRow.awayTeamName,
          kickoffAt: upcomingRow.kickoffAt,
        }),
        kickoffAt: upcomingRow.kickoffAt?.toISOString() ?? null,
        competitionName: upcomingRow.competitionName,
        homeTeamName: upcomingRow.homeTeamName,
        awayTeamName: upcomingRow.awayTeamName,
        homeTeamCrestUrl: upcomingRow.homeCrest ?? null,
        awayTeamCrestUrl: upcomingRow.awayCrest ?? null,
        venueName: upcomingRow.venueName ?? null,
      };
    }
  }

  let currentTeamCrestUrl: string | null = null;
  if (currentRole?.teamId) {
    currentTeamCrestUrl = await resolveTeamCrestImageUrl(currentRole.teamId);
  }

  const careerSnapshot = buildCareerSnapshot({
    nationality: detail.coach.nationality,
    playingStints,
    honours,
    awards,
    careerRecord,
  });

  let publicAwards = buildPublicAwardsFromLegacy(awards);
  let publicMedals = buildPublicMedalsFromLegacy(medals);
  let majorHonoursCount = honours.filter((h) => {
    const placing = placingFromLegacyAchievementType(h.achievementType);
    return (
      h.roleType === "coach" &&
      isMajorHonourWin({
        honourLevel:
          h.honourLevel === "major"
            ? "MAJOR"
            : h.honourLevel === "domestic_major" || h.honourLevel === "secondary"
              ? "CHAMPIONSHIP"
              : "CUP",
        placing,
      })
    );
  }).length;

  try {
    const achievementRows = await listEntityAchievements("coach", coachId, {
      publicOnly: true,
    });
    if (achievementRows.length > 0) {
      const fromAchievementsAwards = buildPublicAwardsFromAchievements(achievementRows);
      const fromAchievementsMedals = buildPublicMedalsFromAchievements(achievementRows);
      if (fromAchievementsAwards.length) publicAwards = fromAchievementsAwards;
      if (fromAchievementsMedals.length) publicMedals = fromAchievementsMedals;
      majorHonoursCount = countMajorHonoursWon(achievementRows);
    }
  } catch {
    /* achievements table may not exist yet — fall back to legacy */
  }

  const publicAssignments = detail.assignments.filter((a) =>
    isPublicCareerRecord({ recordStatus: a.recordStatus, verifiedAt: a.verifiedAt }),
  );
  const publicPlayingStints = playingStints.filter((p) =>
    isPublicCareerRecord({
      recordStatus: (p as { recordStatus?: string }).recordStatus,
      verifiedAt: p.verifiedAt,
    }),
  );

  const overviewAssignments = publicAssignments.filter((a) => a.showOnOverview || a.isCurrent);
  const timelineSource =
    overviewAssignments.length > 0 ? overviewAssignments : publicAssignments.slice(0, 12);

  const crestByTeamId = new Map<string, string | null>();
  const teamIds = [
    ...new Set(
      [
        ...timelineSource.map((a) => a.teamId),
        ...publicPlayingStints.map((p) => p.teamId).filter(Boolean),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  await Promise.all(
    teamIds.map(async (teamId) => {
      crestByTeamId.set(teamId, await resolveTeamCrestImageUrl(teamId));
    }),
  );

  const timeline: PublicCoachProfile["timeline"] = timelineSource.map((a) => {
    const startY = a.startDate ? Number(a.startDate.slice(0, 4)) : 0;
    const endY = a.endDate ? Number(a.endDate.slice(0, 4)) : null;
    const yearsLabel =
      startY && endY
        ? `${startY}–${endY}`
        : startY
          ? a.isCurrent
            ? `${startY}–`
            : `${startY}`
          : a.seasonLabel || "—";
    const careerType =
      a.careerType === "technical" || a.careerType === "management" || a.careerType === "coach"
        ? a.careerType
        : "coach";
    const role = overviewRoleLabel({
      overviewLabel: a.overviewLabel,
      roleLabel: a.roleLabel,
      role: a.role,
      careerType,
      teamName: a.teamName,
    });
    return {
      id: a.id,
      year: startY || new Date().getFullYear(),
      yearsLabel,
      role,
      teamName: overviewTeamName({
        teamDisplayName: a.teamDisplayName,
        teamName: a.teamName,
      }),
      teamSlug: a.teamSlug,
      crestUrl: crestByTeamId.get(a.teamId) ?? null,
      careerType,
      isCurrent: a.isCurrent,
      badgeKind: careerType === "technical" ? "technical" : a.role,
    };
  });

  // prepend playing overview stints (full history keeps all public; overview uses show_on_overview)
  for (const s of publicPlayingStints.filter((p) => p.showOnOverview).slice(0, 6)) {
    const role =
      (s as { overviewLabel?: string | null }).overviewLabel?.trim() ||
      (s.teamType === "international" ||
      (s as { careerType?: string }).careerType === "international_player"
        ? "International Player"
        : "Player");
    timeline.unshift({
      id: s.id,
      year: s.startYear ?? 0,
      yearsLabel: s.yearsLabel,
      role,
      teamName: overviewTeamName({
        teamDisplayName: (s as { teamDisplayName?: string | null }).teamDisplayName,
        teamName: s.teamName,
      }),
      teamSlug: null,
      crestUrl: s.teamId ? crestByTeamId.get(s.teamId) ?? null : null,
      careerType: "player",
      isCurrent: false,
      badgeKind:
        s.teamType === "international" ||
        (s as { careerType?: string }).careerType === "international_player"
          ? "international_player"
          : "player",
    });
  }
  timeline.sort((a, b) => a.year - b.year || a.yearsLabel.localeCompare(b.yearsLabel));

  const description =
    detail.coach.seoDescription?.trim() ||
    detail.coach.bioSummary?.trim().slice(0, 160) ||
    `${detail.coach.name} coach profile on Rugby365.`;

  return {
    id: detail.coach.id,
    slug: detail.coach.slug,
    name: detail.coach.name,
    knownAs: detail.coach.knownAs ?? null,
    fullName: detail.coach.fullName ?? null,
    displayName: formatDisplayName(
      detail.coach.name,
      detail.coach.knownAs ?? null,
      detail.coach.fullName ?? null,
    ),
    nationality: detail.coach.nationality,
    secondNationality: detail.coach.secondNationality ?? null,
    birthDate: detail.coach.birthDate,
    age: detail.age ?? calculatePlayerAge(detail.coach.birthDate),
    placeOfBirth: detail.coach.placeOfBirth ?? null,
    countryOfBirth: detail.coach.countryOfBirth ?? null,
    heightCm: detail.coach.heightCm ?? null,
    heightLabel: heightLabel(detail.coach.heightCm),
    formerPlayingPositions: detail.coach.formerPlayingPositions ?? null,
    coachingCareerStartYear: detail.coach.coachingCareerStartYear ?? null,
    appointedOn: detail.coach.appointedOn ?? null,
    contractExpiresOn: detail.coach.contractExpiresOn ?? null,
    preferredSystem: detail.coach.preferredSystem ?? null,
    coachingStyle: detail.coach.coachingStyle ?? null,
    preferredSystemProvenance: detail.coach.preferredSystemProvenance ?? "unverified",
    coachingStyleProvenance: detail.coach.coachingStyleProvenance ?? "unverified",
    imageUrl: detail.coach.imageUrl,
    bioSummary: detail.coach.bioSummary,
    wikipediaUrl: detail.coach.wikipediaUrl,
    socialAccounts: detail.socialAccounts,
    verified: Boolean(detail.coach.lastVerifiedAt),
    assignments: publicAssignments,
    currentRole,
    currentTeamCrestUrl,
    recentMatches,
    upcomingMatch,
    careerRecord,
    impact,
    ratings,
    playingStints: publicPlayingStints.map((s) => ({
      ...s,
      crestUrl: s.teamId ? crestByTeamId.get(s.teamId) ?? null : null,
    })),
    education,
    honours,
    awards,
    medals,
    publicAwards,
    publicMedals,
    majorHonoursCount,
    milestones,
    majorHonoursGrouped: groupMajorHonours(honours, awards),
    careerSnapshot,
    ratingHistory: ratingHistoryRows.map((r) => ({
      date: r.calculatedAt.toISOString(),
      rating: r.rating,
      change: r.change,
    })),
    ratingTrends,
    worldRankings,
    selectionStability,
    playerDevelopment,
    timeline,
    preview,
    seo: {
      title: detail.coach.seoTitle || `${detail.coach.name} | Coach | Rugby365`,
      description,
      canonicalPath: `/coaches/${detail.coach.slug}`,
      noIndex: preview || detail.coach.publishStatus !== "published",
    },
  };
}
