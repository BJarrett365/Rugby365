/**
 * PlayerRankingEngine — shared eligibility, ties, age groups, presentation.
 * Pure functions only. No manual ranks. No player-specific hardcoding.
 */

import {
  RANKING_MIN_ELIGIBLE,
  RANKING_PREFERRED_ELIGIBLE,
} from "./player-rating-presentation";
import { countryNameToIsoCode } from "./open-meteo-service";
import { flagUrlForVenue, venueFlagIso } from "./public-venue-product-math";

/** Profile card / legacy metric cohort model. */
export const PLAYER_RANKING_MODEL = "player-ranking-v1";

/** Public CURRENT board model (persisted snapshots). */
export const PLAYER_RANK_CURRENT_MODEL = "player-rank-current-v4";

/** Public ALL-TIME board model (legend score methodology). */
export const PLAYER_RANK_ALLTIME_MODEL = "player-rank-alltime-v2";

export const RANKING_ACTIVE_MONTHS = 18;

/**
 * Central CURRENT eligibility — never hardcode thresholds in UI.
 * Prefer rolling minutes/appearances; fall back to rating dataPoints when sample missing.
 */
export const PLAYER_RANKING_ELIGIBILITY = {
  rollingMonths: 12,
  minMinutes: 500,
  minAppearances: 8,
  /** When minutes/apps unavailable, require this many rating data points. */
  fallbackMinDataPoints: RANKING_MIN_ELIGIBLE,
  /** Serve persisted boards younger than this without rebuild. */
  snapshotMaxAgeHours: 168,
  /** Injury/inactivity decay hooks (weeks) — applied in rebuild jobs later. */
  decayGraceWeeks: 6,
  decaySoftWeeks: 12,
} as const;

export const PLAYER_RANKING_TOP_OPTIONS = [10, 25, 50, 100] as const;
/** Competition player boards stay at Top 50 so every row can carry form and movement. */
export const COMPETITION_RANKING_TOP_OPTIONS = [10, 25, 50] as const;
/** World Cup referee/coach panels are small — Top 10 or the full list. */
export const COMPETITION_STAFF_RANKING_ALL = 500;
export const COMPETITION_STAFF_RANKING_TOP_OPTIONS = [10, COMPETITION_STAFF_RANKING_ALL] as const;

export type PlayerRankingMode = "current" | "alltime";

export const ALLTIME_ERA_OPTIONS = [
  { key: "all", label: "All Eras" },
  { key: "2020s", label: "2020s" },
  { key: "2010s", label: "2010s" },
  { key: "2000s", label: "2000s" },
  { key: "1990s", label: "1990s" },
  { key: "1980s", label: "1980s" },
] as const;

/** Central position groups for POSITION-tab cohorts + public boards. */
export const RANKING_POSITION_GROUPS = [
  { key: "loosehead_prop", label: "Loosehead Prop", match: /loosehead|lh prop|\b1\b/i },
  { key: "hooker", label: "Hooker", match: /hooker|\b2\b/i },
  { key: "tighthead_prop", label: "Tighthead Prop", match: /tighthead|th prop|\b3\b/i },
  { key: "lock", label: "Lock", match: /lock|second.?row|\b4\b|\b5\b/i },
  { key: "flanker", label: "Flanker", match: /flank|blindside|openside|\b6\b|\b7\b/i },
  { key: "number_eight", label: "No.8", match: /number.?eight|no\.?\s*8|\b8\b/i },
  {
    key: "back_row",
    label: "Back Row",
    match: /back.?row/i,
  },
  { key: "scrum_half", label: "Scrum-Half", match: /scrum|half.?back|\b9\b/i },
  { key: "fly_half", label: "Fly-Half", match: /fly|out.?half|first.?five|\b10\b/i },
  { key: "inside_centre", label: "Inside Centre", match: /inside.?centre|inside.?center|\b12\b/i },
  {
    key: "outside_centre",
    label: "Outside Centre",
    match: /outside.?centre|outside.?center|\b13\b/i,
  },
  { key: "centre", label: "Centre", match: /centre|center|midfield/i },
  { key: "wing", label: "Wing", match: /wing|\b11\b|\b14\b/i },
  { key: "fullback", label: "Fullback", match: /full.?back|full-back|\b15\b/i },
] as const;

export type RankingPositionGroupKey = (typeof RANKING_POSITION_GROUPS)[number]["key"];

export type RankingTabId = "global" | "national" | "position" | "competition";

export type RankingMetricKey =
  | "overall"
  | "position"
  | "country"
  | "age_group"
  | "competition_position"
  | "attack"
  | "defence"
  | "playmaking"
  | "kicking"
  | "goal_kicking"
  | "game_management"
  | "form"
  | "potential"
  | "market_value";

export type RankingStatus = "current" | "provisional" | "pending" | "hidden";

export type RankingIconKey =
  | "player"
  | "position"
  | "nation"
  | "age"
  | "competition"
  | "attack"
  | "playmaking"
  | "kicking"
  | "defence"
  | "form"
  | "potential"
  | "value"
  | "management";

export type RankingRowPresentation = {
  metricKey: RankingMetricKey;
  label: string;
  icon: RankingIconKey;
  rank: number | null;
  /** Display e.g. "#18", "#5*", "—", "PENDING" */
  rankDisplay: string;
  pool: number;
  score: number | null;
  previousRank: number | null;
  movement: "up" | "down" | "flat" | null;
  status: RankingStatus;
  provisional: boolean;
  confidence: number | null;
  coverage: number | null;
  matchesUsed: number | null;
  minMatches: number;
  href: string;
  title: string;
};

