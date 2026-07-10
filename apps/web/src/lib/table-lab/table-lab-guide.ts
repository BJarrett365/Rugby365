export type TableLabGuideSection = {
  id: string;
  title: string;
  body: string[];
};

export const TABLE_LAB_COLUMN_GLOSSARY: Array<{ code: string; name: string; description: string }> = [
  { code: "P", name: "Played", description: "Completed matches included in the table scope." },
  { code: "W", name: "Won", description: "Matches won under competition scoring rules." },
  { code: "D", name: "Drawn", description: "Matches drawn." },
  { code: "L", name: "Lost", description: "Matches lost." },
  { code: "PF", name: "Points for", description: "Total points scored." },
  { code: "PA", name: "Points against", description: "Total points conceded." },
  { code: "PD", name: "Points difference", description: "Points for minus points against." },
  {
    code: "TF",
    name: "Tries for",
    description: "Tries scored. Shown when try data is available from team match stats.",
  },
  {
    code: "TA",
    name: "Tries against",
    description: "Tries conceded. Shown when try data is available from team match stats.",
  },
  {
    code: "TBP",
    name: "Try bonus points",
    description: "Try bonus points earned under the competition scoring rules. Shown when rules or data support it.",
  },
  {
    code: "LBP",
    name: "Losing bonus points",
    description: "Losing bonus points within the competition margin. Shown when rules or data support it.",
  },
  { code: "BP", name: "Bonus points", description: "Total bonus points (try bonus + losing bonus)." },
  { code: "Pts", name: "League points", description: "Competition table points including bonuses." },
  { code: "Win%", name: "Win percentage", description: "Wins divided by played, as a percentage." },
];

export const TABLE_LAB_GUIDE_SECTIONS: TableLabGuideSection[] = [
  {
    id: "overview",
    title: "What Table Lab does",
    body: [
      "Table Lab builds rugby-specific league and performance tables from imported fixtures, final scores, match events and SDMS team stats.",
      "Tables never invent data. Each result shows confidence, fixture coverage and warnings when inputs are missing.",
    ],
  },
  {
    id: "columns",
    title: "Column guide",
    body: [
      "Standard league tables share a common column set. TF, TA, TBP and LBP appear only when the underlying data or competition rules support them.",
      "Use the glossary below when reading exports or comparing Full, Form and Hemisphere tables.",
    ],
  },
  {
    id: "confidence",
    title: "Data confidence",
    body: [
      "High — required inputs are present for the selected scope (e.g. all teams have hemisphere values, scores complete, tries available where expected).",
      "Medium — partial gaps such as unknown hemisphere teams or missing try stats.",
      "Low — major missing inputs or no rows could be built.",
      "Unavailable — the table type cannot be calculated for the current filters.",
    ],
  },
  {
    id: "filters",
    title: "Common filters",
    body: [
      "Competition and season define the fixture pool.",
      "Full and Form tables support All / Home / Away views.",
      "Form table uses each team's last N completed matches (venue filter applied before slicing).",
      "Hemisphere table adds match type, neutral venue, include-unknown and summary vs breakdown modes.",
    ],
  },
  {
    id: "admin",
    title: "Admin preparation",
    body: [
      "Import fixtures and final scores for the competition season.",
      "Import SDMS team match stats for tries and detailed metrics.",
      "Set team hemisphere, country, region and team type in team admin for Hemisphere tables.",
      "Sync standing rows where a table definition lists standing_rows as a data source.",
    ],
  },
];

export const TABLE_LAB_CATEGORY_LABELS: Record<string, string> = {
  standard: "Standard Tables",
  match_period: "Match period",
  opposition: "Opposition",
  game_state: "Game state",
  rugby_scoring: "Rugby scoring",
  set_piece: "Set piece",
  attack: "Attack",
  defence: "Defence",
  possession_territory: "Possession & territory",
  discipline: "Discipline",
};
