export const LEGEND_LEVELS = [
  "club_legend",
  "competition_legend",
  "international_legend",
  "rugby_icon",
  "hall_of_fame",
] as const;

export type LegendLevel = (typeof LEGEND_LEVELS)[number];

export const LEGEND_LEVEL_LABELS: Record<LegendLevel, string> = {
  club_legend: "Club Legend",
  competition_legend: "Competition Legend",
  international_legend: "International Legend",
  rugby_icon: "Rugby Icon",
  hall_of_fame: "Hall of Fame",
};

export const LEGEND_STATUSES = ["active", "inactive"] as const;
export type LegendStatus = (typeof LEGEND_STATUSES)[number];

export function legendLevelLabel(level: string): string {
  return LEGEND_LEVEL_LABELS[level as LegendLevel] ?? level.replace(/_/g, " ");
}

export function normalizeLegendLevel(level: string): LegendLevel {
  const normalized = level.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if ((LEGEND_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as LegendLevel;
  }
  if (normalized.includes("hall")) return "hall_of_fame";
  if (normalized.includes("icon")) return "rugby_icon";
  if (normalized.includes("international")) return "international_legend";
  if (normalized.includes("competition")) return "competition_legend";
  return "club_legend";
}