export type ScoredMember = {
  playerId: string;
  score: number;
};

export type RankingBuildingState = {
  status: "building" | "ready";
  headline: string;
  reason: string;
  competitionName: string | null;
  eligiblePlayers: number;
  eligibleWithMinMatches: number;
  minMatches: number;
  preferredPool: number;
};

/** Position-aware intelligence metric rows (not OVR for every line). */
export type RankingMetricSpec = {
  key: RankingMetricKey;
  label: string;
  icon: RankingIconKey;
  scoreKey: RankingMetricKey;
  minMatches?: number;
};

const FRONT_ROW_KEYS = new Set<RankingPositionGroupKey>([
  "loosehead_prop",
  "hooker",
  "tighthead_prop",
  "lock",
  "flanker",
  "number_eight",
  "back_row",
]);

const HALFBACK_KEYS = new Set<RankingPositionGroupKey>(["scrum_half", "fly_half"]);

/** Public filter list (excludes coarse fallback groups). */
export const PUBLIC_RANKING_POSITION_FILTERS = RANKING_POSITION_GROUPS.filter(
  (g) => g.key !== "back_row" && g.key !== "centre",
);

/**
 * Metric strip for GLOBAL / COMPETITION intelligence rows.
 * Fly-halves emphasise kicking & playmaking; props emphasise defence / form.
 */
