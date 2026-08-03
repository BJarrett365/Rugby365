import type { TeamCompareSidePacket } from "./team-squad-intelligence-types";

export type TeamCompareMetricGroup =
  | "summary"
  | "value"
  | "form"
  | "rating"
  | "squad";

export type TeamCompareMetric = {
  key: string;
  label: string;
  group: TeamCompareMetricGroup;
  a: number | null;
  b: number | null;
  higherIsBetter?: boolean;
  format?: "gbp" | "number" | "pct" | "rank";
};

function n(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

export function buildTeamCompareMetrics(
  teamA: TeamCompareSidePacket,
  teamB: TeamCompareSidePacket,
): TeamCompareMetric[] {
  return [
    {
      key: "overall",
      label: "Team Rating",
      group: "summary",
      a: n(teamA.rating.overall),
      b: n(teamB.rating.overall),
      format: "number",
    },
    {
      key: "world",
      label: "World Ranking",
      group: "summary",
      a: n(teamA.worldRank),
      b: n(teamB.worldRank),
      higherIsBetter: false,
      format: "rank",
    },
    {
      key: "trophies",
      label: "Titles",
      group: "summary",
      a: n(teamA.trophyCount),
      b: n(teamB.trophyCount),
      format: "number",
    },
    {
      key: "founded",
      label: "Founded",
      group: "summary",
      a: n(teamA.foundedYear),
      b: n(teamB.foundedYear),
      higherIsBetter: false,
      format: "number",
    },
    {
      key: "squadValue",
      label: "Total Squad Value (£)",
      group: "value",
      a: n(teamA.squadValue.totalSquadValueGbp),
      b: n(teamB.squadValue.totalSquadValueGbp),
      format: "gbp",
    },
    {
      key: "avgValue",
      label: "Average Player Value (£)",
      group: "value",
      a: n(teamA.squadValue.averagePlayerValueGbp),
      b: n(teamB.squadValue.averagePlayerValueGbp),
      format: "gbp",
    },
    {
      key: "xvValue",
      label: "Starting XV Value (£)",
      group: "value",
      a: n(teamA.squadValue.startingXvValueGbp),
      b: n(teamB.squadValue.startingXvValueGbp),
      format: "gbp",
    },
    {
      key: "benchValue",
      label: "Bench Value (£)",
      group: "value",
      a: n(teamA.squadValue.benchValueGbp),
      b: n(teamB.squadValue.benchValueGbp),
      format: "gbp",
    },
    {
      key: "formWin",
      label: "Form Win % (last 10)",
      group: "form",
      a: n(teamA.form.winPct),
      b: n(teamB.form.winPct),
      format: "pct",
    },
    {
      key: "pointsFor",
      label: "Points Scored (last 10)",
      group: "form",
      a: n(teamA.form.pointsFor),
      b: n(teamB.form.pointsFor),
      format: "number",
    },
    {
      key: "pointsAgainst",
      label: "Points Conceded (last 10)",
      group: "form",
      a: n(teamA.form.pointsAgainst),
      b: n(teamB.form.pointsAgainst),
      higherIsBetter: false,
      format: "number",
    },
    {
      key: "squadStrength",
      label: "Squad Strength",
      group: "rating",
      a: n(teamA.rating.components.squadStrength),
      b: n(teamB.rating.components.squadStrength),
      format: "number",
    },
    {
      key: "formComponent",
      label: "Form Rating",
      group: "rating",
      a: n(teamA.rating.components.form),
      b: n(teamB.rating.components.form),
      format: "number",
    },
    {
      key: "valueComponent",
      label: "Value Rating",
      group: "rating",
      a: n(teamA.rating.components.value),
      b: n(teamB.rating.components.value),
      format: "number",
    },
    {
      key: "depth",
      label: "Depth Rating",
      group: "rating",
      a: n(teamA.rating.components.depth),
      b: n(teamB.rating.components.depth),
      format: "number",
    },
    {
      key: "players",
      label: "Squad Size",
      group: "squad",
      a: n(teamA.squadValue.playerCount),
      b: n(teamB.squadValue.playerCount),
      format: "number",
    },
    {
      key: "avgAge",
      label: "Average Age",
      group: "squad",
      a: n(teamA.squadValue.averageAge),
      b: n(teamB.squadValue.averageAge),
      higherIsBetter: false,
      format: "number",
    },
    {
      key: "avgRating",
      label: "Average Player Rating",
      group: "squad",
      a: n(teamA.squadValue.averageRating),
      b: n(teamB.squadValue.averageRating),
      format: "number",
    },
  ];
}
