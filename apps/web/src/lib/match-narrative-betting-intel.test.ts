import { describe, expect, it } from "vitest";
import {
  buildMinuteBettingIntelligenceLines,
  buildPrematchBettingIntelligenceLine,
  liveBettingLean,
  scoreAsOfMinute,
} from "./match-narrative-betting-intel";

describe("match narrative betting intelligence", () => {
  it("shifts live lean toward the side ahead late in the match", () => {
    const prematch = liveBettingLean({
      homePercent: 55,
      awayPercent: 42,
      drawPercent: 3,
      homeScore: 0,
      awayScore: 0,
      minute: 1,
    });
    const lateAwayLead = liveBettingLean({
      homePercent: 55,
      awayPercent: 42,
      drawPercent: 3,
      homeScore: 5,
      awayScore: 17,
      minute: 70,
    });
    expect(lateAwayLead.awayPercent).toBeGreaterThan(prematch.awayPercent);
    expect(lateAwayLead.favoriteSide).toBe("away");
  });

  it("reconstructs score as of a minute from events", () => {
    const score = scoreAsOfMinute(
      [
        { minute: 7, eventType: "penalty_goal", teamName: "Pumas", homeScore: 0, awayScore: 3 },
        { minute: 25, eventType: "try", teamName: "Boland Cavaliers", homeScore: 5, awayScore: 3 },
        { minute: 41, eventType: "try", teamName: "Pumas", homeScore: 5, awayScore: 8 },
      ],
      "Boland Cavaliers",
      "Pumas",
      30,
    );
    expect(score).toEqual({ home: 5, away: 3 });
  });

  it("emits one Betting Intelligence line per minute", () => {
    const lines = buildMinuteBettingIntelligenceLines({
      homeName: "Boland Cavaliers",
      awayName: "Pumas",
      prematch: {
        favoriteName: "Boland Cavaliers",
        homePercent: 55,
        awayPercent: 42,
        drawPercent: 3,
      },
      events: [
        { minute: 7, eventType: "penalty_goal", teamName: "Pumas", homeScore: 0, awayScore: 3 },
        { minute: 41, eventType: "try", teamName: "Pumas", homeScore: 5, awayScore: 15 },
      ],
      maxMinute: 10,
    });
    expect(lines).toHaveLength(10);
    expect(lines.every((l) => l.segment === "betting_intelligence")).toBe(true);
    expect(lines.some((l) => /Betting Intelligence|BI pulse|Market lean|Live model/i.test(l.body))).toBe(
      true,
    );
  });

  it("includes bookmaker implied prices on the prematch tip when present", () => {
    const line = buildPrematchBettingIntelligenceLine({
      homeName: "Boland Cavaliers",
      awayName: "Pumas",
      prematch: {
        favoriteName: "Boland Cavaliers",
        homePercent: 55,
        awayPercent: 42,
        drawPercent: 3,
        bookHomePercent: 50,
        bookAwayPercent: 45,
        bookDrawPercent: 5,
      },
    });
    expect(line.body).toContain("Bookmakers imply 50% / 5% / 45%");
  });
});
