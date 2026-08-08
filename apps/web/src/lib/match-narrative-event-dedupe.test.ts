import { describe, expect, it } from "vitest";
import {
  dedupeNarrativeEvents,
  narrativePlayerNameKey,
  normalizeNarrativeScoringType,
} from "./match-narrative-event-dedupe";
import { scoreAsOfMinute } from "./match-narrative-betting-intel";

describe("dedupeNarrativeEvents", () => {
  it("collapses reversed-name try/conversion twins in the same minute", () => {
    const events = dedupeNarrativeEvents([
      {
        minute: 11,
        second: 0,
        eventType: "try",
        teamName: "Japan",
        playerName: "Ito Ryunosuke",
      },
      {
        minute: 11,
        second: 37,
        eventType: "try",
        teamName: "Japan",
        playerName: "Ryunosuke Ito",
      },
      {
        minute: 12,
        second: 0,
        eventType: "conversion",
        teamName: "Japan",
        playerName: "Matsunaga Takuro",
      },
      {
        minute: 12,
        second: 32,
        eventType: "conversion",
        teamName: "Japan",
        playerName: "Takuro Matsunaga",
      },
      {
        minute: 14,
        second: 0,
        eventType: "try",
        teamName: "Australia",
        playerName: "Potter Harry",
      },
      {
        minute: 14,
        second: 7,
        eventType: "try",
        teamName: "Australia",
        playerName: "Harry Potter",
      },
      {
        minute: 15,
        second: 0,
        eventType: "conversion",
        teamName: "Australia",
        playerName: "Lonergan Ryan",
      },
      {
        minute: 15,
        second: 3,
        eventType: "conversion",
        teamName: "Australia",
        playerName: "Ryan Lonergan",
      },
    ]);

    expect(events).toHaveLength(4);
    expect(scoreAsOfMinute(events, "Japan", "Australia", 15)).toEqual({ home: 7, away: 7 });
    expect(events.map((e) => e.playerName)).toEqual([
      "Ryunosuke Ito",
      "Takuro Matsunaga",
      "Harry Potter",
      "Ryan Lonergan",
    ]);
  });

  it("prefers the lower absolute scoreline when twins disagree", () => {
    const events = dedupeNarrativeEvents([
      {
        minute: 33,
        second: 0,
        eventType: "try",
        teamName: "Japan",
        playerName: "Makisi Faulua",
        homeScore: 19,
        awayScore: 28,
      },
      {
        minute: 33,
        second: 12,
        eventType: "try",
        teamName: "Japan",
        playerName: "Faulua Makisi",
        homeScore: 24,
        awayScore: 28,
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.homeScore).toBe(19);
    expect(events[0]!.awayScore).toBe(28);
  });

  it("collapses duplicate yellow cards for the same player", () => {
    const events = dedupeNarrativeEvents([
      {
        minute: 31,
        second: 0,
        eventType: "yellow_card",
        teamName: "Australia",
        playerName: "Amatosero Miles",
      },
      {
        minute: 31,
        second: 51,
        eventType: "yellow_card",
        teamName: "Australia",
        playerName: "Miles Amatosero",
      },
      {
        minute: 32,
        second: 1,
        eventType: "red_card",
        teamName: "Australia",
        playerName: "Miles Amatosero",
      },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]!.eventType).toBe("yellow_card");
    expect(events[1]!.eventType).toBe("red_card");
  });

  it("keeps distinct scorers in the same minute", () => {
    const events = dedupeNarrativeEvents([
      {
        minute: 42,
        second: 0,
        eventType: "try",
        teamName: "Japan",
        playerName: "Ryunosuke Ito",
        homeScore: 5,
        awayScore: 0,
      },
      {
        minute: 42,
        second: 40,
        eventType: "try",
        teamName: "Japan",
        playerName: "Faulua Makisi",
        homeScore: 10,
        awayScore: 0,
      },
    ]);
    expect(events).toHaveLength(2);
  });
});

describe("narrative player name key", () => {
  it("treats reversed names as the same key", () => {
    expect(narrativePlayerNameKey("Harry Potter")).toBe(narrativePlayerNameKey("Potter Harry"));
    expect(normalizeNarrativeScoringType("Try")).toBe("try");
    expect(normalizeNarrativeScoringType("Conversion")).toBe("conversion");
  });
});
