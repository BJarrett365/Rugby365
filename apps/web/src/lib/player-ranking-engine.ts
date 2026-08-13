/**
 * PlayerRankingEngine — shared eligibility, ties, age groups, presentation.
 * Pure functions only. No manual ranks. No player-specific hardcoding.
 */

import {
  RANKING_MIN_ELIGIBLE,
  RANKING_PREFERRED_ELIGIBLE,
} from "./player-rating-presentation";

/** Profile card / legacy metric cohort model. */
export const PLAYER_RANKING_MODEL = "player-ranking-v1";

/** Public CURRENT board model (persisted snapshots). */
export const PLAYER_RANK_CURRENT_MODEL = "player-rank-current-v1";

/** Public ALL-TIME board model (separate methodology — not live yet). */
export const PLAYER_RANK_ALLTIME_MODEL = "player-rank-alltime-v1";

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
  if (status === "retired" || status === "inactive" || status === "deceased") {
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

export function parseLastFiveFormBlocks(
  raw: unknown,
): Array<{ rating: number; band: "elite" | "strong" | "solid" | "muted" | "poor" }> {
  const arr = Array.isArray(raw) ? raw : [];
  const out: Array<{ rating: number; band: "elite" | "strong" | "solid" | "muted" | "poor" }> = [];
  for (const item of arr.slice(0, 5)) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(n)) continue;
    const rating = n > 10 ? n / 10 : n;
    const band =
      rating >= 9
        ? "elite"
        : rating >= 8
          ? "strong"
          : rating >= 7
            ? "solid"
            : rating >= 6
              ? "muted"
              : "poor";
    out.push({ rating: Math.round(rating * 10) / 10, band });
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

export function rankingMovement(
  current: number | null,
  previous: number | null,
): "up" | "down" | "flat" | null {
  if (current == null || previous == null) return null;
  if (current < previous) return "up";
  if (current > previous) return "down";
  return "flat";
}

export { RANKING_MIN_ELIGIBLE, RANKING_PREFERRED_ELIGIBLE };
