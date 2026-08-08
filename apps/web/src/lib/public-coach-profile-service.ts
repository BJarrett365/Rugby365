import { asc, desc, eq, or } from "drizzle-orm";
import {
  coachAwards,
  coachEducation,
  coachHonours,
  coachMedals,
  coachMilestones,
  coachPlayingStints,
  coachRatingHistory,
  coaches,
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
import { resolveTeamCrestImageUrl } from "./crest-library-service";
import { calculatePlayerAge } from "./player-profile-utils";

export type PublicCoachMatch = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  side: "home" | "away";
  result: "W" | "D" | "L" | null;
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
  playingStints: Array<typeof coachPlayingStints.$inferSelect>;
  education: Array<typeof coachEducation.$inferSelect>;
  honours: Array<typeof coachHonours.$inferSelect>;
  awards: Array<typeof coachAwards.$inferSelect>;
  medals: Array<typeof coachMedals.$inferSelect>;
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
  worldRankings: Awaited<ReturnType<typeof listCoachWorldRankings>>;
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
  const winners = honours.filter(
    (h) =>
      h.roleType === "coach" &&
      (h.achievementType === "winner" || h.achievementType === "champion") &&
      (h.honourLevel === "major" ||
        h.honourLevel === "domestic_major" ||
        h.honourLevel === "secondary" ||
        h.honourLevel === "series"),
  );

  const byComp = new Map<string, { label: string; count: number; level: string }>();
  let seriesCount = 0;
  for (const h of winners) {
    const label = (h.competitionName || "Honour").toUpperCase();
    if (h.honourLevel === "series" || h.honourLevel === "minor") {
      seriesCount += 1;
      continue;
    }
    if (h.honourLevel === "secondary" && byComp.size >= 4) {
      seriesCount += 1;
      continue;
    }
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
    .slice(0, 4)
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      honourLevel: v.level,
      kind: "honour" as const,
    }));

  if (seriesCount > 0 && grouped.length < 6) {
    grouped.push({
      key: "other-series",
      label: "OTHER SERIES & CUPS",
      count: seriesCount,
      honourLevel: "series",
      kind: "series",
    });
  }

  const majorAwards = awards.filter(
    (a) => a.result === "winner" && (a.isMajor || a.showOnOverview),
  );
  if (majorAwards.length > 0 && grouped.length < 6) {
    grouped.push({
      key: "major-awards",
      label: majorAwards.length === 1 ? "MAJOR INDIVIDUAL AWARD" : "MAJOR INDIVIDUAL AWARDS",
      count: majorAwards.length,
      honourLevel: "major",
      kind: "award",
    });
  }

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
    worldRankings,
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
    listCoachWorldRankings(5),
  ]);

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const matchRows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
      venueName: fixtures.venueName,
      homeCrest: homeTeams.imageUrl,
      awayCrest: awayTeams.imageUrl,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(or(eq(fixtures.homeCoachId, coachId), eq(fixtures.awayCoachId, coachId)))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(24);

  const completed = matchRows.filter((m) => {
    const s = (m.status || "").toLowerCase();
    return s.includes("complete") || s.includes("finish") || s === "result" || s === "ft";
  });

  const recentMatches: PublicCoachMatch[] = completed.slice(0, 8).map((m) => {
    const side: "home" | "away" = m.homeCoachId === coachId ? "home" : "away";
    const forScore = side === "home" ? m.homeScore : m.awayScore;
    const againstScore = side === "home" ? m.awayScore : m.homeScore;
    let result: "W" | "D" | "L" | null = null;
    if (forScore != null && againstScore != null) {
      result = forScore > againstScore ? "W" : forScore < againstScore ? "L" : "D";
    }
    return {
      id: m.id,
      slug: m.slug,
      kickoffAt: m.kickoffAt?.toISOString() ?? null,
      status: m.status,
      competitionName: m.competitionName,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
      side,
      result,
    };
  });

  const now = new Date();
  const upcomingRow = matchRows.find(
    (m) => m.kickoffAt && m.kickoffAt > now && !(m.status || "").toLowerCase().includes("complete"),
  );
  const upcomingMatch = upcomingRow
    ? {
        id: upcomingRow.id,
        slug: upcomingRow.slug,
        kickoffAt: upcomingRow.kickoffAt?.toISOString() ?? null,
        competitionName: upcomingRow.competitionName,
        homeTeamName: upcomingRow.homeTeamName,
        awayTeamName: upcomingRow.awayTeamName,
        homeTeamCrestUrl: upcomingRow.homeCrest ?? null,
        awayTeamCrestUrl: upcomingRow.awayCrest ?? null,
        venueName: upcomingRow.venueName ?? null,
      }
    : null;

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

  const overviewAssignments = detail.assignments.filter(
    (a) => (a as CoachingStaffRow & { showOnOverview?: boolean }).showOnOverview || a.isCurrent,
  );
  const timelineSource =
    overviewAssignments.length > 0 ? overviewAssignments : detail.assignments.slice(0, 12);

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
    return {
      id: a.id,
      year: startY || new Date().getFullYear(),
      yearsLabel,
      role: a.roleLabel,
      teamName: a.teamName,
      teamSlug: a.teamSlug,
      crestUrl: null,
      careerType: "coach",
      isCurrent: a.isCurrent,
    };
  });

  // prepend playing overview stints
  for (const s of playingStints.filter((p) => p.showOnOverview).slice(0, 4)) {
    timeline.unshift({
      id: s.id,
      year: s.startYear ?? 0,
      yearsLabel: s.yearsLabel,
      role: s.teamType === "international" ? "International Player" : "Player",
      teamName: s.teamName,
      teamSlug: null,
      crestUrl: null,
      careerType: "player",
      isCurrent: false,
    });
  }
  timeline.sort((a, b) => a.year - b.year);

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
    assignments: detail.assignments,
    currentRole,
    currentTeamCrestUrl,
    recentMatches,
    upcomingMatch,
    careerRecord,
    impact,
    ratings,
    playingStints,
    education,
    honours,
    awards,
    medals,
    milestones,
    majorHonoursGrouped: groupMajorHonours(honours, awards),
    careerSnapshot,
    ratingHistory: ratingHistoryRows.map((r) => ({
      date: r.calculatedAt.toISOString(),
      rating: r.rating,
      change: r.change,
    })),
    worldRankings,
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
