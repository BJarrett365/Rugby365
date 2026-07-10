import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildFinalTwentyTableStandings,
  finalTwentyCalculationNote,
  finalTwentyCoverageLabel,
  finalTwentyScoresFromEvents,
  isExtraTimeEvent,
  isFinalTwentyScoringEvent,
  resolveFinalTwentyScores,
  scoreAtSixtyFromSnapshot,
} from "./final-twenty-minutes-table-service";
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
    finalTwentyFor: 11,
    finalTwentyAgainst: 12,
    finalTwentyTriesFor: 1,
    finalTwentyTriesAgainst: 2,
    scoreAtSixtyFor: 20,
    scoreAtSixtyAgainst: 17,
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

describe("final 20 minutes table", () => {
  const rules = scoringRulesForCompetitionSlug("premiership");

  it("maps type=final-20-minutes-table route param to final_20_minutes id", () => {
    expect(tableIdFromTypeParam("final-20-minutes-table")).toBe("final_20_minutes");
  });

  it("includes scoring events from minute 60 onward", () => {
    expect(
      isFinalTwentyScoringEvent(
        { eventType: "try", teamId: "home", minute: 60, payload: { points: 5 } },
        false,
      ),
    ).toBe(true);
    expect(
      isFinalTwentyScoringEvent(
        { eventType: "try", teamId: "home", minute: 59, payload: { points: 5 } },
        false,
      ),
    ).toBe(false);
  });

  it("includes added-time scoring before extra time", () => {
    const scores = finalTwentyScoresFromEvents({
      events: [
        { eventType: "try", teamId: "away", minute: 78, payload: { points: 5, period: "second_half" } },
        { eventType: "conversion", teamId: "away", minute: 79, payload: { points: 2 } },
      ],
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(scores).toEqual({ homeScore: 0, awayScore: 7 });
  });

  it("excludes extra-time scoring by default", () => {
    const event = {
      eventType: "try",
      teamId: "home",
      minute: 85,
      payload: { points: 5, period: "extra_time" },
    };
    expect(isExtraTimeEvent(event)).toBe(true);
    expect(isFinalTwentyScoringEvent(event, false)).toBe(false);

    const scores = finalTwentyScoresFromEvents({
      events: [event],
      homeTeamId: "home",
      awayTeamId: "away",
    });
    expect(scores).toBeNull();
  });

  it("can include extra-time scoring when enabled", () => {
    const scores = finalTwentyScoresFromEvents({
      events: [
        {
          eventType: "try",
          teamId: "home",
          minute: 85,
          payload: { points: 5, period: "extra_time" },
        },
      ],
      homeTeamId: "home",
      awayTeamId: "away",
      includeExtraTime: true,
    });
    expect(scores).toEqual({ homeScore: 5, awayScore: 0 });
  });

  it("derives final 20 score from verified score at 60 and full-time", () => {
    const events = [
      {
        eventType: "score_at_60",
        teamId: null,
        minute: 60,
        payload: { homeScore: 20, awayScore: 17 },
      },
    ];
    expect(scoreAtSixtyFromSnapshot(events)).toEqual({ homeScore: 20, awayScore: 17 });

    const resolved = resolveFinalTwentyScores({
      events,
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 31,
      awayFullScore: 29,
    });
    expect(resolved.homeScore).toBe(11);
    expect(resolved.awayScore).toBe(12);
    expect(resolved.source).toBe("derived");
  });

  it("uses Northampton v Exeter final 20 result not full-time", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Northampton Saints",
        side: "home",
        finalTwentyFor: 11,
        finalTwentyAgainst: 12,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        finalTwentyFor: 12,
        finalTwentyAgainst: 11,
      }),
    ];
    const built = buildFinalTwentyTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    const northampton = built.rows.find((row) => row.teamId === "t1");
    const exeter = built.rows.find((row) => row.teamId === "t2");
    expect(northampton?.lost).toBe(1);
    expect(northampton?.pointsFor).toBe(11);
    expect(exeter?.won).toBe(1);
    expect(exeter?.pointsFor).toBe(12);
  });

  it("does not guess final 20 scores without events or verified score at 60", () => {
    const resolved = resolveFinalTwentyScores({
      events: [],
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 31,
      awayFullScore: 29,
    });
    expect(resolved.homeScore).toBeNull();
    expect(resolved.awayScore).toBeNull();
  });

  it("prefers event timeline over derived fallback", () => {
    const resolved = resolveFinalTwentyScores({
      events: [
        {
          eventType: "score_at_60",
          teamId: null,
          minute: 60,
          payload: { homeScore: 20, awayScore: 17 },
        },
        { eventType: "try", teamId: "home", minute: 60, payload: { points: 5 } },
        { eventType: "try", teamId: "away", minute: 70, payload: { points: 5 } },
      ],
      homeTeamId: "home",
      awayTeamId: "away",
      homeFullScore: 31,
      awayFullScore: 29,
    });
    expect(resolved.source).toBe("events");
    expect(resolved.homeScore).toBe(5);
    expect(resolved.awayScore).toBe(5);
  });

  it("filters home and away views", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        finalTwentyFor: 12,
        finalTwentyAgainst: 6,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        finalTwentyFor: 6,
        finalTwentyAgainst: 12,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        finalTwentyFor: 3,
        finalTwentyAgainst: 9,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        finalTwentyFor: 9,
        finalTwentyAgainst: 3,
      }),
    ];
    const home = buildFinalTwentyTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "home",
    });
    expect(home.rows.find((row) => row.teamId === "t1")?.played).toBe(1);

    const away = buildFinalTwentyTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "away",
    });
    expect(away.rows.find((row) => row.teamId === "t1")?.played).toBe(1);
  });

  it("excludes matches without final 20 data and reports coverage", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        side: "home",
        finalTwentyFor: 11,
        finalTwentyAgainst: 12,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        side: "away",
        finalTwentyFor: 12,
        finalTwentyAgainst: 11,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t1",
        side: "away",
        finalTwentyFor: null,
        finalTwentyAgainst: null,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        side: "home",
        finalTwentyFor: null,
        finalTwentyAgainst: null,
      }),
    ];
    const built = buildFinalTwentyTableStandings({
      perspectives: fixtures,
      rules,
      tableView: "all",
    });
    expect(built.finalTwentyMatchCount).toBe(1);
    expect(built.completedMatchCount).toBe(2);
    expect(built.coverageLabel).toBe(finalTwentyCoverageLabel(1, 2));
  });

  it("sorts by table points then wins then points difference", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "t1",
        teamName: "Bath",
        side: "home",
        finalTwentyFor: 17,
        finalTwentyAgainst: 10,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Saracens",
        side: "away",
        finalTwentyFor: 10,
        finalTwentyAgainst: 17,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t3",
        teamName: "Harlequins",
        side: "home",
        finalTwentyFor: 24,
        finalTwentyAgainst: 14,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t4",
        teamName: "Gloucester",
        side: "away",
        finalTwentyFor: 14,
        finalTwentyAgainst: 24,
      }),
    ];
    const built = buildFinalTwentyTableStandings({
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

  it("shows enhanced try columns when period try data exists", () => {
    const built = buildFinalTwentyTableStandings({
      perspectives: [
        perspective({
          fixtureId: "f1",
          teamId: "t1",
          side: "home",
          finalTwentyFor: 11,
          finalTwentyAgainst: 12,
          finalTwentyTriesFor: 1,
          finalTwentyTriesAgainst: 2,
        }),
        perspective({
          fixtureId: "f1",
          teamId: "t2",
          side: "away",
          finalTwentyFor: 12,
          finalTwentyAgainst: 11,
          finalTwentyTriesFor: 2,
          finalTwentyTriesAgainst: 1,
        }),
      ],
      rules,
      tableView: "all",
    });
    expect(leagueTableOptionalColumns(built.rows).showTfTa).toBe(true);
  });

  it("exposes calculation note", () => {
    expect(finalTwentyCalculationNote()).toContain("60 minutes");
  });
});
