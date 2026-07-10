import {
  nationsChampionshipHemisphereForTeam,
  nationsChampionshipHemisphereLabel,
} from "../nations-championship-hemisphere";
import type {
  RugbyTableDefinition,
  RugbyTableHemisphereGroup,
  RugbyTableStandingRow,
} from "./table-types";

function sortHemisphereRows(
  rows: RugbyTableStandingRow[],
  definition: RugbyTableDefinition,
): RugbyTableStandingRow[] {
  const sortByMetric = Boolean(definition.metricLabel);
  const sortAscending =
    definition.id === "missed_tackles" ||
    definition.id === "penalties_conceded" ||
    definition.id === "yellow_cards" ||
    definition.id === "red_cards" ||
    definition.id === "cards_per_match" ||
    definition.id === "discipline_score" ||
    definition.id === "tries_conceded" ||
    definition.id === "tries_conceded_defence" ||
    definition.id === "points_conceded" ||
    definition.id === "lineout_lost" ||
    definition.id === "scrum_penalties_conceded";

  const sorted = [...rows].sort((a, b) => {
    if (sortByMetric) {
      const av = Number(a.metricValue ?? 0);
      const bv = Number(b.metricValue ?? 0);
      if (av !== bv) return sortAscending ? av - bv : bv - av;
    }
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return b.pointsFor - a.pointsFor;
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function splitRowsByHemisphere(
  rows: RugbyTableStandingRow[],
  definition: RugbyTableDefinition,
): RugbyTableHemisphereGroup[] {
  const northern: RugbyTableStandingRow[] = [];
  const southern: RugbyTableStandingRow[] = [];

  for (const row of rows) {
    const hemisphere = nationsChampionshipHemisphereForTeam(row.teamName);
    if (hemisphere === "northern") northern.push(row);
    else if (hemisphere === "southern") southern.push(row);
  }

  const groups: RugbyTableHemisphereGroup[] = [];
  if (northern.length > 0) {
    groups.push({
      hemisphere: "northern",
      label: nationsChampionshipHemisphereLabel("northern"),
      rows: sortHemisphereRows(northern, definition),
    });
  }
  if (southern.length > 0) {
    groups.push({
      hemisphere: "southern",
      label: nationsChampionshipHemisphereLabel("southern"),
      rows: sortHemisphereRows(southern, definition),
    });
  }

  return groups;
}
