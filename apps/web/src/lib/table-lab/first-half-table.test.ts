import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildFirstHalfTableStandings,
  firstHalfCalculationNote,
  firstHalfCoverageLabel,
  firstHalfScoresFromEvents,
  firstHalfTriesFromEvents,
  resolveFirstHalfScores,
} from "./first-half-table-service";
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
    firstHalfTriesFor: 2,
    firstHalfTriesAgainst: 1,
    secondHalfFor: 14,
    secondHalfAgainst: 19,
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

describe("first half table", () => {
  const rules = scoringRulesForCompetitionSlug("premiership");

  it("maps type=first-half-table route param to first_half id", () => {
    expect(tableIdFromTypeParam("first-half-table")).toBe("first_half");
  });

  it("uses verified half-time scores when available", () => {
    const resolved = resolveFirstHalfScores({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [
        {
          eventType: "half_time",
          teamId: null,
          minute: 40,
          payload: { homeScore: 17, awayScore: 10 },
        },
      ],
    });
    expect(resolved.homeScore).toBe(17);
    expect(resolved.awayScore).toBe(10);
    expect(resolved.source).toBe("verified");
  });

  it("calculates half-time score from scoring events up to minute 40", () => {
    const events = [
      { eventType: "try", teamId: "home", minute: 12, payload: { points: 5 } },
      { eventType: "conversion", teamId: "home", minute: 13, payload: { points: 2 } },
      { eventType: "penalty", teamId: "away", minute: 25, payload: { points: 3 } },
      { eventType: "try", teamId: "away", minute: 55, payload: { points: 5 } },
    ];
    const scores = firstHalfScoresFromEvents({
      events,
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(scores).toEqual({ homeScore: 7, awayScore: 3 });

    const resolved = resolveFirstHalfScores({
      events,
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(resolved.homeScore).toBe(7);
    expect(resolved.awayScore).toBe(3);
    expect(resolved.source).toBe("calculated");
  });

  it("counts first-half tries from events", () => {
    const tries = firstHalfTriesFromEvents({
      events: [
        { eventType: "try", teamId: "home", minute: 10, payload: {} },
        { eventType: "try", teamId: "home", minute: 35, payload: {} },
        { eventType: "try", teamId: "away", minute: 50, payload: {} },
      ],
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(tries.homeTries).toBe(2);
    expect(tries.awayTries).toBe(0);
  });

  it("does not guess half-time scores from full-time results", () => {
    const resolved = resolveFirstHalfScores({
      events: [],
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(resolved.homeScore).toBeNull();
    expect(resolved.awayScore).toBeNull();
    expect(resolved.source).toBeNull();
  });

  it("treats half-time home win using half-time score not full-time", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Northampton Saints",
        side: "home",
        firstHalfFor: 17,
        firstHalfAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        firstHalfFor: 10,
        firstHalfAgainst: 17,
      }),
    ];
    const built = buildFirstHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    const northampton = built.rows.find((row) => row.teamId === "t1");
    const exeter = built.rows.find((row) => row.teamId === "t2");
    expect(northampton?.won).toBe(1);
    expect(northampton?.pointsFor).toBe(17);
    expect(northampton?.pointsAgainst).toBe(10);
    expect(exeter?.lost).toBe(1);
    expect(exeter?.pointsFor).toBe(10);
    expect(exeter?.pointsAgainst).toBe(17);
  });

  it("handles half-time draw", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        firstHalfFor: 10,
        firstHalfAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        firstHalfFor: 10,
        firstHalfAgainst: 10,
      }),
    ];
    const built = buildFirstHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    expect(built.rows.every((row) => row.drawn === 1)).toBe(true);
  });

  it("handles half-time away win in away view", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "away",
        firstHalfFor: 14,
        firstHalfAgainst: 7,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "home",
        firstHalfFor: 7,
        firstHalfAgainst: 14,
      }),
    ];
    const built = buildFirstHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "away",
    });
    expect(built.rows).toHaveLength(1);
    expect(built.rows[0]?.teamName).toBe("Bath");
    expect(built.rows[0]?.won).toBe(1);
  });

  it("filters home view to home matches only", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        firstHalfFor: 12,
        firstHalfAgainst: 6,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        firstHalfFor: 6,
        firstHalfAgainst: 12,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        firstHalfFor: 3,
        firstHalfAgainst: 9,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        firstHalfFor: 9,
        firstHalfAgainst: 3,
      }),
    ];
    const built = buildFirstHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "home",
    });
    const bath = built.rows.find((row) => row.teamId === "t1");
    expect(bath?.played).toBe(1);
    expect(bath?.pointsFor).toBe(12);
  });

  it("excludes matches without half-time data", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        firstHalfFor: 12,
        firstHalfAgainst: 6,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        firstHalfFor: 6,
        firstHalfAgainst: 12,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        firstHalfFor: null,
        firstHalfAgainst: null,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        firstHalfFor: null,
        firstHalfAgainst: null,
      }),
    ];
    const built = buildFirstHalfTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    const bath = built.rows.find((row) => row.teamId === "t1");
    expect(bath?.played).toBe(1);
    expect(built.firstHalfMatchCount).toBe(1);
    expect(built.completedMatchCount).toBe(2);
    expect(built.coverageLabel).toBe(firstHalfCoverageLabel(1, 2));
  });

  it("only awards bonus points when first-half try data exists", () => {
    const withTries = buildFirstHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          firstHalfFor: 28,
          firstHalfAgainst: 24,
          firstHalfTriesFor: 4,
          firstHalfTriesAgainst: 2,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          firstHalfFor: 24,
          firstHalfAgainst: 28,
          firstHalfTriesFor: 2,
          firstHalfTriesAgainst: 4,
        }),
      ],
      rules,
      tableView: "all",
    });
    const withData = withTries.rows.find((row) => row.teamId === "t1");
    expect(withData?.tryBonusPoints).toBe(1);

    const withoutTries = buildFirstHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          firstHalfFor: 28,
          firstHalfAgainst: 24,
          firstHalfTriesFor: null,
          firstHalfTriesAgainst: null,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          firstHalfFor: 24,
          firstHalfAgainst: 28,
          firstHalfTriesFor: null,
          firstHalfTriesAgainst: null,
        }),
      ],
      rules,
      tableView: "all",
    });
    const noBonus = withoutTries.rows.find((row) => row.teamId === "t1");
    expect(noBonus?.tryBonusPoints ?? 0).toBe(0);
    expect(noBonus?.bonusPoints).toBe(0);
  });

  it("sorts by table points then wins then first-half points difference", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        firstHalfFor: 17,
        firstHalfAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        firstHalfFor: 10,
        firstHalfAgainst: 17,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Harlequins",
        side: "home",
        firstHalfFor: 24,
        firstHalfAgainst: 14,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t4",
        teamName: "Gloucester",
        side: "away",
        firstHalfFor: 14,
        firstHalfAgainst: 24,
      }),
    ];
    const built = buildFirstHalfTableStandings({
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

  it("shows enhanced try columns when first-half try data exists", () => {
    const built = buildFirstHalfTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          firstHalfFor: 17,
          firstHalfAgainst: 10,
          firstHalfTriesFor: 2,
          firstHalfTriesAgainst: 1,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          firstHalfFor: 10,
          firstHalfAgainst: 17,
          firstHalfTriesFor: 1,
          firstHalfTriesAgainst: 2,
        }),
      ],
      rules,
      tableView: "all",
    });
    expect(leagueTableOptionalColumns(built.rows).showTfTa).toBe(true);
  });

  it("exposes calculation note", () => {
    expect(firstHalfCalculationNote()).toContain("half-time score");
  });
});
