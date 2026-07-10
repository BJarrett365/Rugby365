import { describe, expect, it } from "vitest";
import { buildRunningScoresForEvents } from "./match-event-scores";

describe("buildRunningScoresForEvents", () => {
  const homeTeamId = "home";
  const awayTeamId = "away";

  it("computes running scores from scoring events", () => {
    const events = [
      { id: "1", eventType: "try", teamId: awayTeamId, payload: {} },
      { id: "2", eventType: "conversion", teamId: awayTeamId, payload: {} },
      { id: "3", eventType: "try", teamId: homeTeamId, payload: {} },
      { id: "4", eventType: "substitution", teamId: homeTeamId, payload: {} },
    ];

    const scores = buildRunningScoresForEvents(events, homeTeamId, awayTeamId);
    expect(scores.get("1")).toEqual([0, 5]);
    expect(scores.get("2")).toEqual([0, 7]);
    expect(scores.get("3")).toEqual([5, 7]);
    expect(scores.get("4")).toEqual([5, 7]);
  });

  it("prefers explicit score_after from provider payloads", () => {
    const events = [
      {
        id: "1",
        eventType: "try",
        teamId: homeTeamId,
        payload: { score_after: [12, 10] },
      },
    ];

    const scores = buildRunningScoresForEvents(events, homeTeamId, awayTeamId);
    expect(scores.get("1")).toEqual([12, 10]);
  });
});
