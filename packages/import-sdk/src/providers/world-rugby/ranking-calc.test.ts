import { describe, expect, it } from "vitest";
import {
  applyMatchToTeamRatings,
  calculateWorldRugbyPointsExchange,
} from "./ranking-calc";

describe("calculateWorldRugbyPointsExchange", () => {
  it("gives underdog more for a narrow away win", () => {
    // Strong home (90) vs weaker away (80): away wins by 7
    const result = calculateWorldRugbyPointsExchange({
      homeRating: 90,
      awayRating: 80,
      homeScore: 10,
      awayScore: 17,
    });
    // A=93, B=80 → away win: (10+93-80)*0.1 = 2.3 capped at 2
    expect(result.outcome).toBe("away_win");
    expect(result.homeDelta).toBe(-2);
    expect(result.awayDelta).toBe(2);
  });

  it("transfers draw points from favourite to underdog", () => {
    const result = calculateWorldRugbyPointsExchange({
      homeRating: 90,
      awayRating: 80,
      homeScore: 15,
      awayScore: 15,
    });
    // gap = 13 → 13*0.1 = 1.3 capped at 1
    expect(result.outcome).toBe("draw");
    expect(result.homeDelta).toBe(-1);
    expect(result.awayDelta).toBe(1);
  });

  it("skips exchange when favourite beats outsider", () => {
    const result = calculateWorldRugbyPointsExchange({
      homeRating: 90,
      awayRating: 70,
      homeScore: 40,
      awayScore: 10,
    });
    // A=93 B=70 gap=23 >= 10, home favourite wins → no exchange
    expect(result.noExchange).toBe(true);
    expect(result.homeDelta).toBe(0);
    expect(result.awayDelta).toBe(0);
  });

  it("doubles weighting for World Cup matches", () => {
    const normal = calculateWorldRugbyPointsExchange({
      homeRating: 85,
      awayRating: 85,
      homeScore: 20,
      awayScore: 10,
      neutralVenue: true,
    });
    const wc = calculateWorldRugbyPointsExchange({
      homeRating: 85,
      awayRating: 85,
      homeScore: 20,
      awayScore: 10,
      neutralVenue: true,
      isWorldCup: true,
    });
    // (10+85-85)*0.1 = 1 vs *0.2 = 2
    expect(normal.homeDelta).toBe(1);
    expect(wc.homeDelta).toBe(2);
  });
});

describe("applyMatchToTeamRatings", () => {
  it("re-ranks after points exchange", () => {
    const { ratings, exchange } = applyMatchToTeamRatings(
      [
        { teamKey: "a", teamName: "Alpha", points: 90, position: 1 },
        { teamKey: "b", teamName: "Bravo", points: 88, position: 2 },
        { teamKey: "c", teamName: "Charlie", points: 70, position: 3 },
      ],
      {
        homeKey: "b",
        awayKey: "a",
        homeScore: 25,
        awayScore: 20,
        neutralVenue: true,
      },
    );
    expect(exchange.homeDelta).toBeGreaterThan(0);
    expect(ratings[0].teamKey).toBe("b");
    expect(ratings.find((r) => r.teamKey === "c")?.position).toBe(3);
  });
});
