import { describe, expect, it } from "vitest";
import { scoringRulesForCompetitionSlug } from "./competition-scoring-rules";
import {
  buildLeadProtectionTableStandings,
  sortLeadProtectionRows,
} from "./lead-protection-table-service";
import { resolveFixtureLosingPositionState } from "./losing-position-utils";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2026-01-10T15:00:00.000Z"),
    teamId: "t1",
    teamName: "Bath",
    opponentId: "t2",
    opponentName: "Exeter Chiefs",
    side: "home",
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor: 4,
    triesAgainst: 2,
    firstHalfFor: 10,
    firstHalfAgainst: 7,
    secondHalfFor: null,
    secondHalfAgainst: null,
    finalTwentyFor: null,
    finalTwentyAgainst: null,
    scoredFirst: true,
    concededFirst: false,
    everLeading: true,
    aheadAtHalfTime: true,
    aheadAfterSixty: true,
    scoreTimelineVerified: true,
    halfTimeScoreVerified: true,
    sixtyMinuteScoreVerified: true,
    minuteFirstAhead: 8,
    maxLeadMargin: 7,
    latestLeadLostMinute: null,
    wasWinning: true,
    wasLosing: false,
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

describe("lead protection table", () => {
  it("maps route param to lead_protection id", () => {
    expect(tableIdFromTypeParam("lead-protection-table")).toBe("lead_protection");
  });

  it("tracks largest lead across multiple leading phases", () => {
    const state = resolveFixtureLosingPositionState({
      homeTeamId: "home",
      awayTeamId: "away",
      events: [
        { eventType: "penalty", teamId: "home", minute: 5, payload: { points: 3 } },
        { eventType: "try", teamId: "home", minute: 20, payload: { points: 5 } },
        { eventType: "conversion", teamId: "home", minute: 21, payload: { points: 2 } },
        { eventType: "try", teamId: "away", minute: 40, payload: { points: 5 } },
        { eventType: "conversion", teamId: "away", minute: 41, payload: { points: 2 } },
      ],
    });

    expect(state.homeMaxLead).toBe(10);
  });

  it("counts wins after leading with lead protection percentage", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildLeadProtectionTableStandings({
      seasonPerspectives: [
        perspective({
          pointsFor: 24,
          pointsAgainst: 17,
          maxLeadMargin: 10,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(1);
    expect(bath?.won).toBe(1);
    expect(bath?.extra?.leadProtectionPct).toBe(100);
    expect(bath?.extra?.pointsLost).toBe(0);
    expect(bath?.extra?.tablePointsEarned).toBe(5);
    expect(bath?.extra?.averageLargestLead).toBe(10);
  });

  it("tracks draws and losses after leading separately", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildLeadProtectionTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          pointsFor: 24,
          pointsAgainst: 17,
        }),
        perspective({
          fixtureId: "f2",
          kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 17,
          triesFor: 2,
          wasWinning: null,
          wasDrawn: true,
        }),
        perspective({
          fixtureId: "f3",
          kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
          pointsFor: 17,
          pointsAgainst: 24,
          triesFor: 2,
          wasWinning: false,
          wasLosing: true,
          maxLeadMargin: 10,
          latestLeadLostMinute: 72,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.played).toBe(3);
    expect(bath?.won).toBe(1);
    expect(bath?.drawn).toBe(1);
    expect(bath?.lost).toBe(1);
    expect(bath?.extra?.leadProtectionPct).toBeCloseTo(33.3, 1);
    expect(bath?.extra?.pointsLost).toBe(5);
    expect(bath?.extra?.largestLeadLost).toBe(10);
  });

  it("applies minimum lead filters using largest lead held", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        maxLeadMargin: 3,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        maxLeadMargin: 10,
      }),
    ];

    const tenPlus = buildLeadProtectionTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      minimumLead: 10,
    });

    expect(tenPlus.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("filters ahead at half-time and after 60 minutes", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({
        fixtureId: "f1",
        aheadAtHalfTime: true,
        aheadAfterSixty: false,
      }),
      perspective({
        fixtureId: "f2",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
        aheadAtHalfTime: false,
        aheadAfterSixty: true,
      }),
    ];

    const halfTime = buildLeadProtectionTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      leadPosition: "half_time",
    });
    const afterSixty = buildLeadProtectionTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
      leadPosition: "after_sixty",
    });

    expect(halfTime.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(afterSixty.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("supports home and away views and excludes missing timeline data", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home" }),
      perspective({
        fixtureId: "f2",
        side: "away",
        kickoffAt: new Date("2026-02-01T15:00:00.000Z"),
      }),
      perspective({
        fixtureId: "f3",
        kickoffAt: new Date("2026-03-01T15:00:00.000Z"),
        everLeading: null,
        scoreTimelineVerified: false,
      }),
    ];

    const home = buildLeadProtectionTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "home",
    });
    const all = buildLeadProtectionTableStandings({
      seasonPerspectives: fixtures,
      rules,
      tableView: "all",
    });

    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
    expect(all.rows.find((row) => row.teamName === "Bath")?.played).toBe(2);
  });

  it("tracks enhanced lead protection counters on wins", () => {
    const rules = scoringRulesForCompetitionSlug("premiership");
    const built = buildLeadProtectionTableStandings({
      seasonPerspectives: [
        perspective({
          fixtureId: "f1",
          aheadAtHalfTime: true,
          aheadAfterSixty: true,
          minuteFirstAhead: 8,
        }),
      ],
      rules,
      tableView: "all",
    });

    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.extra?.halfTimeLeadsProtected).toBe(1);
    expect(bath?.extra?.sixtyMinuteLeadsProtected).toBe(1);
    expect(bath?.extra?.finalTwentyLeadsProtected).toBe(1);
    expect(bath?.extra?.avgMinuteFirstAhead).toBe(8);
    expect(bath?.extra?.sixtyMinuteLeadProtectionPct).toBe(100);
  });

  it("sorts by lead protection percentage by default", () => {
    const sorted = sortLeadProtectionRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "Alpha",
          played: 10,
          won: 8,
          drawn: 1,
          lost: 1,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 30,
          extra: { leadProtectionPct: 80, pointsLost: 3, largestLeadLost: 7 },
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "Bravo",
          played: 5,
          won: 5,
          drawn: 0,
          lost: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsDiff: 0,
          bonusPoints: 0,
          leaguePoints: 20,
          extra: { leadProtectionPct: 100, pointsLost: 0, largestLeadLost: null },
        },
      ],
      "lead_protection_pct",
    );

    expect(sorted[0]?.teamName).toBe("Bravo");
    expect(sorted[1]?.teamName).toBe("Alpha");
  });
});
