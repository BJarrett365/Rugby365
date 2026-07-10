import type { RugbyTableView } from "./table-types";

export function tableIdFromTypeParam(type: string | null | undefined): string | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "calendar_year_table") return "calendar_year";
  if (normalized === "table_on_this_date") return "on_this_date";
  if (normalized === "table_between_dates") return "between_dates";
  if (normalized === "first_half_table") return "first_half";
  if (normalized === "second_half_table") return "second_half";
  if (normalized === "final_20_minutes_table") return "final_20_minutes";
  if (normalized === "live_table") return "live_table";
  if (normalized === "table_v_top_half" || normalized === "v_top_half") return "v_top_half";
  if (normalized === "table_v_bottom_half" || normalized === "v_bottom_half") return "v_bottom_half";
  if (normalized === "table_when_scoring_first" || normalized === "scoring_first") {
    return "scoring_first";
  }
  if (normalized === "table_when_conceding_first" || normalized === "conceding_first") {
    return "conceding_first";
  }
  if (
    normalized === "points_gained_from_losing_positions" ||
    normalized === "points_gained_losing"
  ) {
    return "points_gained_losing";
  }
  if (
    normalized === "points_lost_from_winning_positions" ||
    normalized === "points_lost_winning"
  ) {
    return "points_lost_winning";
  }
  if (normalized === "comeback_table" || normalized === "comeback") {
    return "comeback";
  }
  if (normalized === "lead_protection_table" || normalized === "lead_protection") {
    return "lead_protection";
  }
  if (normalized === "tries_scored_table" || normalized === "tries_scored") {
    return "tries_scored";
  }
  if (normalized === "tries_conceded_table" || normalized === "tries_conceded") {
    return "tries_conceded";
  }
  if (
    normalized === "winning_bonus_points_table" ||
    normalized === "winning_bonus_points"
  ) {
    return "winning_bonus_points";
  }
  return normalized || null;
}

export function tableViewLabel(view: RugbyTableView): string {
  if (view === "home") return "Home";
  if (view === "away") return "Away";
  if (view === "neutral") return "Neutral";
  return "All";
}

export function standingViewForTableView(view: RugbyTableView): "overall" | "home" | "away" {
  if (view === "home") return "home";
  if (view === "away") return "away";
  return "overall";
}

export function exportStandingsCsv(
  rows: Array<Record<string, string | number | null | undefined>>,
  headers: Array<{ key: string; label: string }>,
): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [
    headers.map((header) => escape(header.label)).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header.key])).join(",")),
  ];
  return lines.join("\n");
}
