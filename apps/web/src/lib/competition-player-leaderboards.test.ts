import { describe, expect, it } from "vitest";
import {
  leaderboardEmptyMessage,
  metricHasTrackedData,
  RUGBY_CHAMPIONSHIP_ADVANCED_LEADERBOARD_METRICS,
} from "./competition-player-leaderboards-math";
import {
  aggregatesHaveScoring,
  clearTryAssists,
  collapseDuplicateLeaderboardPlayers,
  mergeEventScoringIntoRows,
} from "./event-scoring-leaderboard";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";

describe("competition player leaderboard helpers", () => {
  it("recognises Nations Championship slug for hemisphere filters", () => {
    expect(isNationsChampionshipSlug("nations-championship")).toBe(true);
    expect(isNationsChampionshipSlug("premiership")).toBe(false);
  });

  it("maps NC pool teams to hemispheres for North/South boards", () => {
    expect(nationsChampionshipHemisphereForTeam("France")).toBe("northern");
    expect(nationsChampionshipHemisphereForTeam("New Zealand")).toBe("southern");
    expect(nationsChampionshipHemisphereForTeam("Barbarians")).toBeNull();
  });

  it("backfills tries/points from match events when season stats have no scoring", () => {
    expect(aggregatesHaveScoring([{ tries: 0, points: 0 }])).toBe(false);
    const merged = mergeEventScoringIntoRows(
      [{ playerId: "p1", teamId: "sa", tries: 0, points: 0, tryAssists: 1 }],
      [
        { playerId: "p1", teamId: "sa", tries: 2, points: 10, tryAssists: 0 },
        { playerId: "p2", teamId: "nz", tries: 3, points: 15, tryAssists: 0 },
      ],
    );
    expect(merged.find((row) => row.playerId === "p1")).toMatchObject({ tries: 2, points: 10 });
    expect(merged.find((row) => row.playerId === "p2")).toMatchObject({ tries: 3, points: 15 });
    expect(clearTryAssists(merged).every((row) => row.tryAssists === 0)).toBe(true);
  });

  it("collapses canonical vs legacy profiles on the same team", () => {
    const collapsed = collapseDuplicateLeaderboardPlayers([
      {
        playerId: "legacy",
        playerName: "Codie Taylor",
        playerSlug: "codie-taylor-3ej553jx__legacy__368fe5e0",
        playerImageUrl: null,
        teamId: "nz",
        teamName: "New Zealand",
        teamSlug: "new-zealand-5d9ywpjo",
        appearances: 3,
        points: 5,
        tries: 1,
        tacklesCompleted: 0,
      },
      {
        playerId: "canonical",
        playerName: "Codie Taylor",
        playerSlug: "codie-taylor-3ej553jx",
        playerImageUrl: "https://images.allblacks.com/taylor.jpg",
        teamId: "nz",
        teamName: "New Zealand",
        teamSlug: "new-zealand-5d9ywpjo",
        appearances: 5,
        points: 10,
        tries: 2,
        tacklesCompleted: 12,
      },
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      playerId: "canonical",
      playerSlug: "codie-taylor-3ej553jx",
      points: 10,
      tries: 2,
      tacklesCompleted: 12,
    });
  });

  it("collapses apostrophe spelling variants and keeps distinct teammates", () => {
    const collapsed = collapseDuplicateLeaderboardPlayers([
      {
        playerId: "plain",
        playerName: "Dalton Papalii",
        playerSlug: "dalton-papalii-56ee0z67",
        playerImageUrl: null,
        teamId: "nz",
        teamName: "New Zealand",
        teamSlug: "new-zealand",
        points: 5,
        tries: 1,
        tacklesCompleted: 28,
      },
      {
        playerId: "apo",
        playerName: "Dalton Papali'i",
        playerSlug: "dalton-papali-i-ej5oe16x",
        playerImageUrl: "https://images.allblacks.com/papalii.jpg",
        teamId: "nz",
        teamName: "New Zealand",
        teamSlug: "new-zealand",
        points: 5,
        tries: 1,
        tacklesCompleted: 28,
      },
      {
        playerId: "clarke",
        playerName: "Caleb Clarke",
        playerSlug: "caleb-clarke-x7jq4z91",
        playerImageUrl: null,
        teamId: "nz",
        teamName: "New Zealand",
        teamSlug: "new-zealand",
        points: 15,
        tries: 3,
      },
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.find((row) => row.playerId === "apo")).toMatchObject({ tacklesCompleted: 28 });
    expect(collapsed.find((row) => row.playerId === "clarke")?.points).toBe(15);
  });

  it("does not merge the same name on different teams", () => {
    const collapsed = collapseDuplicateLeaderboardPlayers([
      {
        playerId: "a",
        playerName: "Andrew Kellaway",
        playerSlug: "andrew-kellaway-zv90536e",
        teamId: "war",
        teamName: "Waratahs",
        teamSlug: "waratahs",
        points: 10,
      },
      {
        playerId: "b",
        playerName: "Andrew Kellaway",
        playerSlug: "andrew-kellaway-zv90536e",
        teamId: "reb",
        teamName: "Rebels",
        teamSlug: "rebels",
        points: 35,
      },
    ]);
    expect(collapsed).toHaveLength(2);
  });
});

describe("2012 Rugby Championship advanced leaderboards", () => {
  const wikipedia2012ScoringRows = [
    { points: 58, tries: 0, tacklesCompleted: 0, metresCarried: 0, carries: 0, tryAssists: 0 },
    { points: 35, tries: 7, tacklesCompleted: 0, metresCarried: 0, carries: 0, tryAssists: 0 },
  ];

  it("covers all nine Opta-style stats boards", () => {
    expect(RUGBY_CHAMPIONSHIP_ADVANCED_LEADERBOARD_METRICS).toEqual([
      "tacklesCompleted",
      "metresCarried",
      "carries",
      "tryAssists",
      "defendersBeaten",
      "lineBreaks",
      "turnoversWon",
      "dominantTackles",
      "postContactMetres",
    ]);
  });

  it("treats Wikipedia 2012 scoring rows as untracked for Opta-style metrics", () => {
    for (const metric of RUGBY_CHAMPIONSHIP_ADVANCED_LEADERBOARD_METRICS) {
      expect(metricHasTrackedData(wikipedia2012ScoringRows, metric)).toBe(false);
    }
    expect(metricHasTrackedData(wikipedia2012ScoringRows, "points")).toBe(true);
    expect(metricHasTrackedData(wikipedia2012ScoringRows, "tries")).toBe(true);
  });

  it("does not invent tackle/metre boards when only tries and points exist", () => {
    expect(
      leaderboardEmptyMessage({
        hasTrackedData: false,
        playerCount: wikipedia2012ScoringRows.length,
      }),
    ).toBe("These statistics were not recorded for this season.");
  });

  it("still ranks later SDMS seasons when tackles are present", () => {
    expect(
      metricHasTrackedData(
        [
          { tacklesCompleted: 0, metresCarried: 0 },
          { tacklesCompleted: 48, metresCarried: 210 },
        ],
        "tacklesCompleted",
      ),
    ).toBe(true);
  });

  it("does not copy Opta metrics when overlaying Wikipedia scoring", () => {
    const merged = mergeEventScoringIntoRows(
      [
        {
          playerId: "carter",
          teamId: "nz",
          tries: 0,
          points: 0,
          tacklesCompleted: 0,
        },
      ],
      [{ playerId: "carter", teamId: "nz", tries: 0, points: 58, tacklesCompleted: 0 }],
    );
    expect(merged[0]).toMatchObject({ points: 58, tacklesCompleted: 0 });
  });
});
