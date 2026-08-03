import type { PublicPlayerProfile } from "./public-player-profile-service";

export type CompareMetric = {
  key: string;
  label: string;
  group: "general" | "attack" | "defence" | "kicking" | "discipline" | "career";
  a: number | null;
  b: number | null;
  higherIsBetter?: boolean;
};

function n(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

export function buildPlayerCompareMetrics(
  playerA: PublicPlayerProfile,
  playerB: PublicPlayerProfile,
): CompareMetric[] {
  const sa = playerA.seasonSnapshot;
  const sb = playerB.seasonSnapshot;

  return [
    {
      key: "rating",
      label: "Overall Rating",
      group: "general",
      a: n(playerA.rating.current),
      b: n(playerB.rating.current),
    },
    {
      key: "age",
      label: "Age",
      group: "general",
      a: n(playerA.age),
      b: n(playerB.age),
      higherIsBetter: false,
    },
    {
      key: "height",
      label: "Height (cm)",
      group: "general",
      a: n(playerA.heightCm),
      b: n(playerB.heightCm),
    },
    {
      key: "weight",
      label: "Weight (kg)",
      group: "general",
      a: n(playerA.weightKg),
      b: n(playerB.weightKg),
    },
    {
      key: "market",
      label: "Market Value (£)",
      group: "general",
      a: n(playerA.playerValue?.marketValueGbp),
      b: n(playerB.playerValue?.marketValueGbp),
    },
    {
      key: "world",
      label: "World Rank",
      group: "general",
      a: n(playerA.rankings?.overallRank),
      b: n(playerB.rankings?.overallRank),
      higherIsBetter: false,
    },
    {
      key: "tries",
      label: "Tries",
      group: "attack",
      a: n(sa?.tries),
      b: n(sb?.tries),
    },
    {
      key: "points",
      label: "Points",
      group: "attack",
      a: n(sa?.points),
      b: n(sb?.points),
    },
    {
      key: "metres",
      label: "Metres",
      group: "attack",
      a: n(sa?.metresCarried),
      b: n(sb?.metresCarried),
    },
    {
      key: "breaks",
      label: "Line breaks",
      group: "attack",
      a: n(sa?.lineBreaks),
      b: n(sb?.lineBreaks),
    },
    {
      key: "beaten",
      label: "Defenders beaten",
      group: "attack",
      a: n(sa?.defendersBeaten),
      b: n(sb?.defendersBeaten),
    },
    {
      key: "assists",
      label: "Try assists",
      group: "attack",
      a: n(sa?.tryAssists),
      b: n(sb?.tryAssists),
    },
    {
      key: "tackles",
      label: "Tackles",
      group: "defence",
      a: n(sa?.tacklesMade),
      b: n(sb?.tacklesMade),
    },
    {
      key: "tackles_c",
      label: "Tackles completed",
      group: "defence",
      a: n(sa?.tacklesCompleted),
      b: n(sb?.tacklesCompleted),
    },
    {
      key: "turnovers",
      label: "Turnovers won",
      group: "defence",
      a: n(sa?.turnoversWon),
      b: n(sb?.turnoversWon),
    },
    {
      key: "apps",
      label: "Appearances",
      group: "career",
      a: n(playerA.career.appearances),
      b: n(playerB.career.appearances),
    },
    {
      key: "career_tries",
      label: "Career tries",
      group: "career",
      a: n(playerA.career.tries),
      b: n(playerB.career.tries),
    },
    {
      key: "career_pts",
      label: "Career points",
      group: "career",
      a: n(playerA.career.points),
      b: n(playerB.career.points),
    },
    {
      key: "caps",
      label: "International caps",
      group: "career",
      a: n(playerA.internationalSummary.caps),
      b: n(playerB.internationalSummary.caps),
    },
    // Placeholder groups so tabs exist even when season kicking/discipline stats are sparse
    {
      key: "kick_pts",
      label: "Season points (proxy)",
      group: "kicking",
      a: n(sa?.points),
      b: n(sb?.points),
    },
    {
      key: "minutes",
      label: "Minutes (availability)",
      group: "discipline",
      a: n(sa?.minutesPlayed),
      b: n(sb?.minutesPlayed),
    },
  ];
}
