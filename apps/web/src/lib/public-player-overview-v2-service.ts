/**
 * Public read model for the Player Profile V2 Overview UI (/players/[slug]).
 *
 * Wraps `getPublicPlayerProfile` (identity, bio, value, scouting, rankings)
 * and enriches it with fly-half/position intelligence, rating history,
 * position usage, player-perspective recent/upcoming matches and
 * achievements — mirroring the coach public profile dashboard pattern.
 *
 * Never fabricates numbers: fields are null / empty when data is missing.
 */
import "server-only";

import { cache } from "react";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerExternalMatches,
  playerMatchPerformanceStats,
  playerMatchRatings,
  playerRatingHistory,
  playerRatings,
  playerTeamMemberships,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import { cachedPublic, PUBLIC_CACHE_TTL } from "./public-data-cache";
import {
  getPublicPlayerProfile,
  type PublicPlayerProfile,
  type PublicPlayerStatus,
} from "./public-player-profile-service";
import {
  buildPositionHistory,
  type PositionAppearanceInput,
  type PositionHistoryRow,
} from "./player-position-usage-service";
import {
  computePlayerPotential,
  type PotentialResult,
} from "./player-potential";
import { computePlayerProfileBadges, type PlayerProfileBadge } from "./player-badge-engine";
import {
  buildPublicAwardsFromAchievements,
  listEntityAchievements,
} from "./achievement-service";
import { listPublicPlayerTitles } from "./player-titles-service";
import { getPublicPlayerRankings } from "./public-player-rankings-service";
import {
  classifyOverallRating,
  evaluateValueHealth,
  presentValueFactor,
  resolveRatingPublicState,
  type PlayerRatingPublicState,
  type PlayerValueHealthStatus,
} from "./player-rating-presentation";
import type { MarketValueSnapshot, MarketValueTimelinePoint } from "./player-market-value-trend-utils";
import {
  classifyValueTrend90d,
  deriveLast24MonthsMarketValueTimeline,
  deriveMarketValue30dMovement,
  deriveMarketValue30dMovementAtDate,
} from "./player-market-value-trend-utils";
import { getValueHistory, getValueHistoryCareer } from "./player-value-history-service";
import {
  deriveCareerValueTimeline,
  type ValueTimelineSummary,
} from "./player-value-timeline-utils";
import {
  getLatestPlayerValueScore,
  storedToOverviewValueScore,
} from "./player-value-score-service";
import type {
  DemandClass,
  ValueScoreFactorContribution,
  ValueScoreStatus,
  ValueTrendClass,
} from "./player-value-score-engine";
import { type PlayerFormResult } from "./player-form-engine";
import { computePlayerFormForPlayer } from "./player-form-service";
import {
  getPlayerComparisonCard,
  type PlayerComparisonCardModel,
} from "./player-comparison-service";
import {
  getPlayerNextMatch,
  type PlayerNextMatchCard,
} from "./player-next-match-service";
import {
  getPlayerRecentMatches,
  type PlayerRecentMatchRow,
} from "./player-recent-matches-service";
import {
  FLY_HALF_WEIGHTS_V1,
  PLAYER_INTEL_LABELS,
  resolvePlayerPositionFamily,
  type PlayerIntelKey,
} from "./player-intelligence-engine";
import {
  buildRadarMetricValues,
  formatPeerAverageLabel,
  getPositionIntelligenceConfig,
  type RadarAxisKey,
  type RadarMetricValue,
} from "./player-intelligence-position-config";
import { buildOverallAbilitySeriesFromRows } from "./player-rating-history-service";
import type { RatingHistoryPoint, RatingHistorySummary } from "./player-rating-history-utils";
import { evaluatePlayerDataHealth, type PlayerHealthRow } from "./player-data-health";
import type { PlayerValueFactor } from "./player-value-math";

export type PlayerOverviewIntelligence = {
  overall: number | null;
  kicking: number | null;
  playmaking: number | null;
  gameManagement: number | null;
  attack: number | null;
  defence: number | null;
  physical: number | null;
  form: number | null;
  confidence: number | null;
  coverage: number | null;
  modelVersion: string | null;
  dataPoints: number;
};

export type PlayerOverviewRatingPoint = {
  date: string | null;
  overall: number;
  change: number | null;
  attack: number | null;
  defence: number | null;
  kicking: number | null;
  playmaking: number | null;
  gameManagement: number | null;
  physical: number | null;
  form: number | null;
  opponentName: string | null;
  competitionName: string | null;
  fixtureSlug: string | null;
  majorMatchLabel: string | null;
  /** live | backfilled | recalculated — how this snapshot was produced. */
  snapshotType: string;
  /**
   * `match_performance` rows are 0–10 single-match scores (often stored ×10 in `overall`
   * for historical/backfilled data) — never a career ability figure.
   * `overall_ability` rows are genuine 0–100 career-rating snapshots.
   */
  seriesKind: "match_performance" | "overall_ability";
  /** 0–10 match score for this point when available/derivable — chart should prefer this. */
  matchRating0to10: number | null;
};

export type PlayerRadarBenchmarkKey =
  | "attack"
  | "playmaking"
  | "kicking"
  | "gameManagement"
  | "defence"
  | "physical";

export type PlayerIntelligenceContribution = {
  key: PlayerIntelKey;
  label: string;
  score: number | null;
  weight: number;
  contribution: number | null;
};

/** Static soft benchmark used only when no other public fly-half rated players exist yet. */
const STATIC_FLY_HALF_BENCHMARK: Record<PlayerRadarBenchmarkKey, number> = {
  attack: 66,
  playmaking: 68,
  kicking: 70,
  gameManagement: 68,
  defence: 58,
  physical: 60,
};

export type PublicPlayerOverviewMatch = PlayerRecentMatchRow;

export type PublicPlayerOverviewUpcoming = {
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
};

export type PublicPlayerAchievement = {
  id: string;
  year: number | null;
  title: string;
  detail: string | null;
  /** Winner / Runner-up / etc when placing is known — never invented. */
  resultLabel: string | null;
  seasonLabel: string | null;
  /** verified/review/unverified come from the shared achievements table; title_record = CMS title, not honours-verified. */
  verificationStatus: "verified" | "review" | "unverified" | "title_record";
  iconKey: string | null;
};

/** Overview Key Achievements tiles — grouped by title + result for the mock trophy strip. */
export type PublicPlayerKeyAchievementTile = {
  id: string;
  title: string;
  yearsLabel: string;
  resultLabel: string | null;
  iconKey: string | null;
  verificationStatus: PublicPlayerAchievement["verificationStatus"];
};

