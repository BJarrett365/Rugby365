import { describe, expect, it } from "vitest";
import {
  isProvisional,
  rankingPositionGroup,
  rating10To100,
  refereeDifficultyAdjustment,
  tournamentRatingFromMatches,
} from "./competition-ranking-math";

describe("rating10To100", () => {
  it("scales match ratings", () => {
    expect(rating10To100(7.5)).toBe(75);
    expect(rating10To100(null)).toBeNull();
  });
});

describe("refereeDifficultyAdjustment", () => {
  it("adds final bonus only when rating is strong", () => {
    expect(refereeDifficultyAdjustment({ rating100: 80, round: "Final" })).toBe(4);
    expect(refereeDifficultyAdjustment({ rating100: 70, round: "Final" })).toBe(0);
  });

  it("adds close-match bump", () => {
    expect(
      refereeDifficultyAdjustment({ rating100: 78, round: "Round 3", margin: 3 }),
    ).toBe(1);
  });
});

describe("tournamentRatingFromMatches", () => {
  it("averages ratings with difficulty", () => {
    expect(tournamentRatingFromMatches([80, 70], [2, 0])).toBe(76);
  });
});

describe("rankingPositionGroup", () => {
  it("maps common labels", () => {
    expect(rankingPositionGroup("Openside Flanker")).toBe("back_row");
    expect(rankingPositionGroup("Fly Half")).toBe("fly_halves");
  });
});

describe("isProvisional", () => {
  it("requires two matches by default", () => {
    expect(isProvisional(1)).toBe(true);
    expect(isProvisional(2)).toBe(false);
  });
});
