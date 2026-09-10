import { describe, expect, it } from "vitest";
import { countDedupedTriesForTeam, resolveFixtureTryCounts } from "./match-try-count";

describe("countDedupedTriesForTeam", () => {
  it("prefers timed Wikipedia tries over untimed rugby-box duplicates", () => {
    const events = [
      {
        eventType: "try",
        minute: 0,
        teamId: "nz",
        sequenceNo: 1,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "McCaw" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId: "nz",
        sequenceNo: 2,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "McCaw" },
      },
      {
        eventType: "try",
        minute: 53,
        teamId: "nz",
        sourceProvider: "wikipedia",
        payload: { playerName: "McCaw" },
      },
      {
        eventType: "try",
        minute: 59,
        teamId: "nz",
        sourceProvider: "wikipedia",
        payload: { playerName: "McCaw" },
      },
    ];
    expect(countDedupedTriesForTeam(events, "nz")).toBe(2);
  });

  it("prefers Wikipedia try lists over untimed rugby-box copies", () => {
    const events = [
      {
        eventType: "try",
        minute: 0,
        teamId: "nz",
        sequenceNo: 1,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "McCaw" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId: "nz",
        sequenceNo: 2,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Savea" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId: "nz",
        sequenceNo: 1,
        sourceProvider: "wikipedia",
        payload: { playerName: "McCaw" },
      },
    ];
    expect(countDedupedTriesForTeam(events, "nz")).toBe(1);
  });

  it("returns null when a team has no try events", () => {
    expect(countDedupedTriesForTeam([], "nz")).toBeNull();
  });

  it("counts a blank scoreline as zero tries when the fixture has try events", () => {
    const events = [
      {
        eventType: "try",
        minute: 12,
        teamId: "nz",
        sourceProvider: "wikipedia",
        payload: { playerName: "Savea" },
      },
    ];
    expect(
      resolveFixtureTryCounts({
        events,
        teamIds: ["nz"],
        opponentIds: ["arg"],
        statTries: 0,
        opponentStatTries: 0,
      }),
    ).toEqual({ triesFor: 1, triesAgainst: 0 });
  });

  it("does not let zeroed team_match_stats hide Wikipedia try events", () => {
    const events = [
      {
        eventType: "try",
        minute: 8,
        teamId: "nz",
        sourceProvider: "wikipedia",
        payload: { playerName: "Ioane" },
      },
      {
        eventType: "try",
        minute: 21,
        teamId: "nz",
        sourceProvider: "wikipedia",
        payload: { playerName: "Savea" },
      },
      {
        eventType: "try",
        minute: 40,
        teamId: "aus",
        sourceProvider: "wikipedia",
        payload: { playerName: "Koroibete" },
      },
    ];
    expect(
      resolveFixtureTryCounts({
        events,
        teamIds: ["nz"],
        opponentIds: ["aus"],
        statTries: 0,
        opponentStatTries: 0,
      }),
    ).toEqual({ triesFor: 2, triesAgainst: 1 });
  });
});