export type PublicPlayerOverviewV2 = {
  slug: string;
  playerId: string;
  preview: boolean;

  name: string;
  displayName: string;
  knownAs: string | null;
  fullName: string | null;
  imageUrl: string | null;
  badgeImageUrl: string | null;

  positionName: string | null;
  otherPositions: string[];
  preferredFoot: string | null;
  age: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  heightCm: number | null;
  heightLabel: string | null;
  weightKg: number | null;
  nationName: string | null;
  nationCode: string | null;

  club: { name: string; slug: string | null; imageUrl: string | null; shortName?: string | null } | null;
  internationalTeam: {
    name: string;
    slug: string | null;
    imageUrl: string | null;
    shortName?: string | null;
  } | null;
  competitionName: string | null;

  status: PublicPlayerStatus;
  statusLabel: string;

  verifiedInternationalCaps: number | null;
  verifiedInternationalPoints: number | null;
  linkedInternationalCaps: number;

  contract: PublicPlayerProfile["contract"];
  agent: PublicPlayerProfile["agent"];

  rating: {
    /** Overall rating, 1 decimal place. */
    current: number | null;
    trend: number | null;
    trendLabel: string;
    lastFive: number[];
    /** 0–10 average of last recorded match ratings — used for the Recent Form strip. */
    formScore0to10: number | null;
  };
  intelligence: PlayerOverviewIntelligence;
  potential: PotentialResult;
  /** Trust-labelled rating state driving classification / value / rankings presentation. */
  ratingState: PlayerRatingPublicState;
  classification: { label: string; stars: number; provisionalNote: string | null };
  badges: PlayerProfileBadge[];
  valueScore: {
    score: number | null;
    confidence: number;
    coverage: number;
    status: ValueScoreStatus;
    modelVersion: string;
    valueTrend: ValueTrendClass;
    marketDemand: DemandClass;
    transferInterest: DemandClass;
    factors: ValueScoreFactorContribution[];
    calculatedAt: string | null;
  };
  valueOutlier: boolean;
  /** True when current club membership is verified or recent provider (e.g. RugbyPass) apps confirm it. */
  clubVerified: boolean;
  valueHealth: {
    status: PlayerValueHealthStatus;
    displayConfidence: number;
    reasons: string[];
    publicLabel: string;
  };
  marketValueTimeline24m: {
    state: "OK" | "LIMITED" | "INSUFFICIENT";
    points: Array<{
      dateIso: string;
      marketValueGbp: number;
      confidence: number;
      overallRating?: number | null;
      potentialRating?: number | null;
      clubName?: string | null;
      modelVersion?: string | null;
      snapshotType?: string | null;
      coverage?: number | null;
      changeSincePreviousPct?: number | null;
      change30dPct?: number | null;
    }>;
    rangeStartIso: string;
    rangeEndIso: string;
    pointCount: number;
    limitedHistory: boolean;
  };
  /** Career / long-term VALUE TIMELINE (distinct from 24m Value Trend). */
  valueTimeline: {
    displayPoints: MarketValueTimelinePoint[];
    rangeStartIso: string;
    rangeEndIso: string;
    summary: ValueTimelineSummary;
  };
  marketValueChange30d: {
    state: "OK" | "INSUFFICIENT";
    changePct: number | null;
    movementLabel: string | null;
  };
  /** Overall Rating 0–100 series for Rating History card. */
  ratingHistoryOverall: {
    series: RatingHistoryPoint[];
    summary: RatingHistorySummary;
  };
  /** Season periods for Performance Radar (Current Season + historic when available). */
  performanceRadarPeriods: Array<{
    id: string;
    label: string;
    metrics: RadarMetricValue[];
    peerScores: Partial<Record<RadarAxisKey, number | null>> | null;
    peerLabel: string | null;
    minRadarMetrics: number;
    modelNote: string | null;
  }>;
  valueFactorsPresented: Array<{
    key: string;
    label: string;
    pct: number | null;
    missing: boolean;
    display: string;
    note: string;
  }>;
  playerForm: PlayerFormResult;
  /** Average dimension scores for public fly-half peers (or a static soft benchmark) — null when not applicable. */
  radarBenchmark: Partial<Record<PlayerRadarBenchmarkKey, number>> | null;
  radarBenchmarkSource: "cohort" | "static" | null;
  intelligenceContributions: PlayerIntelligenceContribution[];

  playerValue: PublicPlayerProfile["playerValue"];
  scoutIntelligence: PublicPlayerProfile["scoutIntelligence"];
  scoutSummary: string | null;
  scoutStrengths: string[];
  scoutAreas: string[];
  scoutBestRole: string | null;
  /** True when scoutSummary was generated locally from intelligence dims rather than the AI scouting model. */
  scoutProvisional: boolean;

  /** Compact CMS health grades — mirrors the admin data-health endpoint. */
  cmsHealth: PlayerHealthRow[];

  rankings: PublicPlayerProfile["rankings"];
  comparePeer: {
    rank: number;
    slug: string;
    name: string;
    rating: number;
    imageUrl: string | null;
    isCurrent?: boolean;
  } | null;
  /** Profile V2 comparison widget (intelligence dims + selectable peer). */
  comparison: PlayerComparisonCardModel;
  /** Profile V2 next-match widget (confirmed squad → club → intl). */
  nextMatch: PlayerNextMatchCard;

  ratingHistory: PlayerOverviewRatingPoint[];
  positionHistory: ReturnType<typeof buildPositionHistory>;

  upcomingMatch: PublicPlayerOverviewUpcoming | null;
  recentMatches: PublicPlayerOverviewMatch[];

  achievements: PublicPlayerAchievement[];
  /** Top overview tiles (grouped years) for Key Achievements card. */
  keyAchievements: PublicPlayerKeyAchievementTile[];
  /** Best-effort latest data stamp for the footer disclaimer. */
  dataLastUpdatedIso: string | null;

  performanceRadar: PublicPlayerProfile["performanceRadar"];
  developmentTimeline: PublicPlayerProfile["developmentTimeline"];
  career: PublicPlayerProfile["career"];
  seasonSnapshot: PublicPlayerProfile["seasonSnapshot"];
  recentForm: PublicPlayerProfile["recentForm"];
  clubHistory: PublicPlayerProfile["clubHistory"];
  internationalHistory: PublicPlayerProfile["internationalHistory"];
  internationalSummary: PublicPlayerProfile["internationalSummary"];
  titles: PublicPlayerProfile["titles"];
  biography: PublicPlayerProfile["biography"];
  intro: PublicPlayerProfile["intro"];

  seo: PublicPlayerProfile["seo"];

  /** Full V1 read model — inner pages (stats/career/performance/intelligence/rating) can pull extra detail from here. */
  base: PublicPlayerProfile;
};

function heightLabel(cm: number | null | undefined): string | null {
  if (cm == null || cm <= 0) return null;
  const inchesTotal = cm / 2.54;
  const feet = Math.floor(inchesTotal / 12);
  const inches = Math.round(inchesTotal % 12);
  return `${(cm / 100).toFixed(2)}m (${feet}'${inches}")`;
}

/** Prefer knownAs + surname over full legal name, mirroring the coach profile convention. */
function formatDisplayName(name: string, knownAs: string | null, fullName: string | null): string {
  const aka = knownAs?.trim();
  if (aka) {
    const last = fullName?.trim().split(/\s+/).filter(Boolean).at(-1);
    if (last && !aka.toLowerCase().includes(last.toLowerCase())) {
      return `${aka} ${last}`;
    }
    if (aka.split(/\s+/).length >= 2) return aka;
  }
  return name;
}

