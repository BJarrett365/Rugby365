/**
 * Position-aware metric rows for the Recent Form card.
 * Missing values stay null — never coerced to 0 in the UI.
 */

import { resolveIntelligencePositionGroup, type IntelligencePositionGroup } from "./player-intelligence-position-config";

export type RecentFormMetricKey =
  | "points"
  | "goalKicks"
  | "tryAssists"
  | "kicks"
  | "lineBreaks"
  | "tries"
  | "tackles"
  | "metres"
  | "carries"
  | "turnovers"
  | "defendersBeaten"
  | "avgMatchRating";

export type RecentFormMetricDef = {
  key: RecentFormMetricKey;
  label: string;
};

const FLY_HALF_METRICS: RecentFormMetricDef[] = [
  { key: "points", label: "Points" },
  { key: "goalKicks", label: "Goal Kicks" },
  { key: "tryAssists", label: "Try Assists" },
  { key: "kicks", label: "Kicks" },
  { key: "lineBreaks", label: "Line Breaks" },
];

const PROP_METRICS: RecentFormMetricDef[] = [
  { key: "tackles", label: "Tackles" },
  { key: "carries", label: "Carries" },
  { key: "metres", label: "Metres" },
  { key: "turnovers", label: "Turnovers" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const HOOKER_METRICS: RecentFormMetricDef[] = [
  { key: "tackles", label: "Tackles" },
  { key: "carries", label: "Carries" },
  { key: "tries", label: "Tries" },
  { key: "turnovers", label: "Turnovers" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const LOCK_METRICS: RecentFormMetricDef[] = [
  { key: "tackles", label: "Tackles" },
  { key: "carries", label: "Carries" },
  { key: "metres", label: "Metres" },
  { key: "lineBreaks", label: "Line Breaks" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const BACK_ROW_METRICS: RecentFormMetricDef[] = [
  { key: "tackles", label: "Tackles" },
  { key: "turnovers", label: "Turnovers" },
  { key: "carries", label: "Carries" },
  { key: "metres", label: "Metres" },
  { key: "tries", label: "Tries" },
];

const SCRUM_HALF_METRICS: RecentFormMetricDef[] = [
  { key: "points", label: "Points" },
  { key: "tryAssists", label: "Try Assists" },
  { key: "tries", label: "Tries" },
  { key: "kicks", label: "Kicks" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const CENTRE_METRICS: RecentFormMetricDef[] = [
  { key: "tries", label: "Tries" },
  { key: "lineBreaks", label: "Line Breaks" },
  { key: "defendersBeaten", label: "Defenders Beaten" },
  { key: "metres", label: "Metres" },
  { key: "tackles", label: "Tackles" },
];

const WING_METRICS: RecentFormMetricDef[] = [
  { key: "tries", label: "Tries" },
  { key: "metres", label: "Metres" },
  { key: "defendersBeaten", label: "Defenders Beaten" },
  { key: "lineBreaks", label: "Line Breaks" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const FULLBACK_METRICS: RecentFormMetricDef[] = [
  { key: "points", label: "Points" },
  { key: "tries", label: "Tries" },
  { key: "metres", label: "Metres" },
  { key: "kicks", label: "Kicks" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const GENERIC_METRICS: RecentFormMetricDef[] = [
  { key: "points", label: "Points" },
  { key: "tries", label: "Tries" },
  { key: "tackles", label: "Tackles" },
  { key: "metres", label: "Metres" },
  { key: "avgMatchRating", label: "Avg Match Rating" },
];

const BY_GROUP: Record<IntelligencePositionGroup, RecentFormMetricDef[]> = {
  fly_half: FLY_HALF_METRICS,
  prop: PROP_METRICS,
  hooker: HOOKER_METRICS,
  lock: LOCK_METRICS,
  back_row: BACK_ROW_METRICS,
  scrum_half: SCRUM_HALF_METRICS,
  centre: CENTRE_METRICS,
  wing: WING_METRICS,
  fullback: FULLBACK_METRICS,
  generic: GENERIC_METRICS,
};

export function recentFormMetricConfig(
  positionName: string | null | undefined,
): RecentFormMetricDef[] {
  const group = resolveIntelligencePositionGroup(positionName);
  return BY_GROUP[group] ?? GENERIC_METRICS;
}

export type RecentFormMetricTotals = {
  points: number | null;
  goalKickMade: number | null;
  goalKickAttempts: number | null;
  tryAssists: number | null;
  kicks: number | null;
  lineBreaks: number | null;
  tries: number | null;
  tackles: number | null;
  metres: number | null;
  carries: number | null;
  turnovers: number | null;
  defendersBeaten: number | null;
  avgMatchRating: number | null;
};

export type RecentFormMetricDisplay = {
  key: RecentFormMetricKey;
  label: string;
  /** Preformatted display; "—" when missing. */
  display: string;
  /** Raw numeric for sorting/tests; null when missing. */
  value: number | null;
};

function formatInt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function formatGoalKicks(made: number | null, attempts: number | null): string {
  if (made == null || attempts == null || attempts <= 0) return "—";
  const pct = Math.round((made / attempts) * 100);
  return `${made}/${attempts} (${pct}%)`;
}

export function buildRecentFormMetricDisplays(
  positionName: string | null | undefined,
  totals: RecentFormMetricTotals,
): RecentFormMetricDisplay[] {
  return recentFormMetricConfig(positionName).map((def) => {
    switch (def.key) {
      case "goalKicks":
        return {
          key: def.key,
          label: def.label,
          display: formatGoalKicks(totals.goalKickMade, totals.goalKickAttempts),
          value:
            totals.goalKickMade != null &&
            totals.goalKickAttempts != null &&
            totals.goalKickAttempts > 0
              ? Math.round((totals.goalKickMade / totals.goalKickAttempts) * 1000) / 10
              : null,
        };
      case "avgMatchRating":
        return {
          key: def.key,
          label: def.label,
          display:
            totals.avgMatchRating != null && Number.isFinite(totals.avgMatchRating)
              ? totals.avgMatchRating.toFixed(1)
              : "—",
          value: totals.avgMatchRating,
        };
      case "points":
        return { key: def.key, label: def.label, display: formatInt(totals.points), value: totals.points };
      case "tryAssists":
        return {
          key: def.key,
          label: def.label,
          display: formatInt(totals.tryAssists),
          value: totals.tryAssists,
        };
      case "kicks":
        return { key: def.key, label: def.label, display: formatInt(totals.kicks), value: totals.kicks };
      case "lineBreaks":
        return {
          key: def.key,
          label: def.label,
          display: formatInt(totals.lineBreaks),
          value: totals.lineBreaks,
        };
      case "tries":
        return { key: def.key, label: def.label, display: formatInt(totals.tries), value: totals.tries };
      case "tackles":
        return { key: def.key, label: def.label, display: formatInt(totals.tackles), value: totals.tackles };
      case "metres":
        return { key: def.key, label: def.label, display: formatInt(totals.metres), value: totals.metres };
      case "carries":
        return { key: def.key, label: def.label, display: formatInt(totals.carries), value: totals.carries };
      case "turnovers":
        return {
          key: def.key,
          label: def.label,
          display: formatInt(totals.turnovers),
          value: totals.turnovers,
        };
      case "defendersBeaten":
        return {
          key: def.key,
          label: def.label,
          display: formatInt(totals.defendersBeaten),
          value: totals.defendersBeaten,
        };
      default:
        return { key: def.key, label: def.label, display: "—", value: null };
    }
  });
}
