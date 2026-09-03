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
  players,
  teams,
} from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { getCoachDetail, type CoachingStaffRow } from "./coach-admin-service";
import { normalizeSlug } from "./fixture-admin-service";
import type { CoachSocialAccounts } from "./coach-types";
import {
  computeCareerRecord,
  getCoachImpact,
  loadCoachEligibleMatches,
  type CoachCareerRecord,
  type CoachEligibleMatch,
  type CoachImpactResult,
} from "./coach-career-record-service";
import {
  applyPublicCoachMetricWorldRanks,
  buildCoachRatingBundleFromMatches,
  displayCoachTeamName,
  emptyCoachRatingBundle,
  listCoachWorldRankings,
  readLatestCoachRatingBundle,
  type CoachRatingBundle,
} from "./coach-rating-service";
import { getCoachRatingTrends } from "./coach-rating-trends-service";
import { relatedTeamIdsBySource, allRelatedTeamIds } from "./coach-team-aliases";
import {
  COACH_TREND_DIRECTION_VERSION,
  COACH_TREND_FILTER_LABELS,
  type CoachRatingTrendsBundle,
} from "./coach-rating-trends-types";
import { COACH_IMPACT_VERSION } from "./coach-impact-engine";
import {
  getCoachPlayerDevelopment,
  getCoachSelectionStability,
  type CoachPlayerDevelopment,
  type CoachSelectionStability,
} from "./coach-derived-metrics-service";
import { resolveTeamCrestByName, resolveTeamCrestImageUrl } from "./crest-library-service";
import { matchClusterKey, resolveCoachMatchExtras } from "./coach-match-motm";
import { getCoachPerspectiveResult } from "./coach-perspective-result";
import { buildMatchDetailPath } from "./match-schedule-utils";
import { calculatePlayerAge } from "./player-profile-utils";
import {
  isPublicCareerRecord,
  isPublicHistoryAssignment,
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
import {
  getCoachTeamDashboard,
  type CoachTeamDashboard,
} from "./coach-team-dashboard-service";

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
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  /** Coach-perspective score. */
  pointsFor: number;
  pointsAgainst: number;
  /** H | A | N */
  venueType: "H" | "A" | "N";
  venueName: string | null;
  attendance: number | null;
  manOfTheMatch: string | null;
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
  teamDashboard: CoachTeamDashboard | null;
  crestByTeamId: Record<string, string | null>;
  assignmentStats: Record<
    string,
    { played: number; wins: number; draws: number; losses: number; winRate: number | null }
  >;
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

function dedupePublicHonours<T extends {
  year: number | null;
  competitionName: string | null;
  achievementType: string;
  roleType: string;
}>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.roleType}|${row.year ?? ""}|${(row.competitionName || "").toLowerCase()}|${row.achievementType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicMatchClusterKey(row: {
  kickoffAt?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
}): string {
  return (
    matchClusterKey({
      kickoffAt: row.kickoffAt ?? null,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore: row.homeScore ?? row.pointsFor ?? null,
      awayScore: row.awayScore ?? row.pointsAgainst ?? null,
    }) ?? row.kickoffAt ?? "match"
  );
}

function mergePublicMatch(prev: PublicCoachMatch, next: PublicCoachMatch): PublicCoachMatch {
  const prevUnknown = /unknown/i.test(`${prev.opponentName ?? ""} ${prev.homeTeamName} ${prev.awayTeamName}`);
  const nextUnknown = /unknown/i.test(`${next.opponentName ?? ""} ${next.homeTeamName} ${next.awayTeamName}`);
  const keep = prevUnknown && !nextUnknown ? next : prev;
  const other = keep === prev ? next : prev;
  return {
    ...keep,
    attendance: keep.attendance && keep.attendance > 0 ? keep.attendance : other.attendance,
    manOfTheMatch: keep.manOfTheMatch || other.manOfTheMatch,
  };
}

function dedupePublicMatches(rows: PublicCoachMatch[]): PublicCoachMatch[] {
  const byCluster = new Map<string, PublicCoachMatch>();
  for (const row of dedupeById(rows)) {
    const key = publicMatchClusterKey(row);
    const prev = byCluster.get(key);
    if (!prev) {
      byCluster.set(key, row);
      continue;
    }
    byCluster.set(key, mergePublicMatch(prev, row));
  }
  return [...byCluster.values()];
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function dedupeNamedYear<T extends { year?: number | null; milestoneYear?: number | null }>(
  rows: T[],
  name: (row: T) => string,
): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const year = row.year ?? row.milestoneYear ?? "";
    const key = `${year}|${name(row).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function emptyImpact(): CoachImpactResult {
  return {
    modelVersion: COACH_IMPACT_VERSION,
    baselineLabel: "vs Before Appointment",
    underLabel: "Under Coach",
    beforeCount: 0,
    underCount: 0,
    rows: [],
    confidence: "none",
    confidencePct: 0,
    enoughData: false,
    tenureStart: null,
    teamId: null,
    teamName: null,
  };
}

function emptyPlayerDevelopment(): CoachPlayerDevelopment {
  return {
    enoughData: false,
    matchesWithRatings: 0,
    mostImproved: [],
    message: "INSUFFICIENT PLAYER DEVELOPMENT DATA",
    modelVersion: "coach-player-development-v1",
    health: {
      playersUsed: 0,
      eligibleForDevelopment: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      insufficientData: 0,
      ratedAppearanceCoveragePct: null,
    },
    coachDevelopmentScore: null,
  };
}

function emptySelectionStability(): CoachSelectionStability {
  return {
    modelVersion: "coach-selection-stability-v1",
    enoughData: false,
    message: "INSUFFICIENT SELECTION STABILITY DATA",
    stabilityScore: null,
    stabilityLabel: null,
    confidencePct: null,
    playersUsed: 0,
    startersUsed: 0,
    benchOnlyPlayers: 0,
    avgStartingXvChanges: null,
    avgBenchChanges: null,
    unchangedXvPct: null,
    debutants: 0,
    avgStartingXvAge: null,
    avgBenchAge: null,
    matchesAnalysed: 0,
    lineupTransitions: 0,
    lineupsAvailable: 0,
    eligibleMatches: 0,
    coveragePct: null,
    dataIssues: [],
    components: {
      startingXvContinuity: null,
      benchContinuity: null,
      successfulRotation: null,
      selectionPerformance: null,
      unchangedXv: null,
    },
    matchesWithLineups: 0,
    differentCaptains: null,
  };
}

function emptyRatingTrends(): CoachRatingTrendsBundle {
  return {
    points: [],
    summary: {
      current: null,
      rangeChange: null,
      high: null,
      low: null,
      trend: "stable",
      trendLabel: "Stable",
      trendVersion: COACH_TREND_DIRECTION_VERSION,
      pointCount: 0,
      filter: "last_24",
      filterLabel: COACH_TREND_FILTER_LABELS.last_24,
    },
    tenures: [],
  };
}

const PUBLIC_COACH_PROFILE_CACHE_MS = 15_000;
const publicCoachProfileCache = new Map<
  string,
  { expires: number; promise: Promise<PublicCoachProfile | null> }
>();

export async function getPublicCoachProfile(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PublicCoachProfile | null> {
  const preview = Boolean(options.preview);
  const cacheKey = `${normalizeSlug(slug)}:${preview ? "preview" : "public"}`;
  const now = Date.now();
  const hit = publicCoachProfileCache.get(cacheKey);
  if (hit && hit.expires > now) return hit.promise;
  const promise = loadPublicCoachProfile(slug, { preview });
  publicCoachProfileCache.set(cacheKey, { expires: now + PUBLIC_COACH_PROFILE_CACHE_MS, promise });
  void promise.catch(() => publicCoachProfileCache.delete(cacheKey));
  return promise;
}

async function loadPublicCoachProfile(
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
    honoursRows,
    awardsRows,
    medalsRows,
    milestonesRows,
    eligibleMatches,
    impact,
    storedRatings,
    ratingHistoryRows,
    ratingTrends,
    worldRankingsRaw,
    selectionStability,
    playerDevelopment,
    teamDashboard,
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
    loadCoachEligibleMatches(coachId, { primaryOnly: true }),
    getCoachImpact(coachId).catch(() => emptyImpact()),
    readLatestCoachRatingBundle(coachId).then((bundle) => bundle ?? emptyCoachRatingBundle()),
    db
      .select()
      .from(coachRatingHistory)
      .where(eq(coachRatingHistory.coachId, coachId))
      .orderBy(asc(coachRatingHistory.calculatedAt))
      .limit(48),
    getCoachRatingTrends(coachId, "last_24").catch(() => emptyRatingTrends()),
    listCoachWorldRankings(15).catch(() => []),
    getCoachSelectionStability(coachId).catch(() => emptySelectionStability()),
    getCoachPlayerDevelopment(coachId).catch(() => emptyPlayerDevelopment()),
    getCoachTeamDashboard(currentRole?.teamSlug, currentRole?.teamId).catch(() => null),
  ]);

  const careerRecord = computeCareerRecord(eligibleMatches, {
    partial: detail.coach.careerRecordPartial ?? eligibleMatches.length > 0,
    notes: detail.coach.careerRecordNotes ?? null,
  });

  let ratings =
    storedRatings.overallRating != null || storedRatings.intelligence.length > 0
      ? storedRatings
      : buildCoachRatingBundleFromMatches(eligibleMatches);
  if (ratings.overallRating == null && ratingHistoryRows.length > 0) {
    const last = ratingHistoryRows[ratingHistoryRows.length - 1];
    ratings = {
      ...ratings,
      overallRating: last.rating,
      matchCount: Math.max(ratings.matchCount, eligibleMatches.length),
      dataConfidence: ratings.dataConfidence === "none" ? "low" : ratings.dataConfidence,
    };
  }

  const worldRankings = (() => {
    const rows = worldRankingsRaw.map((row) => ({
      ...row,
      currentTeamName: displayCoachTeamName(row.currentTeamName),
    }));
    const selfOnBoard = rows.some((row) => row.coachId === coachId);
    if (!selfOnBoard && ratings.overallRating != null) {
      rows.push({
        rank: rows.length + 1,
        coachId,
        name: detail.coach.name,
        slug: detail.coach.slug,
        nationality: detail.coach.nationality,
        currentTeamName:
          displayCoachTeamName(currentRole?.teamDisplayName) ??
          displayCoachTeamName(currentRole?.teamName),
        imageUrl: detail.coach.imageUrl,
        rating: ratings.overallRating,
        powerIndex: ratings.powerIndex != null ? Math.round(ratings.powerIndex) : null,
        winRate: careerRecord.winRate,
        bigMatch: null,
        playerDevelopment: null,
        rankChange: null,
        previousRank: null,
        movement: null,
        confidence: ratings.ratingConfidencePct,
        coverage: ratings.ratingConfidencePct,
        matchesUsed: ratings.matchCount,
      });
    }
    const sorted = [...rows].sort((a, b) => b.rating - a.rating || a.coachId.localeCompare(b.coachId));
    return sorted.map((row, i) => {
      const rank = i + 1;
      const previousRank = row.previousRank ?? rank;
      const rankChange = previousRank - rank;
      return {
        ...row,
        rank,
        previousRank,
        rankChange,
        movement: rankChange,
      };
    });
  })();
  const selfRank = worldRankings.find((row) => row.coachId === coachId);
  if (selfRank) {
    ratings = {
      ...ratings,
      worldRank: selfRank.rank,
      rankedOutOf: worldRankings.length,
    };
  }
  if (ratings.intelligence.length > 0) {
    try {
      ratings = {
        ...ratings,
        intelligence: await applyPublicCoachMetricWorldRanks(coachId, ratings.intelligence),
      };
    } catch {
      // Peer snapshots may be sparse until lite persist has run.
    }
  }

  const awards = dedupeNamedYear(awardsRows, (row) => row.awardName);
  const medals = medalsRows;
  const milestones = dedupeNamedYear(milestonesRows, (row) => row.title);
  const honours = dedupePublicHonours(honoursRows);

  const improved = playerDevelopment.mostImproved?.[0];
  if (teamDashboard && improved) {
    const delta = improved.displayedChange ?? improved.delta ?? 0;
    teamDashboard.mostImproved = {
      id: improved.playerId,
      slug: improved.playerSlug ?? "",
      name: improved.playerName,
      imageUrl: improved.playerImageUrl ?? null,
      deltaLabel: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
    };
  }
  if (teamDashboard) {
    const trophyStat = teamDashboard.keyStats.find((s) => s.label === "Trophies");
    if (trophyStat && (trophyStat.value === "0" || trophyStat.value === "—")) {
      const teamName = (teamDashboard.teamName || "").toLowerCase();
      const teamHonours = honoursRows.filter((h) => {
        const win = /win|champion|title/i.test(h.achievementType ?? "");
        const sameTeam =
          (h.teamId && h.teamId === teamDashboard.teamId) ||
          (h.teamName && h.teamName.toLowerCase().includes(teamName) && teamName.length > 2);
        return h.roleType === "coach" && win && sameTeam;
      });
      const count = teamHonours.length;
      if (count > 0) {
        trophyStat.value = String(count);
        trophyStat.sub = "Recorded titles";
      }
    }
  }

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const potmPlayers = alias(players, "potm_players");
  const officialPotmPlayers = alias(players, "official_potm_players");

  // Prefer tenure-derived eligible matches for recent results (not FK-only).
  // Take a wide window so duplicate CMS copies of the same test do not crowd out
  // unique results that already have attendance / MOTM on a sibling row.
  const eligibleRecent = eligibleMatches.slice(-80);
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
    attendance: fixtures.attendance,
    officialPotmName: fixtures.officialPotmName,
    rugby365PotmName: potmPlayers.name,
    officialPotmPlayerName: officialPotmPlayers.name,
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
          .leftJoin(potmPlayers, eq(fixtures.rugby365PotmPlayerId, potmPlayers.id))
          .leftJoin(officialPotmPlayers, eq(fixtures.officialPotmPlayerId, officialPotmPlayers.id))
          .where(inArray(fixtures.id, eligibleIds))
          .orderBy(desc(fixtures.kickoffAt))
      : await db
          .select(matchSelect)
          .from(fixtures)
          .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
          .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
          .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
          .leftJoin(potmPlayers, eq(fixtures.rugby365PotmPlayerId, potmPlayers.id))
          .leftJoin(officialPotmPlayers, eq(fixtures.officialPotmPlayerId, officialPotmPlayers.id))
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

  const uniqueCompleted: typeof completed = [];
  const seenClusters = new Set<string>();
  for (const m of completed) {
    if (/unknown/i.test(`${m.homeTeamName ?? ""} ${m.awayTeamName ?? ""}`)) continue;
    const key =
      matchClusterKey({
        kickoffAt: m.kickoffAt,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }) ?? m.id;
    if (seenClusters.has(key)) continue;
    seenClusters.add(key);
    uniqueCompleted.push(m);
  }
  const recentSlice = uniqueCompleted.slice(0, 12);
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

  const matchExtras = await resolveCoachMatchExtras(
    recentSlice.map((m) => ({
      id: m.id,
      kickoffAt: m.kickoffAt,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      attendance: m.attendance,
      officialPotmName: m.officialPotmName,
      officialPotmPlayerName: m.officialPotmPlayerName,
      rugby365PotmName: m.rugby365PotmName,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
    })),
  );
  for (const [fixtureId, extra] of matchExtras) {
    const row = recentSlice.find((m) => m.id === fixtureId);
    if (!row) continue;
    if (extra.attendance != null && extra.attendance > 0 && !(row.attendance && row.attendance > 0)) {
      void db
        .update(fixtures)
        .set({ attendance: extra.attendance })
        .where(eq(fixtures.id, fixtureId))
        .then(() => undefined)
        .catch(() => undefined);
    }
    if (extra.rugby365PotmPlayerId && !row.rugby365PotmName && !row.officialPotmName) {
      void db
        .update(fixtures)
        .set({ rugby365PotmPlayerId: extra.rugby365PotmPlayerId })
        .where(eq(fixtures.id, fixtureId))
        .then(() => undefined)
        .catch(() => undefined);
    }
  }

  const recentMatchesRaw: PublicCoachMatch[] = dedupeById(
    recentSlice.map((m) => {
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
      homeTeamName: displayCoachTeamName(m.homeTeamName) ?? "—",
      awayTeamName: displayCoachTeamName(m.awayTeamName) ?? "—",
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
      side: perspective.venueType === "A" ? "away" : "home",
      result: perspective.result,
      coachTeamId: perspective.coachTeamId,
      coachTeamName: displayCoachTeamName(perspective.coachTeamName),
      opponentId,
      opponentName: displayCoachTeamName(perspective.opponentName),
      opponentCrestUrl: opponentCrest,
      homeCrestUrl: m.homeCrest ?? null,
      awayCrestUrl: m.awayCrest ?? null,
      pointsFor,
      pointsAgainst,
      venueType,
      venueName: m.venueName ?? null,
      attendance: matchExtras.get(m.id)?.attendance ?? (m.attendance && m.attendance > 0 ? m.attendance : null),
      manOfTheMatch:
        matchExtras.get(m.id)?.manOfTheMatch ??
        m.officialPotmName ??
        m.officialPotmPlayerName ??
        m.rugby365PotmName ??
        null,
    };
    }),
  );

  const recentMatches = dedupePublicMatches(recentMatchesRaw);
  const now = new Date();
  // Upcoming = next fixture for current team (not coach FK — FKs are for completed history).
  let upcomingMatch: PublicCoachProfile["upcomingMatch"] = null;
  if (currentRole?.teamId) {
    const upcomingTeamIds = await allRelatedTeamIds([currentRole.teamId]);
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
            inArray(fixtures.homeTeamId, upcomingTeamIds),
            inArray(fixtures.awayTeamId, upcomingTeamIds),
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
        homeTeamName: displayCoachTeamName(upcomingRow.homeTeamName),
        awayTeamName: displayCoachTeamName(upcomingRow.awayTeamName),
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
        homeTeamName: displayCoachTeamName(upcomingRow.homeTeamName),
        awayTeamName: displayCoachTeamName(upcomingRow.awayTeamName),
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

  if (teamDashboard) {
    const trophyStat = teamDashboard.keyStats.find((s) => s.label === "Trophies");
    if (trophyStat && (trophyStat.value === "0" || trophyStat.value === "—") && majorHonoursCount > 0) {
      trophyStat.value = String(majorHonoursCount);
      trophyStat.sub = "Recorded titles";
    }
  }

  if (publicMedals.length === 0 && honours.length > 0) {
    publicMedals = honours.slice(0, 18).map((h) => ({
      id: h.id,
      year: h.year,
      competitionName: h.competitionName ?? "Honour",
      resultLabel:
        h.achievementType === "winner" || h.achievementType === "champion"
          ? "Winner"
          : (h.achievementType || "Winner").replace(/_/g, " "),
      medalType:
        h.honourLevel === "major" ? "gold" : h.honourLevel === "domestic_major" ? "silver" : "none",
      roleType: h.roleType,
      roleGroup: h.roleType === "player" ? "player" : "coaching",
    }));
  }

  const appointedStart = detail.coach.appointedOn
    ? String(detail.coach.appointedOn).slice(0, 10)
    : null;
  const visibleAssignments = detail.assignments.filter((a) =>
    isPublicHistoryAssignment({
      recordStatus: a.recordStatus,
      verifiedAt: a.verifiedAt,
      isCurrent: a.isCurrent,
      showOnOverview: a.showOnOverview,
      startDate: a.startDate,
    }),
  );
  const publicAssignments = (visibleAssignments.length > 0 ? visibleAssignments : detail.assignments)
    .filter((a) => (a.recordStatus || "").toLowerCase() !== "conflict")
    .map((a) =>
      a.isCurrent && !a.startDate && appointedStart ? { ...a, startDate: appointedStart } : a,
    );
  const visiblePlaying = playingStints.filter((p) => {
    const status = ((p as { recordStatus?: string }).recordStatus || "").toLowerCase();
    if (status === "conflict") return false;
    return (
      Boolean(p.yearsLabel?.trim()) ||
      isPublicCareerRecord({
        recordStatus: (p as { recordStatus?: string }).recordStatus,
        verifiedAt: p.verifiedAt,
      })
    );
  });
  const publicPlayingStints = visiblePlaying.length > 0 ? visiblePlaying : playingStints;

  const overviewAssignments = publicAssignments.filter((a) => a.showOnOverview || a.isCurrent);
  const timelineSource =
    overviewAssignments.length > 0 ? overviewAssignments : publicAssignments.slice(0, 12);

  const crestByTeamId = new Map<string, string | null>();
  const teamIds = [
    ...new Set(
      [
        ...timelineSource.map((a) => a.teamId),
        ...publicAssignments.map((a) => a.teamId),
        ...publicPlayingStints.map((p) => p.teamId).filter(Boolean),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  await Promise.all(
    teamIds.map(async (teamId) => {
      crestByTeamId.set(teamId, await resolveTeamCrestImageUrl(teamId));
    }),
  );
  const crestByName = new Map<string, string | null>();
  const stintNames = [
    ...new Set(
      publicPlayingStints
        .map((s) => (s.teamDisplayName || s.teamName || "").trim())
        .filter((name) => name.length > 1),
    ),
  ];
  await Promise.all(
    stintNames.map(async (name) => {
      crestByName.set(name, await resolveTeamCrestByName(name));
    }),
  );
  const playingCrest = (s: (typeof publicPlayingStints)[number]) =>
    (s.teamId ? crestByTeamId.get(s.teamId) ?? null : null) ||
    crestByName.get((s.teamDisplayName || s.teamName || "").trim()) ||
    null;

  const timeline: PublicCoachProfile["timeline"] = timelineSource.map((a) => {
    const startY = a.startDate ? Number(a.startDate.slice(0, 4)) : 0;
    const endY = a.endDate ? Number(a.endDate.slice(0, 4)) : null;
    const yearsLabel =
      startY && a.isCurrent
        ? `${startY}–present`
        : startY && endY && startY === endY
          ? `${startY}`
          : startY && endY
            ? `${startY}–${endY}`
            : startY
              ? `${startY}`
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
        bioSummary: a.bioSummary,
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
      crestUrl: playingCrest(s),
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

  const assignmentRelated = await relatedTeamIdsBySource(
    publicAssignments.map((a) => a.teamId).filter((id): id is string => Boolean(id)),
  );
  const assignmentStats: PublicCoachProfile["assignmentStats"] = {};
  for (const a of publicAssignments) {
    const from = a.startDate ? Date.parse(`${a.startDate}T00:00:00.000Z`) : 0;
    const to = a.endDate ? Date.parse(`${a.endDate}T23:59:59.999Z`) : Date.now();
    const teamIds = new Set(
      (a.teamId ? assignmentRelated.get(a.teamId) : null) ?? (a.teamId ? [a.teamId] : []),
    );
    const slice = eligibleMatches.filter((m) => {
      if (teamIds.size > 0 && m.teamId && !teamIds.has(m.teamId)) return false;
      const t = m.kickoffAt?.getTime() ?? 0;
      return t >= from && t <= to;
    });
    const rec = computeCareerRecord(slice);
    assignmentStats[a.id] = {
      played: rec.played,
      wins: rec.wins,
      draws: rec.draws,
      losses: rec.losses,
      winRate: rec.winRate,
    };
  }

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
      crestUrl: playingCrest(s),
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
    teamDashboard,
    crestByTeamId: Object.fromEntries(crestByTeamId),
    assignmentStats,
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
