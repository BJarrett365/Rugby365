import { describe, expect, it } from "vitest";
import {
  buildAllTimePremiershipTable,
  filterPerspectivesBySeasonRange,
  sortAllTimePremiershipRows,
} from "./all-time-premiership-service";
import { canonicalKeyFromName, resolvePremiershipCanonicalIdentity } from "./premiership-team-identity";
import {
  deductionsForTeamSeason,
  scoringRulesForPremiershipSeason,
} from "./premiership-season-scoring";
import { tableIdFromTypeParam } from "./table-view-utils";
import type { TeamFixturePerspective } from "./table-types";

function perspective(overrides: Partial<TeamFixturePerspective>): TeamFixturePerspective {
  return {
    fixtureId: "f1",
    kickoffAt: new Date("2020-09-12T15:00:00.000Z"),
    teamId: "t-bath",
    teamName: "Bath",
    teamSlug: "bath",
    seasonStartYear: 2020,
    opponentId: "t-exeter",
    opponentName: "Exeter Chiefs",
    side: "home",
    pointsFor: 24,
    pointsAgainst: 17,
    triesFor: 4,
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
    ...overrides,
  };
}

describe("all-time premiership table", () => {
  it("maps type=all-time-premiership route param", () => {
    expect(tableIdFromTypeParam("all-time-premiership")).toBe("all_time_premiership");
  });

  it("merges sponsored club names via aliases", () => {
    const bathSponsored = resolvePremiershipCanonicalIdentity({
      teamId: "uuid-bath-rugby",
      teamName: "Bath Rugby",
      teamSlug: "bath-rugby",
    });
    const bathPlain = resolvePremiershipCanonicalIdentity({
      teamId: "uuid-bath",
      teamName: "Bath",
      teamSlug: "bath",
    });
    expect(bathSponsored.canonicalKey).toBe(bathPlain.canonicalKey);
    expect(bathSponsored.uncertain).toBe(false);
  });

  it("flags uncertain identities for unmapped clubs", () => {
    const pirates = resolvePremiershipCanonicalIdentity({
      teamId: "uuid-cp",
      teamName: "Cornish Pirates",
      teamSlug: "cornish-pirates",
    });
    expect(pirates.canonicalKey).toBe("cornish-pirates");
    expect(pirates.uncertain).toBe(true);
  });

  it("uses different scoring rules by season", () => {
    expect(scoringRulesForPremiershipSeason(1995).winPoints).toBe(2);
    expect(scoringRulesForPremiershipSeason(1999).tryBonusPoints).toBe(0);
    expect(scoringRulesForPremiershipSeason(2005).tryBonusPoints).toBe(1);
  });

  it("combines multiple seasons and applies deductions", () => {
    const fixtures = [
      perspective({
        fixtureId: "f1",
        teamId: "uuid-saracens",
        teamName: "Saracens",
        teamSlug: "saracens",
        seasonStartYear: 2019,
        pointsFor: 30,
        pointsAgainst: 10,
        triesFor: 5,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "uuid-sale",
        teamName: "Sale Sharks",
        teamSlug: "sale-sharks",
        side: "away",
        seasonStartYear: 2019,
        pointsFor: 10,
        pointsAgainst: 30,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "uuid-saracens-old",
        teamName: "Saracens",
        teamSlug: "saracens",
        seasonStartYear: 2020,
        pointsFor: 20,
        pointsAgainst: 18,
        triesFor: 3,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "uuid-bath",
        teamName: "Bath Rugby",
        teamSlug: "bath-rugby",
        side: "away",
        seasonStartYear: 2020,
        pointsFor: 18,
        pointsAgainst: 20,
        triesFor: 2,
      }),
    ];

    const built = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "all",
      seasonRangeMode: "all",
      teamStatus: "all",
      currentTeamCanonicalKeys: new Set([canonicalKeyFromName("Bath")]),
      sortBy: "league_points",
    });

    const saracens = built.rows.find((row) => row.teamName === "Saracens");
    expect(saracens?.seasonsPlayed).toBe(2);
    expect(saracens?.played).toBe(2);
    expect(saracens?.extra?.pointsDeducted).toBe(
      deductionsForTeamSeason("saracens", 2019),
    );
    expect(saracens?.leaguePoints).toBe(0);
    expect(built.matchCount).toBe(4);
  });

  it("filters home and away views", () => {
    const fixtures = [
      perspective({ fixtureId: "f1", side: "home" }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t-bath",
        teamName: "Bath",
        side: "away",
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "home",
      }),
    ];

    const home = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "home",
      seasonRangeMode: "all",
      teamStatus: "all",
      currentTeamCanonicalKeys: new Set(),
      sortBy: "league_points",
    });
    const away = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "away",
      seasonRangeMode: "all",
      teamStatus: "all",
      currentTeamCanonicalKeys: new Set(),
      sortBy: "league_points",
    });

    expect(home.matchCount).toBe(2);
    expect(away.matchCount).toBe(2);
    expect(home.rows.find((row) => row.teamName === "Bath")?.played).toBe(1);
  });

  it("filters current and former teams", () => {
    const fixtures = [
      perspective({ teamName: "Bath", teamId: "bath-1" }),
      perspective({
        fixtureId: "f1",
        teamId: "wasps-1",
        teamName: "Wasps",
        teamSlug: "wasps",
        side: "away",
      }),
      perspective({
        fixtureId: "f2",
        teamId: "wasps-1",
        teamName: "Wasps",
        teamSlug: "wasps",
      }),
      perspective({
        fixtureId: "f2",
        teamId: "bath-1",
        teamName: "Bath",
        side: "away",
      }),
    ];

    const currentKeys = new Set([canonicalKeyFromName("Bath")]);
    const current = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "all",
      seasonRangeMode: "all",
      teamStatus: "current",
      currentTeamCanonicalKeys: currentKeys,
      sortBy: "league_points",
    });
    const former = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "all",
      seasonRangeMode: "all",
      teamStatus: "former",
      currentTeamCanonicalKeys: currentKeys,
      sortBy: "league_points",
    });

    expect(current.rows.every((row) => row.teamName === "Bath")).toBe(true);
    expect(former.rows.every((row) => row.teamName === "Wasps")).toBe(true);
  });

  it("filters by season range", () => {
    const fixtures = [
      perspective({ seasonStartYear: 2018, fixtureId: "f1" }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        seasonStartYear: 2018,
      }),
      perspective({ seasonStartYear: 2022, fixtureId: "f2" }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        seasonStartYear: 2022,
      }),
    ];

    const filtered = filterPerspectivesBySeasonRange(fixtures, {
      mode: "custom",
      fromYear: 2020,
      toYear: 2023,
    });
    expect(filtered).toHaveLength(2);

    const built = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "all",
      seasonRangeMode: "custom",
      seasonFromYear: 2020,
      seasonToYear: 2023,
      teamStatus: "all",
      currentTeamCanonicalKeys: new Set(),
      sortBy: "league_points",
    });
    expect(built.matchCount).toBe(2);
  });

  it("reports tries coverage without treating missing tries as zero", () => {
    const fixtures = [
      perspective({ triesFor: 3, triesAgainst: 2 }),
      perspective({
        fixtureId: "f2",
        triesFor: null,
        triesAgainst: null,
      }),
      perspective({
        fixtureId: "f1",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        triesFor: null,
        triesAgainst: null,
      }),
      perspective({
        fixtureId: "f2",
        teamId: "t2",
        teamName: "Exeter Chiefs",
        side: "away",
        triesFor: 1,
        triesAgainst: 3,
      }),
    ];

    const built = buildAllTimePremiershipTable({
      perspectives: fixtures,
      tableView: "all",
      seasonRangeMode: "all",
      teamStatus: "all",
      currentTeamCanonicalKeys: new Set(),
      sortBy: "league_points",
    });

    expect(built.coverage.triesCoveragePct).toBe(50);
    const bath = built.rows.find((row) => row.teamName === "Bath");
    expect(bath?.triesFor).toBe(3);
  });

  it("sorts by league points then wins by default", () => {
    const rows = sortAllTimePremiershipRows(
      [
        {
          rank: 0,
          teamId: "a",
          teamName: "B",
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          pointsFor: 40,
          pointsAgainst: 20,
          pointsDiff: 20,
          bonusPoints: 0,
          leaguePoints: 8,
          winPct: 100,
        },
        {
          rank: 0,
          teamId: "b",
          teamName: "A",
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          pointsFor: 50,
          pointsAgainst: 10,
          pointsDiff: 40,
          bonusPoints: 2,
          leaguePoints: 10,
          winPct: 100,
        },
      ],
      "league_points",
    );
    expect(rows[0]?.teamName).toBe("A");
    expect(rows[0]?.rank).toBe(1);
  });
});
