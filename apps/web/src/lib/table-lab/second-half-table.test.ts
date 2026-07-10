import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildSecondHalfTableStandings,
  resolveSecondHalfScores,
  secondHalfCalculationNote,
  secondHalfCoverageLabel,
  secondHalfScoresFromEvents,
} from "./second-half-table-service";
import { leagueTableOptionalColumns } from "./table-lab-column-utils";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
    teamId: "t1",
    teamName: "Northampton Saints",
    opponentId: "t2",
    opponentName: "Exeter Chiefs",
    side: "home",
    pointsFor: 31,
    pointsAgainst: 29,
    triesFor: 4,
    triesAgainst: 3,
    firstHalfFor: 17,
    firstHalfAgainst: 10,
    secondHalfFor: 14,
    secondHalfAgainst: 19,
    secondHalfTriesFor: 2,
    secondHalfTriesAgainst: 3,
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
    ...overrides,
  };
}

describe("second half table", () => {
  const rules = scoringRulesForCompetitionSlug("premiership");

  it("maps type=second-half-table route param to second_half id", () => {
    expect(tableIdFromTypeParam("second-half-table")).toBe("second_half");
  });

  it("derives second-half scores from full-time minus half-time", () => {
    const resolved = resolveSecondHalfScores({
      events: [],
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 31,
      awayFullScore: 29,
      firstHalfHome: 17,
      firstHalfAway: 10,
    });
    expect(resolved.homeScore).toBe(14);
    expect(resolved.awayScore).toBe(19);
    expect(resolved.source).toBe("derived");
  });

  it("calculates second-half scores from events after minute 40 when half-time is missing", () => {
    const events = [
      { eventType: "try", teamId: "away", minute: 55, payload: { points: 5 } },
      { eventType: "conversion", teamId: "away", minute: 56, payload: { points: 2 } },
      { eventType: "penalty", teamId: "home", minute: 12, payload: { points: 3 } },
    ];
    const scores = secondHalfScoresFromEvents({
      events,
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(scores).toEqual({ homeScore: 0, awayScore: 7 });

    const resolved = resolveSecondHalfScores({
      events,
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 3,
      awayFullScore: 7,
      firstHalfHome: null,
      firstHalfAway: null,
    });
    expect(resolved.homeScore).toBe(0);
    expect(resolved.awayScore).toBe(7);
    expect(resolved.source).toBe("calculated");
  });

  it("does not guess second-half scores from full-time alone", () => {
    const resolved = resolveSecondHalfScores({
      events: [],
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 31,
      awayFullScore: 29,
      firstHalfHome: null,
      firstHalfAway: null,
    });
    expect(resolved.homeScore).toBeNull();
    expect(resolved.awayScore).toBeNull();
  });

  it("uses second-half result not full-time for Northampton v Exeter example", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Northampton Saints",
        side: "home",
        pointsFor: 31,
        pointsAgainst: 29,
        secondHalfFor: 14,
        secondHalfAgainst: 19,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        pointsFor: 29,
        pointsAgainst: 31,
        secondHalfFor: 19,
        secondHalfAgainst: 14,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    const northampton = built.rows.find((row) => row.teamId === "t1");
    const exeter = built.rows.find((row) => row.teamId === "t2");
    expect(northampton?.lost).toBe(1);
    expect(northampton?.pointsFor).toBe(14);
    expect(exeter?.won).toBe(1);
    expect(exeter?.pointsFor).toBe(19);
  });

  it("handles second-half draw", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        secondHalfFor: 10,
        secondHalfAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        secondHalfFor: 10,
        secondHalfAgainst: 10,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    expect(built.rows.every((row) => row.drawn === 1)).toBe(true);
  });

  it("handles second-half away win in away view", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        secondHalfFor: 17,
        secondHalfAgainst: 7,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "home",
        secondHalfFor: 7,
        secondHalfAgainst: 17,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "away",
    });
    expect(built.rows).toHaveLength(1);
    expect(built.rows[0]?.won).toBe(1);
  });

  it("filters home view to home matches only", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        secondHalfFor: 12,
        secondHalfAgainst: 6,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        secondHalfFor: 6,
        secondHalfAgainst: 12,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        secondHalfFor: 3,
        secondHalfAgainst: 9,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        secondHalfFor: 9,
        secondHalfAgainst: 3,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "home",
    });
    const bath = built.rows.find((row) => row.teamId === "t1");
    expect(bath?.played).toBe(1);
    expect(bath?.pointsFor).toBe(12);
  });

  it("excludes matches without second-half data", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        secondHalfFor: 12,
        secondHalfAgainst: 6,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        secondHalfFor: 6,
        secondHalfAgainst: 12,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        secondHalfFor: null,
        secondHalfAgainst: null,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        secondHalfFor: null,
        secondHalfAgainst: null,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    expect(built.rows.find((row) => row.teamId === "t1")?.played).toBe(1);
    expect(built.secondHalfMatchCount).toBe(1);
    expect(built.completedMatchCount).toBe(2);
    expect(built.coverageLabel).toBe(secondHalfCoverageLabel(1, 2));
  });

  it("only awards bonus points when second-half try data exists", () => {
    const withTries = buildSecondHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          secondHalfFor: 28,
          secondHalfAgainst: 24,
          secondHalfTriesFor: 4,
          secondHalfTriesAgainst: 2,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          secondHalfFor: 24,
          secondHalfAgainst: 28,
          secondHalfTriesFor: 2,
          secondHalfTriesAgainst: 4,
        }),
      ],
      rules,
      tableView: "all",
    });
    expect(withTries.rows.find((row) => row.teamId === "t1")?.tryBonusPoints).toBe(1);

    const withoutTries = buildSecondHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          secondHalfFor: 28,
          secondHalfAgainst: 24,
          secondHalfTriesFor: null,
          secondHalfTriesAgainst: null,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          secondHalfFor: 24,
          secondHalfAgainst: 28,
          secondHalfTriesFor: null,
          secondHalfTriesAgainst: null,
        }),
      ],
      rules,
      tableView: "all",
    });
    const noBonus = withoutTries.rows.find((row) => row.teamId === "t1");
    expect(noBonus?.tryBonusPoints ?? 0).toBe(0);
    expect(noBonus?.bonusPoints).toBe(0);
  });

  it("sorts by table points then wins then second-half points difference", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        secondHalfFor: 17,
        secondHalfAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        secondHalfFor: 10,
        secondHalfAgainst: 17,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Harlequins",
        side: "home",
        secondHalfFor: 24,
        secondHalfAgainst: 14,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t4",
        teamName: "Gloucester",
        side: "away",
        secondHalfFor: 14,
        secondHalfAgainst: 24,
      }),
    ];
    const built = buildSecondHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    expect(built.rows.map((row) => row.teamName)).toEqual([
      "Harlequins",
      "Bath",
      "Saracens",
      "Gloucester",
    ]);
  });

  it("shows enhanced try columns when second-half try data exists", () => {
    const built = buildSecondHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          secondHalfFor: 17,
          secondHalfAgainst: 10,
          secondHalfTriesFor: 2,
          secondHalfTriesAgainst: 1,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          secondHalfFor: 10,
          secondHalfAgainst: 17,
          secondHalfTriesFor: 1,
          secondHalfTriesAgainst: 2,
        }),
      ],
      rules,
      tableView: "all",
    });
    expect(leagueTableOptionalColumns(built.rows).showTfTa).toBe(true);
  });

  it("exposes calculation note", () => {
    expect(secondHalfCalculationNote()).toContain("second-half scores");
  });
});
