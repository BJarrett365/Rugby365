import { describe, expect, it } from "vitest";
import { buildTryBonusPointStandings } from "./try-bonus-point-table-service";
import { DEFAULT_PREMIERSHIP_SCORING_RULES } from "./table-types";
import type { TeamFixturePerspective } from "./table-types";

function perspective(
  fixtureId: string,
  teamId: string,
  teamName: string,
  triesFor: number | null,
  side: "home" | "away" = "home",
): TeamFixturePerspective {
  return {
    fixtureId,
    kickoffAt: new Date("2025-01-10T15:00:00.000Z"),
    teamId,
    teamName,
    opponentId: "opp",
    opponentName: "Opponent",
    side,
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor,
    triesAgainst: 2,
    firstHalfFor: null,
    firstHalfAgainst: null,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: null,
    concededFirst: null,
    wasWinning: null,
    wasLosing: null,
    wasDrawn: null,
    possessionPct: null,
    territoryPct: null,
    lineoutsWon: null,
    lineoutsLost: null,
    scrumSuccessPct: null,
    scrumPenaltiesWon: null,
    scrumPenaltiesConceded: null,
    carries: null,
    metres: null,
    lineBreaks: null,
    defendersBeaten: null,
    postContactMetres: null,
    tryAssists: null,
    turnoversWon: null,
    tacklesMade: null,
    tacklesCompleted: null,
    dominantTackles: null,
    missedTackles: null,
    penaltiesConceded: null,
    yellowCards: 0,
    redCards: 0,
    opponentLeagueRank: null,
  };
}

describe("try bonus point table", () => {
  it("does not count matches when triesFor is null", () => {
    const perspectives = [
      perspective("f1", "bath", "Bath", null),
      perspective("f1", "opp", "Opponent", null, "away"),
      perspective("f2", "bath", "Bath", null),
      perspective("f2", "opp", "Opponent", null, "away"),
    ];

    const built = buildTryBonusPointStandings({
      perspectives,
      rules: DEFAULT_PREMIERSHIP_SCORING_RULES,
    });

    expect(built.seasonFixtureCount).toBe(2);
    expect(built.qualifyingFixtureCount).toBe(0);
    expect(built.rows).toHaveLength(0);
  });

  it("uses competition try bonus threshold and counts only verified try matches", () => {
    const perspectives = [
      perspective("f1", "bath", "Bath", 4),
      perspective("f1", "opp", "Opponent", 1, "away"),
      perspective("f2", "bath", "Bath", 2),
      perspective("f2", "opp", "Opponent", 3, "away"),
    ];

    const built = buildTryBonusPointStandings({
      perspectives,
      rules: DEFAULT_PREMIERSHIP_SCORING_RULES,
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(2);
    expect(bath?.leaguePoints).toBe(1);
    expect(bath?.metricValue).toBe(1);
  });
});