function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Current club membership verified, or recent provider (RugbyPass) appearances confirm it. */
async function resolveClubVerified(
  db: ReturnType<typeof getDb>,
  playerId: string,
  clubTeamId: string | null,
): Promise<boolean> {
  if (!clubTeamId) return false;

  const [membership] = await db
    .select({
      verifiedAt: playerTeamMemberships.verifiedAt,
      sourceProvider: playerTeamMemberships.sourceProvider,
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
  if (membership && (membership.verifiedAt != null || membership.sourceProvider === "rugbypass")) {
    return true;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 15);
  const [recentExternal] = await db
    .select({ id: playerExternalMatches.id })
    .from(playerExternalMatches)
    .where(
      and(
        eq(playerExternalMatches.playerId, playerId),
        eq(playerExternalMatches.sourceProvider, "rugbypass"),
        gte(playerExternalMatches.kickoffAt, cutoff),
      ),
    )
    .limit(1);
  return Boolean(recentExternal);
}

/** Average dimension scores for other public/published fly-half rated players. */
async function resolveFlyHalfRadarBenchmark(
  db: ReturnType<typeof getDb>,
  excludePlayerId: string,
): Promise<Partial<Record<PlayerRadarBenchmarkKey, number>> | null> {
  const rows = await db
    .select({
      attack: playerRatings.attackRating,
      kicking: playerRatings.kickingRating,
      playmaking: playerRatings.playmakingRating,
      gameManagement: playerRatings.gameManagementRating,
      defence: playerRatings.defenceRating,
      physical: playerRatings.physicalRating,
    })
    .from(playerRatings)
    .innerJoin(players, eq(players.id, playerRatings.playerId))
    .where(
      and(
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
        sql`lower(coalesce(${players.positionName}, '')) like '%fly%'`,
        sql`${playerRatings.playerId} != ${excludePlayerId}`,
      ),
    );
  if (!rows.length) return null;

  const avgOf = (key: PlayerRadarBenchmarkKey) =>
    round1(average(rows.map((r) => r[key]).filter((n): n is number => n != null)));
  const result: Partial<Record<PlayerRadarBenchmarkKey, number>> = {};
  (["attack", "playmaking", "kicking", "gameManagement", "defence", "physical"] as const).forEach(
    (key) => {
      const v = avgOf(key);
      if (v != null) result[key] = v;
    },
  );
  return Object.keys(result).length > 0 ? result : null;
}

const SCOUT_DIM_LABELS: Array<{ key: keyof PlayerOverviewIntelligence; label: string }> = [
  { key: "kicking", label: "kicking" },
  { key: "gameManagement", label: "game management" },
  { key: "playmaking", label: "playmaking" },
  { key: "attack", label: "attacking threat" },
  { key: "defence", label: "defensive work-rate" },
  { key: "physical", label: "physical presence" },
];

function buildScoutInsights(intelligence: PlayerOverviewIntelligence): {
  strengths: string[];
  areas: string[];
} {
  const rated = SCOUT_DIM_LABELS.map((d) => ({ ...d, score: intelligence[d.key] as number | null }))
    .filter((d): d is { key: keyof PlayerOverviewIntelligence; label: string; score: number } =>
      d.score != null,
    );
  const strengths = [...rated]
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score >= 60)
    .slice(0, 3)
    .map((d) => d.label);
  const areas = [...rated]
    .sort((a, b) => a.score - b.score)
    .filter((d) => d.score < 60)
    .slice(0, 2)
    .map((d) => d.label);
  return { strengths, areas };
}

/** Never claims "world-class" below a genuinely elite (80+) overall rating. */
function generateProvisionalScoutSummary(input: {
  overall: number | null;
  positionName: string | null;
  strengths: string[];
  areas: string[];
}): string {
  const roleLabel = input.positionName?.trim() || "player";
  const tier =
    input.overall == null
      ? "an unrated"
      : input.overall >= 80
        ? "an elite, international-class"
        : input.overall >= 70
          ? "a strong, top-level"
          : input.overall >= 60
            ? "a solid, professional-level"
            : "a developing";
  const strengthsText = input.strengths.length
    ? `Standout areas on current data are ${input.strengths.join(", ")}.`
    : "No standout areas are confirmed yet from the data on file.";
  const areasText = input.areas.length
    ? ` Areas needing more data or development: ${input.areas.join(", ")}.`
    : "";
  return `Provisional read based on current data coverage: this looks like ${tier} ${roleLabel} profile. ${strengthsText}${areasText}`;
}

function placingToResultLabel(placing: string | null | undefined): string | null {
  const p = (placing ?? "").toUpperCase();
  if (!p || p === "OTHER") return null;
  if (p === "WINNER" || p === "CHAMPION") return "Winner";
  if (p === "RUNNER_UP") return "Runner-up";
  if (p === "THIRD_PLACE") return "Third Place";
  if (p === "SEMI_FINALIST") return "Semi-finalist";
  if (p === "FINALIST") return "Finalist";
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function defaultIconKeyForAchievement(input: {
  placing: string | null;
  honourLevel: string | null;
  competitionName: string | null;
  title: string;
}): string {
  const placing = (input.placing ?? "").toUpperCase();
  if (placing === "RUNNER_UP" || placing === "FINALIST") return "runner_up";
  if (placing === "THIRD_PLACE") return "third_place";
  const hay = `${input.competitionName ?? ""} ${input.title}`.toLowerCase();
  if (hay.includes("world cup") || hay.includes("lions") || (input.honourLevel ?? "").toUpperCase() === "MAJOR") {
    return "trophy_major";
  }
  return "trophy_domestic";
}

/** Group flat achievements into overview trophy tiles (same title + result → combined years). */
function buildKeyAchievementTiles(
  achievements: PublicPlayerAchievement[],
  limit = 4,
): PublicPlayerKeyAchievementTile[] {
  type Acc = {
    id: string;
    title: string;
    resultLabel: string | null;
    iconKey: string | null;
    verificationStatus: PublicPlayerAchievement["verificationStatus"];
    years: number[];
    seasonLabels: string[];
    sortYear: number;
  };
  const groups = new Map<string, Acc>();

  for (const a of achievements) {
    const key = `${a.title.trim().toLowerCase()}::${(a.resultLabel ?? "").toLowerCase()}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: a.id,
        title: a.title,
        resultLabel: a.resultLabel,
        iconKey: a.iconKey,
        verificationStatus: a.verificationStatus,
        years: a.year != null ? [a.year] : [],
        seasonLabels: a.seasonLabel ? [a.seasonLabel] : [],
        sortYear: a.year ?? 0,
      });
      continue;
    }
    if (a.year != null && !existing.years.includes(a.year)) existing.years.push(a.year);
    if (a.seasonLabel && !existing.seasonLabels.includes(a.seasonLabel)) {
      existing.seasonLabels.push(a.seasonLabel);
    }
    existing.sortYear = Math.max(existing.sortYear, a.year ?? 0);
    // Prefer verified status when merging.
    const rank = (v: PublicPlayerAchievement["verificationStatus"]) =>
      v === "verified" ? 0 : v === "review" ? 1 : v === "title_record" ? 2 : 3;
    if (rank(a.verificationStatus) < rank(existing.verificationStatus)) {
      existing.verificationStatus = a.verificationStatus;
    }
    if (!existing.iconKey && a.iconKey) existing.iconKey = a.iconKey;
  }

  return [...groups.values()]
    .sort((a, b) => {
      const rank = (v: PublicPlayerAchievement["verificationStatus"]) =>
        v === "verified" ? 0 : v === "review" ? 1 : v === "title_record" ? 2 : 3;
      return rank(a.verificationStatus) - rank(b.verificationStatus) || b.sortYear - a.sortYear;
    })
    .slice(0, limit)
    .map((g) => {
      const yearsSorted = [...g.years].sort((x, y) => x - y);
      const yearsLabel =
        g.seasonLabels.length > 0 && yearsSorted.length === 0
          ? g.seasonLabels.join(", ")
          : yearsSorted.length > 0
            ? yearsSorted.join(", ")
            : g.seasonLabels[0] ?? "—";
      return {
        id: g.id,
        title: g.title,
        yearsLabel,
        resultLabel: g.resultLabel,
        iconKey: g.iconKey,
        verificationStatus: g.verificationStatus,
      };
    });
}

function formatBestRole(positionName: string | null, jerseyNumber: number | null): string | null {
  const name = positionName?.trim();
  if (!name) return null;
  if (jerseyNumber != null && jerseyNumber > 0) return `${name} (${jerseyNumber})`;
  return name;
}

function maxIsoDate(candidates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const c of candidates) {
    if (!c) continue;
    const ms = Date.parse(c);
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = c;
    }
  }
  return best;
}

const INTEL_CONTRIBUTION_KEY_MAP: Record<PlayerIntelKey, keyof PlayerOverviewIntelligence> = {
  kicking: "kicking",
  game_management: "gameManagement",
  playmaking: "playmaking",
  attack: "attack",
  defence: "defence",
  physical: "physical",
  current_form: "form",
};

/** Recomputes present-only-renormalised contributions from FLY_HALF_WEIGHTS_V1 × stored dimension scores. */
function buildIntelligenceContributions(
  intelligence: PlayerOverviewIntelligence,
): PlayerIntelligenceContribution[] {
  const keys = Object.keys(FLY_HALF_WEIGHTS_V1) as PlayerIntelKey[];
  const entries = keys.map((key) => ({
    key,
    label: PLAYER_INTEL_LABELS[key],
    score: (intelligence[INTEL_CONTRIBUTION_KEY_MAP[key]] as number | null) ?? null,
    nominalWeight: FLY_HALF_WEIGHTS_V1[key],
  }));
  const present = entries.filter((e) => e.score != null);
  const presentWeight = present.reduce((s, e) => s + e.nominalWeight, 0);

  return entries.map((e) => {
    const weight =
      e.score == null || presentWeight <= 0
        ? 0
        : Math.round((e.nominalWeight / presentWeight) * 1000) / 10;
    const contribution =
      e.score != null && weight > 0 ? Math.round(((e.score * weight) / 100) * 10) / 10 : null;
    return { key: e.key, label: e.label, score: e.score, weight, contribution };
  });
}

async function loadPublicPlayerOverviewV2(
  slug: string,
  options: { preview?: boolean; compareSlug?: string | null } = {},
): Promise<PublicPlayerOverviewV2 | null> {
  const preview = Boolean(options.preview);
  const profile = await getPublicPlayerProfile(slug, { preview });
  if (!profile) return null;

  const db = getDb();
  const [playerRow] = await db.select().from(players).where(eq(players.slug, profile.slug)).limit(1);
  if (!playerRow) return null;

  const playerId = playerRow.id;
  const clubTeamId = playerRow.clubTeamId;
  const internationalTeamId = playerRow.internationalTeamId;

  const [ratingRow, ratingHistoryRows, fixturePlayerRows] = await Promise.all([
    db.select().from(playerRatings).where(eq(playerRatings.playerId, playerId)).limit(1).then((r) => r[0] ?? null),
    db
      .select()
      .from(playerRatingHistory)
      .where(eq(playerRatingHistory.playerId, playerId))
      .orderBy(asc(playerRatingHistory.matchDate))
      .limit(60),
    db.select().from(fixturePlayers).where(eq(fixturePlayers.playerId, playerId)),
  ]);

  // ── Market value history for LAST 24 MONTHS + 30-day movement (persisted snapshots only) ──
  const now = new Date();
  const [valueHistoryRows, careerValueHistoryRows] = await Promise.all([
    getValueHistory(playerId, 24),
    getValueHistoryCareer(playerId),
  ]);

  const valueSnapshots: MarketValueSnapshot[] = valueHistoryRows.map((r) => ({
    snapshotAt: r.snapshotDate,
    marketValueGbp: r.estimatedValue,
    confidence: r.confidence,
    overallRating: r.overallRating,
    potentialRating: r.potentialRating,
    clubName: r.clubName,
    modelVersion: r.modelVersion,
    snapshotType: r.snapshotType,
    coverage: r.coverage,
  }));

  const careerValueSnapshots: MarketValueSnapshot[] = careerValueHistoryRows.map((r) => ({
    snapshotAt: r.snapshotDate,
    marketValueGbp: r.estimatedValue,
    confidence: r.confidence,
    overallRating: r.overallRating,
    potentialRating: r.potentialRating,
    clubName: r.clubName,
    modelVersion: r.modelVersion,
    snapshotType: r.snapshotType,
    coverage: r.coverage,
  }));

  const marketValueTimeline24mRaw = deriveLast24MonthsMarketValueTimeline({
    snapshots: valueSnapshots,
    now,
  });

  const marketValueTimeline24m = {
    ...marketValueTimeline24mRaw,
    points: marketValueTimeline24mRaw.points.map((p) => ({
      ...p,
      change30dPct: deriveMarketValue30dMovementAtDate({
        snapshots: valueSnapshots,
        anchor: new Date(p.dateIso),
        toleranceDays: 15,
      }),
    })),
  };

  const careerTimeline = deriveCareerValueTimeline({
    snapshots: careerValueSnapshots,
    now,
  });
  const valueTimeline = {
    displayPoints: careerTimeline.displayPoints,
    rangeStartIso: careerTimeline.rangeStartIso,
    rangeEndIso: careerTimeline.rangeEndIso,
    summary: careerTimeline.summary,
  };

  const marketValueChange30d = deriveMarketValue30dMovement({
    snapshots: valueSnapshots,
    now,
    toleranceDays: 15,
  });

  const valueTrend90d = classifyValueTrend90d({
    snapshots: valueSnapshots,
    now,
    toleranceDays: 15,
  });

  // ── Position usage (club vs international; minutes from performance / ratings) ──
  const positionFixtureIds = [...new Set(fixturePlayerRows.map((r) => r.fixtureId))];
  const [positionPerfRows, positionRatingRows, positionKickoffRows] = positionFixtureIds.length
    ? await Promise.all([
        db
          .select({
            fixtureId: playerMatchPerformanceStats.fixtureId,
            minutesPlayed: playerMatchPerformanceStats.minutesPlayed,
          })
          .from(playerMatchPerformanceStats)
          .where(
            and(
              eq(playerMatchPerformanceStats.playerId, playerId),
              inArray(playerMatchPerformanceStats.fixtureId, positionFixtureIds),
            ),
          ),
        db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            minutesPlayed: playerMatchRatings.minutesPlayed,
            rating: playerMatchRatings.rating,
          })
          .from(playerMatchRatings)
          .where(
            and(
              eq(playerMatchRatings.playerId, playerId),
              inArray(playerMatchRatings.fixtureId, positionFixtureIds),
            ),
          ),
        db
          .select({ id: fixtures.id, kickoffAt: fixtures.kickoffAt })
          .from(fixtures)
          .where(inArray(fixtures.id, positionFixtureIds)),
      ])
    : [[], [], []];

  const minutesByFixture = new Map<string, number>();
  for (const r of positionPerfRows) {
    if (r.minutesPlayed > 0) minutesByFixture.set(r.fixtureId, r.minutesPlayed);
  }
  for (const r of positionRatingRows) {
    if (!minutesByFixture.has(r.fixtureId) && r.minutesPlayed > 0) {
      minutesByFixture.set(r.fixtureId, r.minutesPlayed);
    }
  }
  const ratingByFixture = new Map(
    positionRatingRows
      .filter((r) => r.rating != null)
      .map((r) => [r.fixtureId, r.rating as number]),
  );
  const kickoffByFixture = new Map(
    positionKickoffRows.map((r) => [
      r.id,
      r.kickoffAt ? r.kickoffAt.toISOString() : null,
    ]),
  );

  const positionRows: PositionAppearanceInput[] = fixturePlayerRows.map((r) => ({
    positionName: r.positionName,
    jerseyNumber: r.jerseyNumber,
    squadRole: r.squadRole,
    scope: internationalTeamId && r.teamId === internationalTeamId ? "international" : "club",
    minutesPlayed: minutesByFixture.get(r.fixtureId) ?? null,
    matchRating: ratingByFixture.get(r.fixtureId) ?? null,
    kickoffAt: kickoffByFixture.get(r.fixtureId) ?? null,
  }));
  const positionHistory = buildPositionHistory(positionRows, {
    playerId,
    displayName: profile.name,
    slug: profile.slug,
    verifiedCareerApps: playerRow.verifiedInternationalCaps,
  });
  const linkedInternationalCaps = internationalTeamId
    ? fixturePlayerRows.filter((r) => r.teamId === internationalTeamId).length
    : 0;

  // ── Rating history for the profile chart — enrich with 0–10 match ratings where linked ──
  const historyFixtureIds = [
    ...new Set(ratingHistoryRows.map((r) => r.fixtureId).filter((id): id is string => Boolean(id))),
  ];
  const historyMatchRatingRows = historyFixtureIds.length
    ? await db
        .select({ fixtureId: playerMatchRatings.fixtureId, rating: playerMatchRatings.rating })
        .from(playerMatchRatings)
        .where(
          and(
            eq(playerMatchRatings.playerId, playerId),
            inArray(playerMatchRatings.fixtureId, historyFixtureIds),
          ),
        )
    : [];
  const matchRatingByFixture = new Map(historyMatchRatingRows.map((r) => [r.fixtureId, r.rating]));

  const ratingHistory: PlayerOverviewRatingPoint[] = ratingHistoryRows.map((r) => {
    const snapshotType = (r.snapshotType ?? "").toLowerCase();
    // Overall ability is 0–100. Legacy/backfilled match scores sometimes sit on 0–10.
    const looksLikeMatchScore = r.overallRating > 0 && r.overallRating <= 10;
    const seriesKind: "match_performance" | "overall_ability" = looksLikeMatchScore
      ? "match_performance"
      : "overall_ability";
    const joinedRating = r.fixtureId ? (matchRatingByFixture.get(r.fixtureId) ?? null) : null;
    const matchRating0to10 =
      joinedRating != null
        ? round1(joinedRating)
        : seriesKind === "match_performance"
          ? round1(r.overallRating)
          : null;
    return {
      date: r.matchDate ? r.matchDate.toISOString() : r.calculatedAt.toISOString(),
      overall: r.overallRating,
      change: r.ratingChange,
      attack: r.attack,
      defence: r.defence,
      kicking: r.kicking,
      playmaking: r.playmaking,
      gameManagement: r.gameManagement,
      physical: r.physical,
      form: r.form,
      opponentName: r.opponentName,
      competitionName: r.competitionName,
      fixtureSlug: r.fixtureSlug,
      majorMatchLabel: r.majorMatchLabel,
      snapshotType,
      seriesKind,
      matchRating0to10,
    };
  });

  // ── Recent Matches (eligible completed appearances) + Next Match ──
  // Same fixture_players spine as Recent Form; unused bench excluded in service.
  const recentMatches = await getPlayerRecentMatches(playerId, { limit: 10 });

  const { card: nextMatch, audit: nextMatchAudit } = await getPlayerNextMatch({
    playerId,
    clubTeamId,
    internationalTeamId,
    now,
  });
  const upcomingMatch: PublicPlayerOverviewUpcoming | null = nextMatch.id
    ? {
        id: nextMatch.id,
        slug: nextMatch.slug,
        href: nextMatch.href,
        kickoffAt: nextMatch.kickoffAt,
        competitionName: nextMatch.competitionName,
        homeTeamName: nextMatch.homeTeamName,
        awayTeamName: nextMatch.awayTeamName,
        homeTeamCrestUrl: nextMatch.homeTeamCrestUrl,
        awayTeamCrestUrl: nextMatch.awayTeamCrestUrl,
        venueName: nextMatch.venueName,
      }
    : null;
  void nextMatchAudit;

  // ── Intelligence / potential / classification / badges / value score ──
  const overall = round1(ratingRow?.playerRating ?? null);
  const intelligence: PlayerOverviewIntelligence = {
    overall,
    kicking: round1(ratingRow?.kickingRating ?? null),
    playmaking: round1(ratingRow?.playmakingRating ?? null),
    gameManagement: round1(ratingRow?.gameManagementRating ?? null),
    attack: round1(ratingRow?.attackRating ?? null),
    defence: round1(ratingRow?.defenceRating ?? null),
    physical: round1(ratingRow?.physicalRating ?? null),
    form: round1(ratingRow?.formScore ?? null),
    confidence: ratingRow?.intelligenceConfidence ?? null,
    coverage: ratingRow?.intelligenceCoverage ?? null,
    modelVersion: ratingRow?.modelVersion ?? null,
    dataPoints: ratingRow?.dataPoints ?? 0,
  };

  const potential = computePlayerPotential({
    overallRating: ratingRow?.playerRating ?? null,
    age: profile.age,
    verifiedCaps: playerRow.verifiedInternationalCaps,
    careerHigh: ratingRow?.careerHigh ?? null,
  });

  // ── Trust-labelled rating state drives classification, value health and rankings tone ──
  const ratingState = resolveRatingPublicState({
    overall: overall,
    confidence: intelligence.confidence,
    coverage: intelligence.coverage,
    dataPoints: intelligence.dataPoints,
    modelVersion: intelligence.modelVersion,
  });
  const classification = classifyOverallRating(overall, ratingState);

  const mediaCheck = profile.playerValue
    ? ((profile.playerValue as unknown as { mediaCheck?: { warnings?: string[]; summary?: string } })
        .mediaCheck ?? null)
    : null;
  const mediaWarnings = [
    ...(mediaCheck?.warnings ?? []),
    ...(mediaCheck?.summary ? [mediaCheck.summary] : []),
  ];
  // Also apply the same heuristic as player-value-service (do not auto-correct value).
  const heuristicOutlier =
    (playerRow.verifiedInternationalCaps ?? 0) >= 50 &&
    Boolean(playerRow.clubTeamId) &&
    Boolean(playerRow.internationalTeamId) &&
    (ratingRow?.playerRating ?? 0) >= 55 &&
    (profile.playerValue?.marketValueGbp ?? 0) > 0 &&
    (profile.playerValue?.marketValueGbp ?? 0) < 250_000;
  const valueOutlier =
    heuristicOutlier || mediaWarnings.some((w) => w.toLowerCase().includes("outlier"));

  const badges = computePlayerProfileBadges({
    overallRating: ratingRow?.playerRating ?? null,
    kicking: ratingRow?.kickingRating ?? null,
    gameManagement: ratingRow?.gameManagementRating ?? null,
    formScore: ratingRow?.formScore ?? null,
    age: profile.age,
    verifiedInternationalCaps: playerRow.verifiedInternationalCaps,
    marketValueGbp: profile.playerValue?.marketValueGbp ?? null,
    valueOutlier,
  });

  // Value Score: read persisted row only — never recalculate on page load.
  const storedValueScore = await getLatestPlayerValueScore(playerId);
  const valueScore = storedToOverviewValueScore(storedValueScore);
  // Prefer live 90d classification from history for the display row when stored is empty.
  if (!valueScore.valueTrend && valueTrend90d.trend) {
    valueScore.valueTrend = valueTrend90d.trend;
  }

  const rawFormAvg = average(profile.rating.lastFive);
  const formScore0to10 =
    rawFormAvg == null ? null : rawFormAvg > 10 ? Math.round((rawFormAvg / 10) * 10) / 10 : rawFormAvg;

  // ── Club verification, value health, player form, radar benchmark, scout, intelligence contributions ──
  const clubVerified = await resolveClubVerified(db, playerId, clubTeamId);

  const valueHealth = evaluateValueHealth({
    marketValueGbp: profile.playerValue?.marketValueGbp ?? null,
    modelConfidence: profile.playerValue?.confidence ?? null,
    ratingState,
    contractKnown: Boolean(profile.contract.expiresOn),
    clubVerified,
    ageKnown: profile.age != null,
    verifiedCaps: playerRow.verifiedInternationalCaps,
    outlierHeuristic: valueOutlier,
  });

  const valueFactorsPresented = (profile.playerValue?.factors ?? []).map((f: PlayerValueFactor) =>
    presentValueFactor({ key: f.key, label: f.label, pct: f.pct, note: f.note }),
  );

  const playerForm = await computePlayerFormForPlayer({
    playerId,
    positionName: profile.positionName,
    limit: 10,
  });

  const positionFamily = resolvePlayerPositionFamily(profile.positionName);
  const cohortRadarBenchmark =
    positionFamily === "fly_half" ? await resolveFlyHalfRadarBenchmark(db, playerId) : null;
  // Cohort averages often miss playmaking / kicking dims — need ≥3 spokes to draw peer hexagon.
  const cohortFilled =
    cohortRadarBenchmark == null
      ? 0
      : (["attack", "playmaking", "kicking", "gameManagement", "defence", "physical"] as const).filter(
          (k) => cohortRadarBenchmark[k] != null && Number.isFinite(cohortRadarBenchmark[k]),
        ).length;
  const radarBenchmark =
    cohortFilled >= 3
      ? cohortRadarBenchmark
      : positionFamily === "fly_half"
        ? STATIC_FLY_HALF_BENCHMARK
        : null;
  const radarBenchmarkSource: "cohort" | "static" | null =
    cohortFilled >= 3 ? "cohort" : radarBenchmark != null ? "static" : null;

  const intelligenceContributions = buildIntelligenceContributions(intelligence);

  // ── Overall ability rating history series (0–100) for Rating History card ──
  const ratingHistoryOverall = buildOverallAbilitySeriesFromRows(ratingHistoryRows);

  // ── Performance Radar periods (Current Season from live intelligence; historic years when dims exist) ──
  const positionConfig = getPositionIntelligenceConfig(profile.positionName);
  const currentRadarScores: Partial<Record<RadarAxisKey, number | null>> = {
    attack: intelligence.attack,
    playmaking: intelligence.playmaking,
    kicking: intelligence.kicking,
    gameManagement: intelligence.gameManagement,
    defence: intelligence.defence,
    physical: intelligence.physical,
  };
  const currentMetrics = buildRadarMetricValues({
    axes: positionConfig.radarAxes,
    playerScores: currentRadarScores,
  });
  const peerLabel = formatPeerAverageLabel({
    peerLabel: positionConfig.peerLabel,
    competitionName: profile.competitionName,
    source: radarBenchmarkSource === "cohort" ? "cohort" : radarBenchmarkSource === "static" ? "static" : null,
  });
  const peerScores: Partial<Record<RadarAxisKey, number | null>> | null = radarBenchmark
    ? {
        attack: radarBenchmark.attack ?? null,
        playmaking: radarBenchmark.playmaking ?? null,
        kicking: radarBenchmark.kicking ?? null,
        gameManagement: radarBenchmark.gameManagement ?? null,
        defence: radarBenchmark.defence ?? null,
        physical: radarBenchmark.physical ?? null,
      }
    : null;

  const performanceRadarPeriods: PublicPlayerOverviewV2["performanceRadarPeriods"] = [
    {
      id: "current",
      label: "Current Season",
      metrics: currentMetrics,
      peerScores,
      peerLabel: peerScores ? peerLabel : null,
      minRadarMetrics: positionConfig.minRadarMetrics,
      modelNote: [
        intelligence.modelVersion ?? positionConfig.modelVersion,
        intelligence.confidence != null ? `confidence ${intelligence.confidence}%` : null,
        intelligence.coverage != null ? `coverage ${intelligence.coverage}%` : null,
        intelligence.dataPoints > 0 ? `${intelligence.dataPoints} matches sampled` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  // Historic calendar-year periods from rating history dims (honest empty when thin).
  const years = new Set<number>();
  for (const r of ratingHistoryRows) {
    const d = r.matchDate ?? r.calculatedAt;
    if (d) years.add(d.getUTCFullYear());
  }
  const currentYear = now.getUTCFullYear();
  for (const year of [...years].sort((a, b) => b - a)) {
    if (year === currentYear) continue;
    const yearRows = ratingHistoryRows.filter((r) => {
      const d = r.matchDate ?? r.calculatedAt;
      return d && d.getUTCFullYear() === year;
    });
    const avgDim = (pick: (r: (typeof yearRows)[number]) => number | null) => {
      const vals = yearRows.map(pick).filter((n): n is number => n != null && Number.isFinite(n));
      if (!vals.length) return null;
      return round1(vals.reduce((s, n) => s + n, 0) / vals.length);
    };
    const yearScores: Partial<Record<RadarAxisKey, number | null>> = {
      attack: avgDim((r) => r.attack),
      playmaking: avgDim((r) => r.playmaking),
      kicking: avgDim((r) => r.kicking),
      gameManagement: avgDim((r) => r.gameManagement),
      defence: avgDim((r) => r.defence),
      physical: avgDim((r) => r.physical),
    };
    const yearMetrics = buildRadarMetricValues({
      axes: positionConfig.radarAxes,
      playerScores: yearScores,
    });
    // Skip clone periods when historic dims were stamped from current (identical profile).
    const differsFromCurrent = yearMetrics.some((m) => {
      const cur = currentMetrics.find((c) => c.key === m.key)?.score ?? null;
      if (m.score == null && cur == null) return false;
      if (m.score == null || cur == null) return true;
      return Math.abs(m.score - cur) >= 1;
    });
    if (!differsFromCurrent) continue;

    performanceRadarPeriods.push({
      id: `year-${year}`,
      label: String(year),
      metrics: yearMetrics,
      peerScores: null,
      peerLabel: null,
      minRadarMetrics: positionConfig.minRadarMetrics,
      modelNote: `Season ${year} · from stored rating history`,
    });
  }

  const { strengths: scoutStrengths, areas: scoutAreas } = buildScoutInsights(intelligence);
  const primaryUsage = positionHistory.usage.positions[0] ?? null;
  const scoutBestRole = formatBestRole(
    profile.positionName,
    primaryUsage?.number ?? null,
  );
  const aiSummary = profile.scoutIntelligence?.aiSummary?.trim() || null;
  const scoutProvisional = aiSummary == null;
  const scoutSummary =
    aiSummary ??
    (intelligence.overall != null || scoutStrengths.length > 0 || scoutAreas.length > 0
      ? generateProvisionalScoutSummary({
          overall: intelligence.overall,
          positionName: profile.positionName,
          strengths: scoutStrengths,
          areas: scoutAreas,
        })
      : null);

  // ── Achievements — real verification status only, never invented as verified ──
  let achievements: PublicPlayerAchievement[] = [];
  try {
    const rows = await listEntityAchievements("player", playerId, { publicOnly: true });
    if (rows.length > 0) {
      const awards = buildPublicAwardsFromAchievements(rows);
      const awardIds = new Set(awards.map((a) => a.id));
      achievements = rows
        .filter(
          (r) =>
            awardIds.has(r.achievement.id) ||
            r.achievement.achievementType === "TEAM_HONOUR" ||
            (r.achievement.achievementType === "PERSONAL_AWARD" &&
              r.achievement.visibility === "public" &&
              (r.achievement.notes ?? "").toLowerCase().includes("nominee")),
        )
        .map((r) => {
          const title =
            r.achievement.titleOverride?.trim() ||
            r.award?.name ||
            r.achievement.competitionName ||
            "Achievement";
          const placing = r.achievement.placing ?? null;
          const resultLabel = placingToResultLabel(placing);
          const iconKey =
            r.achievement.iconKey ??
            r.award?.iconKey ??
            defaultIconKeyForAchievement({
              placing,
              honourLevel: r.achievement.honourLevel ?? null,
              competitionName: r.achievement.competitionName ?? null,
              title,
            });
          return {
            id: r.achievement.id,
            year: r.achievement.year,
            title,
            detail:
              [
                resultLabel && resultLabel !== "Winner" ? resultLabel : null,
                r.achievement.notes?.trim() || null,
                r.achievement.seasonLabel,
                r.achievement.teamName,
              ]
                .filter(Boolean)
                .join(" · ") || null,
            resultLabel,
            seasonLabel: r.achievement.seasonLabel ?? null,
            verificationStatus:
              (r.achievement.verificationStatus as PublicPlayerAchievement["verificationStatus"]) ??
              "unverified",
            iconKey,
          };
        });
    }
  } catch {
    /* achievements table may not exist yet */
  }

  if (achievements.length === 0) {
    const titles = await listPublicPlayerTitles(playerId);
    achievements = titles.map((t) => ({
      id: t.id,
      year: t.year,
      title: t.title,
      detail: [t.titleType.replace(/_/g, " "), t.seasonLabel].filter(Boolean).join(" · ") || null,
      resultLabel: null,
      seasonLabel: t.seasonLabel ?? null,
      verificationStatus: "title_record" as const,
      iconKey: defaultIconKeyForAchievement({
        placing: null,
        honourLevel: null,
        competitionName: t.title,
        title: t.title,
      }),
    }));
  }
  achievements.sort((a, b) => {
    const rank = (v: PublicPlayerAchievement["verificationStatus"]) =>
      v === "verified" ? 0 : v === "review" ? 1 : v === "title_record" ? 2 : 3;
    return rank(a.verificationStatus) - rank(b.verificationStatus) || (b.year ?? 0) - (a.year ?? 0);
  });

  const keyAchievements = buildKeyAchievementTiles(achievements, 4);

  const dataLastUpdatedIso = maxIsoDate([
    profile.scoutIntelligence?.calculatedAt ?? null,
    valueScore.calculatedAt,
    ratingRow?.updatedAt?.toISOString?.() ?? null,
    recentMatches[0]?.kickoffAt ?? null,
    marketValueTimeline24m.points.at(-1)?.dateIso ?? null,
  ]);

  // ── Compare peer teaser (fallback to any rated fly-half if model cohort is solo) ──
  let comparePeer = profile.rankings?.peers.find((p) => !p.isCurrent) ?? null;
  if (!comparePeer && profile.positionName) {
    try {
      const fallback = await getPublicPlayerRankings({
        playerId,
        slug: profile.slug,
        name: profile.name,
        imageUrl: profile.imageUrl,
        rating: ratingRow?.playerRating ?? null,
        positionName: profile.positionName,
        nationName: profile.nationName,
        competitionName: profile.competitionName,
        competitionVerified: Boolean(profile.competitionName),
        modelVersion: null,
      });
      comparePeer = fallback.peers.find((p) => !p.isCurrent) ?? null;
    } catch {
      comparePeer = null;
    }
  }

  const comparison = await getPlayerComparisonCard({
    leftPlayerId: playerId,
    leftSlug: profile.slug,
    leftName: formatDisplayName(profile.name, playerRow.knownAs ?? null, profile.fullName),
    leftImageUrl: profile.imageUrl,
    leftPositionName: profile.positionName,
    leftScores: {
      kicking: intelligence.kicking,
      playmaking: intelligence.playmaking,
      gameManagement: intelligence.gameManagement,
      attack: intelligence.attack,
      defence: intelligence.defence,
      physical: intelligence.physical,
      overall: intelligence.overall,
    },
    leftModelVersion: intelligence.modelVersion,
    compareSlug: options.compareSlug ?? null,
    nationName: profile.nationName,
    competitionName: profile.competitionName,
  });

  // Prefer comparison peer for the legacy teaser field when rankings peer is empty.
  if (!comparePeer && comparison.right) {
    comparePeer = {
      rank: 0,
      slug: comparison.right.slug,
      name: comparison.right.name,
      rating: comparison.right.scores.overall ?? 0,
      imageUrl: comparison.right.imageUrl,
      isCurrent: false,
    };
  }

  // ── Club must never render as the national team (data-safety guard) ──
  const club =
    profile.club && profile.internationalTeam && profile.club.name === profile.internationalTeam.name
      ? null
      : profile.club;

  const cmsHealth = evaluatePlayerDataHealth({
    playerId,
    nameHasAccent: Boolean(profile.name?.includes("é") || profile.name?.includes("É")),
    dobVerified: Boolean(profile.birthDate && profile.birthDate !== "1994-01-01"),
    clubIsNotNation:
      club != null && profile.internationalTeam != null && club.name !== profile.internationalTeam.name,
    clubTeamId: club ? "set" : null,
    internationalTeamId: profile.internationalTeam ? "set" : null,
    preferredFoot: profile.preferredFoot,
    contractVerified: Boolean(profile.contract.expiresOn),
    membershipCount: profile.clubHistory.length,
    transferCount: profile.transfers.length,
    stintsLinked: profile.clubHistory.length + profile.internationalHistory.length,
    stintsTotal: profile.clubHistory.length + profile.internationalHistory.length,
    verifiedCaps: playerRow.verifiedInternationalCaps,
    linkedCaps: linkedInternationalCaps,
    verifiedPoints: playerRow.verifiedInternationalPoints,
    linkedPoints: profile.career.internationalPoints,
    matchRatings: ratingHistory.length,
    ratingSnapshots: ratingHistory.length,
    intelligenceModel: intelligence.modelVersion,
    overallRating: intelligence.overall,
    marketValueGbp: profile.playerValue?.marketValueGbp ?? null,
    valueOutlier,
    honourCount: achievements.length,
    honourVerifiedCount: achievements.filter((a) => a.verificationStatus === "verified").length,
    internationalPositionApps: positionHistory.international.reduce((a, r) => a + r.appearances, 0),
    clubPositionApps: positionHistory.club.reduce((a, r) => a + r.appearances, 0),
    hasPrimarySource: true,
  }).rows;

  return {
    slug: profile.slug,
    playerId,
    preview,
    name: profile.name,
    displayName: formatDisplayName(profile.name, playerRow.knownAs ?? null, profile.fullName),
    knownAs: playerRow.knownAs ?? null,
    fullName: profile.fullName,
    imageUrl: profile.imageUrl,
    badgeImageUrl: profile.badgeImageUrl,
    positionName: profile.positionName,
    otherPositions: profile.otherPositions,
    preferredFoot: profile.preferredFoot,
    age: profile.age,
    birthDate: profile.birthDate,
    birthPlace: profile.birthPlace,
    heightCm: profile.heightCm,
    heightLabel: heightLabel(profile.heightCm),
    weightKg: profile.weightKg,
    nationName: profile.nationName,
    nationCode: profile.nationCode,
    club,
    internationalTeam: profile.internationalTeam,
    competitionName: profile.competitionName,
    status: profile.status,
    statusLabel: profile.statusLabel,
    verifiedInternationalCaps: playerRow.verifiedInternationalCaps,
    verifiedInternationalPoints: playerRow.verifiedInternationalPoints,
    linkedInternationalCaps,
    contract: profile.contract,
    agent: profile.agent,
    rating: {
      current: overall,
      trend: profile.rating.trend,
      trendLabel: profile.rating.trendLabel,
      lastFive: profile.rating.lastFive,
      formScore0to10: formScore0to10 != null ? Math.round(formScore0to10 * 10) / 10 : null,
    },
    intelligence,
    potential,
    ratingState,
    classification,
    badges,
    valueScore,
    valueOutlier,
    clubVerified,
    valueHealth,
    marketValueTimeline24m,
    valueTimeline,
    marketValueChange30d: {
      state: marketValueChange30d.state,
      changePct: marketValueChange30d.changePct,
      movementLabel: marketValueChange30d.movementLabel,
    },
    valueFactorsPresented,
    playerForm,
    radarBenchmark,
    radarBenchmarkSource,
    intelligenceContributions,
    playerValue: profile.playerValue,
    scoutIntelligence: profile.scoutIntelligence,
    scoutSummary,
    scoutStrengths,
    scoutAreas,
    scoutBestRole,
    scoutProvisional,
    cmsHealth,
    rankings: profile.rankings,
    comparePeer,
    comparison,
    nextMatch,
    ratingHistory,
    ratingHistoryOverall,
    performanceRadarPeriods,
    positionHistory,
    upcomingMatch,
    recentMatches,
    achievements,
    keyAchievements,
    dataLastUpdatedIso,
    performanceRadar: profile.performanceRadar,
    developmentTimeline: profile.developmentTimeline,
    career: profile.career,
    seasonSnapshot: profile.seasonSnapshot,
    recentForm: profile.recentForm,
    clubHistory: profile.clubHistory,
    internationalHistory: profile.internationalHistory,
    internationalSummary: profile.internationalSummary,
    titles: profile.titles,
    biography: profile.biography,
    intro: profile.intro,
    seo: profile.seo,
    base: profile,
  };
}

const getCachedPublicPlayerOverviewV2 = cache(
  (slug: string, compareSlug: string): Promise<PublicPlayerOverviewV2 | null> =>
    cachedPublic(
      `player-overview:${slug}:${compareSlug}`,
      PUBLIC_CACHE_TTL.playerOverview,
      () => loadPublicPlayerOverviewV2(slug, { compareSlug: compareSlug || null }),
    ),
);

/** Public overview — request-deduped + TTL cached (skips cache for preview). */
export async function getPublicPlayerOverviewV2(
  slug: string,
  options: { preview?: boolean; compareSlug?: string | null } = {},
): Promise<PublicPlayerOverviewV2 | null> {
  if (options.preview) {
    return loadPublicPlayerOverviewV2(slug, options);
  }
  return getCachedPublicPlayerOverviewV2(slug, options.compareSlug?.trim() || "");
}

export type { PositionHistoryRow };