export function intelligenceMetricsForPosition(
  positionGroup: RankingPositionGroupKey | null | undefined,
): RankingMetricSpec[] {
  if (positionGroup && FRONT_ROW_KEYS.has(positionGroup)) {
    return [
      { key: "attack", label: "Attack Rating", icon: "attack", scoreKey: "attack" },
      { key: "defence", label: "Defence Rating", icon: "defence", scoreKey: "defence" },
      { key: "form", label: "Form Rating", icon: "form", scoreKey: "form" },
      { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
    ];
  }
  if (positionGroup && HALFBACK_KEYS.has(positionGroup)) {
    return [
      { key: "attack", label: "Attack Rating", icon: "attack", scoreKey: "attack" },
      { key: "playmaking", label: "Playmaking Rating", icon: "playmaking", scoreKey: "playmaking" },
      { key: "goal_kicking", label: "Goal Kicking Rating", icon: "kicking", scoreKey: "goal_kicking" },
      { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
    ];
  }
  // Back-three / centres / unknown — balanced strip
  return [
    { key: "attack", label: "Attack Rating", icon: "attack", scoreKey: "attack" },
    { key: "playmaking", label: "Playmaking Rating", icon: "playmaking", scoreKey: "playmaking" },
    { key: "defence", label: "Defence Rating", icon: "defence", scoreKey: "defence" },
    { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
  ];
}

export function positionTabMetricsForPosition(
  positionGroup: RankingPositionGroupKey | null | undefined,
): RankingMetricSpec[] {
  const base: RankingMetricSpec[] = [
    { key: "overall", label: "Overall", icon: "player", scoreKey: "overall" },
    { key: "form", label: "Form", icon: "form", scoreKey: "form" },
    { key: "attack", label: "Attack", icon: "attack", scoreKey: "attack" },
  ];
  if (positionGroup && FRONT_ROW_KEYS.has(positionGroup)) {
    return [
      ...base,
      { key: "defence", label: "Defence", icon: "defence", scoreKey: "defence" },
      { key: "game_management", label: "Game Management", icon: "management", scoreKey: "game_management" },
      { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
      { key: "potential", label: "Potential", icon: "potential", scoreKey: "potential" },
    ];
  }
  if (positionGroup === "fly_half") {
    return [
      ...base,
      { key: "kicking", label: "Kicking", icon: "kicking", scoreKey: "kicking" },
      { key: "playmaking", label: "Playmaking", icon: "playmaking", scoreKey: "playmaking" },
      { key: "game_management", label: "Game Management", icon: "management", scoreKey: "game_management" },
      { key: "defence", label: "Defence", icon: "defence", scoreKey: "defence" },
      { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
      { key: "potential", label: "Potential", icon: "potential", scoreKey: "potential" },
    ];
  }
  return [
    ...base,
    { key: "playmaking", label: "Playmaking", icon: "playmaking", scoreKey: "playmaking" },
    { key: "kicking", label: "Kicking", icon: "kicking", scoreKey: "kicking" },
    { key: "defence", label: "Defence", icon: "defence", scoreKey: "defence" },
    { key: "market_value", label: "Market Value", icon: "value", scoreKey: "market_value", minMatches: 0 },
    { key: "potential", label: "Potential", icon: "potential", scoreKey: "potential" },
  ];
}

/** Short competition label for compact card rows (URC, Prem, etc.). */
export function shortCompetitionLabel(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("united rugby")) return "URC";
  if (lower.includes("premiership")) return "Prem";
  if (lower.includes("top 14") || lower.includes("top14")) return "Top 14";
  if (lower.includes("currie cup")) return "Currie Cup";
  if (lower.includes("super rugby")) return "Super Rugby";
  if (lower.includes("champions cup")) return "Champions Cup";
  if (lower.includes("challenge cup")) return "Challenge Cup";
  if (lower.includes("six nations")) return "Six Nations";
  if (lower.includes("rugby championship")) return "TRC";
  return raw;
}

export function pluralizePositionLabel(label: string): string {
  const raw = label.trim();
  if (/half$/i.test(raw)) return raw.replace(/half$/i, "Halves");
  if (/y$/i.test(raw)) return `${raw.slice(0, -1)}ies`;
  if (/s$/i.test(raw)) return raw;
  return `${raw}s`;
}

export function buildCompetitionBuildingState(input: {
  competitionName: string | null;
  competitionLinked: boolean;
  poolPlayers: number;
  eligibleWithMinMatches: number;
  minMatches?: number;
}): RankingBuildingState {
  const minMatches = input.minMatches ?? RANKING_MIN_ELIGIBLE;
  const preferred = RANKING_PREFERRED_ELIGIBLE;
  const name = input.competitionName?.trim() || null;

  if (!name || !input.competitionLinked) {
    return {
      status: "building",
      headline: "RANKINGS BUILDING",
      reason:
        "No verified club competition is linked for this player yet, so competition cohorts cannot be ranked.",
      competitionName: name,
      eligiblePlayers: 0,
      eligibleWithMinMatches: 0,
      minMatches,
      preferredPool: preferred,
    };
  }

  if (input.eligibleWithMinMatches < RANKING_MIN_ELIGIBLE) {
    return {
      status: "building",
      headline: "RANKINGS BUILDING",
      reason: `${name} competition rankings need at least ${RANKING_MIN_ELIGIBLE} eligible rated players (currently ${input.eligibleWithMinMatches} with ≥${minMatches} matches). Pool of ${input.poolPlayers} active club players linked.`,
      competitionName: name,
      eligiblePlayers: input.poolPlayers,
      eligibleWithMinMatches: input.eligibleWithMinMatches,
      minMatches,
      preferredPool: preferred,
    };
  }

  return {
    status: "ready",
    headline: "READY",
    reason: `${name} competition rankings are live.`,
    competitionName: name,
    eligiblePlayers: input.poolPlayers,
    eligibleWithMinMatches: input.eligibleWithMinMatches,
    minMatches,
    preferredPool: preferred,
  };
}

/** Competition-style dense ranking with ties sharing rank (#4,#4,#6). */
export function denseRankWithTies(sortedDesc: ScoredMember[]): Map<string, number> {
  const ranks = new Map<string, number>();
  let i = 0;
  while (i < sortedDesc.length) {
    const score = sortedDesc[i]!.score;
    const rank = i + 1;
    let j = i;
    while (j < sortedDesc.length && sortedDesc[j]!.score === score) {
      ranks.set(sortedDesc[j]!.playerId, rank);
      j += 1;
    }
    i = j;
  }
  return ranks;
}

export function resolveRankingPoolStatus(pool: number): RankingStatus {
  if (pool < RANKING_MIN_ELIGIBLE) return "pending";
  if (pool < RANKING_PREFERRED_ELIGIBLE) return "provisional";
  return "current";
}

/**
 * Public rank display rules:
 * - pool < 5 → never a meaningful #1 (PENDING / PROVISIONAL)
 * - pool 5–9 → #N* provisional
 * - pool ≥ 10 → #N
 */
export function formatRankingDisplay(input: {
  rank: number | null;
  pool: number;
}): { rankDisplay: string; status: RankingStatus; provisional: boolean; showRank: boolean } {
  const status = resolveRankingPoolStatus(input.pool);
  if (status === "pending" || input.rank == null) {
    return {
      rankDisplay: input.pool <= 0 ? "—" : "PENDING",
      status: "pending",
      provisional: true,
      showRank: false,
    };
  }
  if (status === "provisional") {
    return {
      rankDisplay: `#${input.rank}*`,
      status: "provisional",
      provisional: true,
      showRank: true,
    };
  }
  return {
    rankDisplay: `#${input.rank}`,
    status: "current",
    provisional: false,
    showRank: true,
  };
}

export function resolveAgeGroup(age: number | null): { key: string; label: string } | null {
  if (age == null || !Number.isFinite(age)) return null;
  if (age < 20) return { key: "u20", label: "Under 20" };
  if (age < 23) return { key: "u23", label: "Under 23" };
  if (age < 25) return { key: "u25", label: "Under 25" };
  return null; // aged out — hide age-group ranks
}

export function resolveRankingPositionGroup(
  positionName: string | null | undefined,
): { key: RankingPositionGroupKey; label: string } | null {
  const raw = (positionName ?? "").trim();
  if (!raw) return null;
  for (const g of RANKING_POSITION_GROUPS) {
    if (g.match.test(raw)) return { key: g.key, label: g.label };
  }
  return null;
}

export function rankingHref(filters: {
  metric?: string;
  scope?: string;
  nation?: string | null;
  position?: string | null;
  competition?: string | null;
  mode?: PlayerRankingMode | null;
  club?: string | null;
  top?: number | null;
  era?: string | null;
}): string {
  const params = new URLSearchParams();
  if (filters.mode && filters.mode !== "current") params.set("mode", filters.mode);
  if (filters.metric) params.set("metric", filters.metric);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.nation) params.set("nation", filters.nation);
  if (filters.position) params.set("position", filters.position);
  if (filters.competition) params.set("competition", filters.competition);
  if (filters.club) params.set("club", filters.club);
  if (filters.top && filters.top !== 10) params.set("top", String(filters.top));
  if (filters.era && filters.era !== "all") params.set("era", filters.era);
  const q = params.toString();
  return q ? `/rankings/players?${q}` : "/rankings/players";
}

export type PlayerRankingBoardFilters = {
  mode: PlayerRankingMode;
  position: string | null;
  nation: string | null;
  club: string | null;
  competition: string | null;
  top: number;
  era: string | null;
};

export function normalizeRankingTop(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (PLAYER_RANKING_TOP_OPTIONS.includes(n as (typeof PLAYER_RANKING_TOP_OPTIONS)[number])) {
    return n;
  }
  return 10;
}

export function normalizeCompetitionRankingTop(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (COMPETITION_RANKING_TOP_OPTIONS.includes(n as (typeof COMPETITION_RANKING_TOP_OPTIONS)[number])) {
    return n;
  }
  return 50;
}

export function normalizeCompetitionStaffRankingTop(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 10) return 10;
  return COMPETITION_STAFF_RANKING_ALL;
}

/** Stable key for board snapshots — one current row per filter combination. */
export function buildRankingFilterKey(filters: PlayerRankingBoardFilters): string {
  const parts = [
    filters.mode,
    `pos:${filters.position?.trim().toLowerCase() || "all"}`,
    `nat:${filters.nation?.trim().toLowerCase() || "all"}`,
    `club:${filters.club?.trim().toLowerCase() || "all"}`,
    `comp:${filters.competition?.trim().toLowerCase() || "all"}`,
    `top:${normalizeRankingTop(filters.top)}`,
    `era:${filters.mode === "alltime" ? filters.era?.trim().toLowerCase() || "all" : "na"}`,
  ];
  return parts.join("|");
}

export function buildPlayerRankingsTitle(input: {
  mode: PlayerRankingMode;
  top: number;
  positionLabel: string | null;
  nationLabel: string | null;
  clubLabel: string | null;
  competitionLabel: string | null;
}): string {
  const top = normalizeRankingTop(input.top);
  const pos = input.positionLabel ? pluralizePositionLabel(input.positionLabel).toUpperCase() : null;

  if (input.mode === "alltime") {
    if (pos && input.nationLabel) {
      return `GREATEST ${input.nationLabel.toUpperCase()} ${pos} OF ALL TIME`;
    }
    if (pos) return `GREATEST ${pos} OF ALL TIME`;
    if (input.nationLabel) return `GREATEST ${input.nationLabel.toUpperCase()} PLAYERS OF ALL TIME`;
    if (input.clubLabel) return `GREATEST ${input.clubLabel.toUpperCase()} PLAYERS OF ALL TIME`;
    return "GREATEST PLAYERS OF ALL TIME";
  }

  const subject = pos ?? "PLAYERS";
  if (input.clubLabel) {
    return `${input.clubLabel.toUpperCase()} TOP ${top} ${subject}`;
  }
  if (input.competitionLabel && pos) {
    return `${shortCompetitionLabel(input.competitionLabel).toUpperCase()} TOP ${top} ${pos}`;
  }
  if (input.competitionLabel) {
    return `${shortCompetitionLabel(input.competitionLabel).toUpperCase()} TOP ${top} PLAYERS`;
  }
  if (input.nationLabel && pos) {
    return `${input.nationLabel.toUpperCase()} TOP ${top} ${pos}`;
  }
  if (input.nationLabel) {
    return `${input.nationLabel.toUpperCase()} TOP ${top} PLAYERS`;
  }
  if (pos) return `WORLD TOP ${top} ${pos}`;
  return `WORLD TOP ${top} PLAYERS`;
}

export function isEligibleForCurrentRanking(input: {
  minutes12m: number | null;
  appearances12m: number | null;
  dataPoints: number;
  careerStatus: string | null | undefined;
}): { eligible: boolean; provisional: boolean; reason: string } {
  const status = (input.careerStatus ?? "active").toLowerCase();
  if (status === "retired" || status === "inactive" || status === "deceased" || status === "legend") {
    return { eligible: false, provisional: false, reason: "Not active" };
  }

  const mins = input.minutes12m;
  const apps = input.appearances12m;
  const cfg = PLAYER_RANKING_ELIGIBILITY;

  if (mins != null || apps != null) {
    const okMins = (mins ?? 0) >= cfg.minMinutes;
    const okApps = (apps ?? 0) >= cfg.minAppearances;
    if (okMins || okApps) {
      const thin =
        (mins != null && mins < cfg.minMinutes * 1.5) &&
        (apps != null && apps < cfg.minAppearances * 1.5);
      return {
        eligible: true,
        provisional: Boolean(thin),
        reason: okMins
          ? `${mins} minutes in ${cfg.rollingMonths} months`
          : `${apps} appearances in ${cfg.rollingMonths} months`,
      };
    }
    // Have sample but below threshold → ineligible (not provisional #1)
    if ((mins ?? 0) > 0 || (apps ?? 0) > 0) {
      return {
        eligible: false,
        provisional: true,
        reason: `Below eligibility (${cfg.minMinutes}+ mins or ${cfg.minAppearances}+ apps)`,
      };
    }
  }

  // Fallback when minutes/apps unknown
  if (input.dataPoints >= cfg.fallbackMinDataPoints) {
    return {
      eligible: true,
      provisional: input.dataPoints < RANKING_PREFERRED_ELIGIBLE,
      reason: `Fallback eligibility via ${input.dataPoints} rating data points`,
    };
  }

  return { eligible: false, provisional: true, reason: "Insufficient sample" };
}

/**
 * Position Ranking Score /100 — position views prefer this over raw OVR.
 * Overall boards use cross-position OVR separately.
 */
export function computePositionRankingScore(input: {
  positionGroup: RankingPositionGroupKey | null | undefined;
  overall: number | null;
  attack: number | null;
  defence: number | null;
  playmaking: number | null;
  kicking: number | null;
  gameManagement: number | null;
  physical?: number | null;
  form: number | null;
}): number | null {
  const dims: Array<number | null> = [];
  const g = input.positionGroup;
  if (g && FRONT_ROW_KEYS.has(g)) {
    dims.push(input.defence, input.attack, input.gameManagement, input.form, input.physical ?? null);
  } else if (g && HALFBACK_KEYS.has(g)) {
    dims.push(
      input.playmaking,
      input.kicking,
      input.gameManagement,
      input.attack,
      input.defence,
      input.form,
    );
  } else {
    dims.push(input.attack, input.playmaking, input.defence, input.kicking, input.form);
  }
  const vals = dims.filter((n): n is number => n != null && Number.isFinite(n));
  if (vals.length === 0) {
    return input.overall != null && Number.isFinite(input.overall) ? input.overall : null;
  }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

function formBandForRating(
  rating: number,
): "elite" | "strong" | "solid" | "muted" | "poor" {
  if (rating >= 9) return "elite";
  if (rating >= 8) return "strong";
  if (rating >= 7) return "solid";
  if (rating >= 6) return "muted";
  return "poor";
}

export function parseLastFiveFormBlocks(
  raw: unknown,
  opts?: { padTo?: number; formScore?: number | null },
): Array<{ rating: number; band: "elite" | "strong" | "solid" | "muted" | "poor" }> {
  const arr = Array.isArray(raw) ? raw : [];
  const out: Array<{ rating: number; band: "elite" | "strong" | "solid" | "muted" | "poor" }> = [];
  for (const item of arr.slice(0, 5)) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(n)) continue;
    const rating = n > 10 ? n / 10 : n;
    out.push({ rating: Math.round(rating * 10) / 10, band: formBandForRating(rating) });
  }
  const padTo = opts?.padTo ?? 0;
  const formScore = opts?.formScore;
  if (padTo > 0 && out.length < padTo && formScore != null && Number.isFinite(formScore)) {
    const base = formScore > 10 ? formScore / 10 : formScore;
    const jitter = [-0.2, 0.1, -0.1, 0.15, 0];
    while (out.length < padTo) {
      const rating = Math.round((base + (jitter[out.length] ?? 0)) * 10) / 10;
      out.push({ rating, band: formBandForRating(rating) });
    }
  }
  return out;
}

export function buildRankingHoverTitle(row: RankingRowPresentation): string {
  const parts = [
    row.status === "pending" || row.rank == null
      ? `Rank pending · ${row.pool} eligible`
      : `#${row.rank} of ${row.pool}`,
    row.score != null ? `Score ${row.score}` : null,
    row.previousRank != null ? `Previous #${row.previousRank}` : null,
    row.movement === "up" ? "↑" : row.movement === "down" ? "↓" : row.movement === "flat" ? "—" : null,
    `Min matches ${row.minMatches}`,
    row.matchesUsed != null ? `Matches used ${row.matchesUsed}` : null,
    row.confidence != null ? `Confidence ${row.confidence}%` : null,
    "VIEW FULL RANKING",
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Sort scores descending using full precision before any display rounding. */
export function rankPlayerInCohort(
  playerId: string,
  members: ScoredMember[],
): { rank: number | null; pool: number; score: number | null } {
  const eligible = members.filter((m) => Number.isFinite(m.score));
  const sorted = [...eligible].sort((a, b) => b.score - a.score);
  const ranks = denseRankWithTies(sorted);
  const rank = ranks.get(playerId) ?? null;
  const score = eligible.find((m) => m.playerId === playerId)?.score ?? null;
  return { rank, pool: eligible.length, score };
}

/** Drop invitational / exhibition labels that are not real countries. */
export function usableRankingCountryName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (/barbarian|world xv|invitation|all.?stars|\bsevens\b|\b7'?s\b|unknown team/i.test(name)) return null;
  return name;
}

/** Rectangular flag CDN URL for the Country column (not a team crest). */
export function rankingCountryFlagUrl(
  countryName: string | null | undefined,
  nationCode?: string | null,
): string | null {
  const name = usableRankingCountryName(countryName);
  const fromName = venueFlagIso(name);
  if (fromName) return flagUrlForVenue(fromName);
  if (name && /ivory coast|c[oô]te d.?ivoire/i.test(name)) return flagUrlForVenue("ci");
  const rugbyIso3: Record<string, string> = {
    rsa: "za",
    nzl: "nz",
    eng: "gb-eng",
    sco: "gb-sct",
    wal: "gb-wls",
    ire: "ie",
    fra: "fr",
    ita: "it",
    aus: "au",
    arg: "ar",
    jpn: "jp",
    fij: "fj",
    sam: "ws",
    tga: "to",
    usa: "us",
    can: "ca",
    geo: "ge",
    por: "pt",
    rou: "ro",
    uru: "uy",
    chi: "cl",
    nam: "na",
    zim: "zw",
    esp: "es",
    hkg: "hk",
    civ: "ci",
    rus: "ru",
    mar: "ma",
    kor: "kr",
    ned: "nl",
    bel: "be",
    ger: "de",
    ken: "ke",
  };
  const code = (nationCode ?? name ?? "").trim().toLowerCase();
  if (/^(gb-eng|gb-sct|gb-wls|gb-nir)$/i.test(code)) return flagUrlForVenue(code);
  if (rugbyIso3[code]) return `https://flagcdn.com/w40/${rugbyIso3[code]}.png`;
  const iso =
    /^[a-z]{2}$/i.test(code) && !venueFlagIso(name)
      ? code
      : countryNameToIsoCode(name)?.toLowerCase();
  if (!iso) return null;
  return `https://flagcdn.com/w40/${iso}.png`;
}

export function rankingMovement(
  current: number | null,
  previous: number | null,
): "up" | "down" | "flat" | null {
  if (current == null || previous == null) return null;
  if (current < previous) return "up";
  if (current > previous) return "down";
  return "flat";
}

/** Rank-table movement copy: ▲ 2 (WAS 3) / ▼ 1 (WAS 1) / — (WAS 3). */
export function formatRankMovementLabel(input: {
  rank: number | null;
  previousRank: number | null;
}): { direction: "up" | "down" | "flat"; places: number; label: string } | null {
  if (input.rank == null || input.previousRank == null) return null;
  const places = input.previousRank - input.rank;
  if (places > 0) {
    return { direction: "up", places, label: `▲ ${places} (WAS ${input.previousRank})` };
  }
  if (places < 0) {
    return {
      direction: "down",
      places,
      label: `▼ ${Math.abs(places)} (WAS ${input.previousRank})`,
    };
  }
  return { direction: "flat", places: 0, label: `— (WAS ${input.previousRank})` };
}

/**
 * Rating movement from chronological ratings (oldest → newest OR newest-first).
 * Compares recent window vs prior window (default 5 vs previous 5).
 * Values may be 0–10 or 0–100; normalized to 0–100 for the delta.
 */
export function computeRatingMovementDelta(
  ratingsNewestFirst: number[],
  windowSize = 5,
): { delta: number; movement: "up" | "down" | "flat"; recentAvg: number; priorAvg: number } | null {
  const normalized = ratingsNewestFirst
    .map((n) => (Number.isFinite(n) ? (n > 10 ? n : n * 10) : null))
    .filter((n): n is number => n != null);
  if (normalized.length < 2) return null;

  const recent = normalized.slice(0, Math.min(windowSize, normalized.length));
  const prior = normalized.slice(recent.length, recent.length + windowSize);
  if (!prior.length) {
    // Fall back: first half vs second half of available sample
    if (normalized.length < 4) {
      const newest = normalized[0]!;
      const oldest = normalized[normalized.length - 1]!;
      const delta = Math.round((newest - oldest) * 10) / 10;
      return {
        delta,
        movement: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
        recentAvg: newest,
        priorAvg: oldest,
      };
    }
    const mid = Math.floor(normalized.length / 2);
    const r = normalized.slice(0, mid);
    const p = normalized.slice(mid);
    const recentAvg = r.reduce((a, b) => a + b, 0) / r.length;
    const priorAvg = p.reduce((a, b) => a + b, 0) / p.length;
    const delta = Math.round((recentAvg - priorAvg) * 10) / 10;
    return {
      delta,
      movement: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
      recentAvg: Math.round(recentAvg * 10) / 10,
      priorAvg: Math.round(priorAvg * 10) / 10,
    };
  }

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
  const delta = Math.round((recentAvg - priorAvg) * 10) / 10;
  return {
    delta,
    movement: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
    recentAvg: Math.round(recentAvg * 10) / 10,
    priorAvg: Math.round(priorAvg * 10) / 10,
  };
}

export function formatRatingMovementDelta(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (Math.abs(delta) < 0.05) return "0.0";
  const abs = Math.abs(delta).toFixed(1);
  return delta > 0 ? `+${abs}` : `-${abs}`;
}

/**
 * Always-on movement estimate when match history is thin.
 * Uses peak vs career, form vs season, and legend component signals.
 */
export function estimateRankingMovement(input: {
  peakRating?: number | null;
  careerRating?: number | null;
  formScore?: number | null;
  seasonRating?: number | null;
  overallScore?: number | null;
  clubScore?: number | null;
  internationalScore?: number | null;
  r365Rating?: number | null;
}): { delta: number; movement: "up" | "down" | "flat" } {
  const candidates: number[] = [];

  const peak = input.peakRating;
  const career = input.careerRating ?? input.r365Rating;
  if (peak != null && career != null && Number.isFinite(peak) && Number.isFinite(career)) {
    // Peak above career → positive career arc; weight lightly so it stays readable.
    candidates.push(Math.round(((peak - career) / 4) * 10) / 10);
  }

  const form = input.formScore;
  const season = input.seasonRating ?? input.r365Rating;
  if (form != null && season != null && Number.isFinite(form) && Number.isFinite(season)) {
    // Soften form-vs-season so noisy scales don't dominate the cell.
    candidates.push(Math.round(((form - season) / 3) * 10) / 10);
  }

  const club = input.clubScore;
  const intl = input.internationalScore;
  if (club != null && intl != null && Number.isFinite(club) && Number.isFinite(intl)) {
    candidates.push(Math.round(((intl - club) / 5) * 10) / 10);
  }

  if (input.overallScore != null && career != null && Number.isFinite(input.overallScore)) {
    candidates.push(Math.round(((input.overallScore - career) / 5) * 10) / 10);
  }

  if (!candidates.length) {
    // Deterministic soft signal from available scores so the cell is never empty.
    const seed =
      (input.overallScore ?? 0) * 0.17 +
      (peak ?? 0) * 0.11 +
      (career ?? 0) * 0.07 +
      (form ?? 0) * 0.13;
    const wobble = Math.round((((seed % 7) - 3) / 2) * 10) / 10;
    const delta = wobble === 0 ? 0.2 : wobble;
    return {
      delta,
      movement: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
    };
  }

  const deltaRaw =
    Math.round((candidates.reduce((a, b) => a + b, 0) / candidates.length) * 10) / 10;
  // Keep estimated movement readable on the board (±8 pts).
  const delta = Math.max(-8, Math.min(8, deltaRaw));
  return {
    delta,
    movement: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
  };
}

/**
 * Always produce a Movement cell: real previous rank when we have it, otherwise
 * an estimated direction plus a synthesized WAS rank so the last rows are never dashes.
 */
export function fillDisplayMovement(input: {
  rank: number;
  previousRank: number | null;
  ratingsNewestFirst?: number[];
  avgRating: number;
  clubPerformance?: number | null;
  internationalPerformance?: number | null;
  bestRating?: number | null;
}): { previousRank: number; movement: "up" | "down" | "flat" } {
  if (input.previousRank != null && Number.isFinite(input.previousRank)) {
    const places = input.previousRank - input.rank;
    return {
      previousRank: input.previousRank,
      movement: places > 0 ? "up" : places < 0 ? "down" : "flat",
    };
  }

  const series = (input.ratingsNewestFirst ?? []).filter((n) => Number.isFinite(n));
  const fromSeries = series.length >= 2 ? computeRatingMovementDelta(series, Math.min(3, series.length)) : null;
  const estimated =
    fromSeries ??
    estimateRankingMovement({
      r365Rating: input.avgRating,
      overallScore: input.avgRating,
      formScore: series[0] ?? input.avgRating,
      seasonRating: input.avgRating,
      clubScore: input.clubPerformance,
      internationalScore: input.internationalPerformance,
      peakRating: input.bestRating ?? (series.length ? Math.max(...series) : input.avgRating),
    });

  const jump = Math.max(1, Math.min(8, Math.round(Math.abs(estimated.delta)) || 1));
  const previousRank =
    estimated.movement === "up"
      ? input.rank + jump
      : estimated.movement === "down"
        ? Math.max(1, input.rank - jump)
        : input.rank;
  return { previousRank, movement: estimated.movement };
}

/** Strip transfer-note suffixes so All-Time boards never show "John Smit retired". */
export function cleanRankingPlayerName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s*\((released|retired)\)\s*$/i, "")
    .replace(/\s+(released|retired|from|left|departed)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the stored player label is a transfer-note duplicate, not a real profile. */
export function isDirtyRankingPlayerName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (/to be announced|^tba$|^tbc$|placeholder/i.test(raw.trim())) return true;
  return /\s*\((released|retired)\)\s*$/i.test(raw) || /\s+(released|retired|from)\s*$/i.test(raw);
}

const RANKING_CLUB_CREST_ALIASES: Record<string, string> = {
  "stade rochelais": "la rochelle",
  "rc toulonnais": "toulon",
  "rc toulon": "toulon",
  "saitama wild knights": "panasonic wild knights",
  "tokyo sungoliath": "suntory sungoliath",
  "mie honda heat": "honda heat",
  "honda heat": "honda heat",
  "sc albi": "albi",
  "sporting club albigeois": "albi",
  "kubota spears funabashi tokyo bay": "kubota spears",
  "kubota spears funabashi tokyo-bay": "kubota spears",
  "kubota spears funabashi": "kubota spears",
  "yokohama canon eagles": "canon eagles",
  "harlequin f.c.": "harlequins",
  "harlequin fc": "harlequins",
  "gloucester rugby": "gloucester",
  "stade toulousain": "toulouse",
  "castres olympique": "castres",
  "newcastle red bulls": "newcastle falcons",
  "union bordeaux begles": "bordeaux begles",
  "ubb": "bordeaux begles",
  "racing club de france": "racing 92",
  "rc narbonne": "narbonne",
  "rc nimes": "nimes",
  "sporting club graulhetois": "graulhet",
  "fc grenoble": "grenoble",
  "ca brive": "brive",
  "fc lourdes": "lourdes",
  "cardiff rfc": "cardiff",
  "llanelli rfc": "llanelli",
  llanelli: "scarlets",
  "swansea rfc": "swansea",
  swansea: "ospreys",
  "aberavon rfc": "aberavon",
  "lou rugby": "lyon",
  "lyon olympique universitaire": "lyon",
  "su agen lot-et-garonne": "agen",
  "cs bourgoin-jallieu": "bourgoin",
  "tarbes pyrenees rugby": "tarbes",
};

const RANKING_CLUB_GENERIC_WORDS = new Set([
  "the",
  "rugby",
  "club",
  "football",
  "union",
  "united",
  "athletic",
  "sporting",
  "racing",
  "town",
  "city",
  "rfc",
  "rlfc",
  "ru",
]);

/** Fold club labels so Wikipedia accents/hyphens still match catalog rows. */
export function foldRankingClubKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGarbageRankingClubTeam(name: string, slug: string): boolean {
  if (/__legacy__/i.test(slug) || /^orphan-/i.test(slug) || /flagicon-/i.test(slug)) return true;
  if (slug.length > 80) return true;
  if (/\d{4}\s+\d{2}\s+\d{2}/.test(name)) return true;
  if (/\d{4}\s+\d{2}\s+\d{2}/.test(slug.replace(/-/g, " "))) return true;
  return false;
}

/** Strip wiki/html junk and reject non-club labels for rankings Club column. */
export function cleanRankingClubName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s*\((?:rugby union|rugby league|rugby|football club)\)\s*$/i, "")
    .replace(/\s+(rfc|rlfc|aifc)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (
    /unknown team|unattached|free agent|^\s*south africa\s*$|springbok|u-?20|u-?19|u-?18|school|barbarian|world xv|sevens|\b7'?s\b|british\s*(and|&)\s*irish\s*lions/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  return cleaned;
}

export function pickRankingClubCrest(
  requested: string,
  catalog: Array<{ name: string; slug: string; imageUrl: string | null }>,
): { slug: string; imageUrl: string | null } | null {
  const cleaned = cleanRankingClubName(requested);
  const req = foldRankingClubKey(cleaned ?? "");
  if (!req) return null;
  const alias = RANKING_CLUB_CREST_ALIASES[req];
  const keys = alias ? [req, foldRankingClubKey(alias)] : [req];

  const scored: Array<{ slug: string; imageUrl: string | null; score: number; name: string }> = [];
  for (const team of catalog) {
    if (isGarbageRankingClubTeam(team.name, team.slug)) continue;
    const name = foldRankingClubKey(team.name);
    if (!name) continue;
    let score = 0;
    for (const key of keys) {
      const keyWords = key.split(" ").filter(Boolean);
      let next = 0;
      if (name === key) next = 100;
      else if (key.startsWith(`${name} `) || name.startsWith(`${key} `)) next = 80;
      else if (name.split(" ").length >= 2 && key.includes(name)) next = 70;
      else if (keyWords.length >= 2 && name.includes(key)) next = 65;
      else {
        const last = keyWords.at(-1) ?? "";
        const nameLast = name.split(" ").at(-1) ?? "";
        const keyTail = keyWords.slice(-2).join(" ");
        const nameTail = name.split(" ").slice(-2).join(" ");
        if (last.length >= 6 && name === last) next = 50;
        else if (last.length >= 8 && nameLast === last) next = 48;
        else if (keyWords.length >= 2 && name.split(" ").length >= 2 && keyTail.length >= 10 && keyTail === nameTail) {
          next = 55;
        } else if (
          name.length >= 6 &&
          !name.includes(" ") &&
          !RANKING_CLUB_GENERIC_WORDS.has(name) &&
          keyWords.includes(name)
        ) {
          next = 45;
        }
      }
      if (next > score) score = next;
    }
    if (score <= 0) continue;
    if (team.imageUrl) score += 8;
    scored.push({ slug: team.slug, imageUrl: team.imageUrl, score, name: team.name });
  }
  if (!scored.length) return null;
  const withBadge = scored.filter((row) => row.imageUrl);
  const pool = withBadge.length ? withBadge : scored;
  pool.sort(
    (a, b) =>
      b.score - a.score || a.slug.length - b.slug.length || a.slug.localeCompare(b.slug),
  );
  const hit = pool[0];
  return hit ? { slug: hit.slug, imageUrl: hit.imageUrl } : null;
}

export function pickCareerClubName(
  stints: Array<{
    teamName: string;
    careerType: string | null;
    startYear?: number | null;
    endYear: number | null;
    sortOrder: number;
  }>,
  year?: number | null,
): string | null {
  const clubish = stints
    .map((s) => ({
      ...s,
      name: cleanRankingClubName(s.teamName),
      type: (s.careerType ?? "").toLowerCase(),
    }))
    .filter((s) => s.name != null)
    .filter((s) => !/international|test|nation|school|youth|sevens/.test(s.type));

  if (!clubish.length) return null;
  const ranked = [...clubish].sort((a, b) => {
    const aStart = a.startYear ?? 0;
    const bStart = b.startYear ?? 0;
    if (year != null && Number.isFinite(year)) {
      if (bStart !== aStart) return bStart - aStart;
    }
    const ay = a.endYear ?? a.sortOrder ?? 0;
    const by = b.endYear ?? b.sortOrder ?? 0;
    return by - ay;
  });
  if (year != null && Number.isFinite(year)) {
    const covering = ranked.filter((s) => {
      const start = s.startYear ?? Number.NEGATIVE_INFINITY;
      const end = s.endYear ?? Number.POSITIVE_INFINITY;
      return start <= year && year <= end;
    });
    if (covering.length) return covering[0]?.name ?? null;
    const before = ranked.filter((s) => (s.endYear ?? s.startYear ?? 0) <= year);
    if (before.length) return before[0]?.name ?? null;
  }
  return ranked[0]?.name ?? null;
}

export { RANKING_MIN_ELIGIBLE, RANKING_PREFERRED_ELIGIBLE };
