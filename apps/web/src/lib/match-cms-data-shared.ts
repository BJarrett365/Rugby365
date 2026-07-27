/** Client-safe constants/types for Match CMS editors (no DB imports). */

export const TEAM_STAT_METRIC_KEYS = [
  "tries",
  "conversions",
  "penalties",
  "dropGoals",
  "carries",
  "metres",
  "tackles",
  "turnoversWon",
  "offloads",
  "clean_breaks",
  "defenders_beaten",
  "passes",
  "kicks_from_hand",
  "missed_tackles",
] as const;

export type TeamStatMetricKey = (typeof TEAM_STAT_METRIC_KEYS)[number];

export const TEAM_STAT_SCOPES = ["Total", "1H", "2H", "ET"] as const;
export type TeamStatScope = (typeof TEAM_STAT_SCOPES)[number];

export type TeamStatPairRow = {
  type: string;
  label: string;
  scope: TeamStatScope | string;
  home: number;
  away: number;
};

export const SCORING_EVENT_TYPES = [
  "try",
  "conversion",
  "missed_conversion",
  "penalty",
  "drop_goal",
] as const;
export const CARD_EVENT_TYPES = ["yellow_card", "red_card"] as const;

/** Television Match Official / fourth-official review actions (CMS + public animation). */
export const TMO_EVENT_TYPES = ["tmo_review", "tmo_decision", "tmo_overturned"] as const;
