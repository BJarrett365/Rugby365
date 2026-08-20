import { describe, expect, it } from "vitest";
import {
  buildRecentMatchLabel,
  isEligibleRecentAppearance,
} from "./player-recent-matches-utils";

describe("isEligibleRecentAppearance", () => {
  it("includes starters with unknown minutes", () => {
    expect(
      isEligibleRecentAppearance({
        squadRole: "starter",
        jerseyNumber: 10,
        minutesPlayed: null,
        rating: null,
      }),
    ).toBe(true);
  });

  it("excludes starters with explicit zero minutes and no rating", () => {
    expect(
      isEligibleRecentAppearance({
        squadRole: "starter",
        jerseyNumber: 10,
        minutesPlayed: 0,
        rating: null,
      }),
    ).toBe(false);
  });

  it("includes bench who entered via minutes", () => {
    expect(
      isEligibleRecentAppearance({
        squadRole: "bench",
        jerseyNumber: 22,
        minutesPlayed: 25,
        rating: null,
      }),
    ).toBe(true);
  });

  it("includes unused-looking bench when rated (entered)", () => {
    expect(
      isEligibleRecentAppearance({
        squadRole: "replacement",
        jerseyNumber: 21,
        minutesPlayed: 0,
        rating: 6.2,
      }),
    ).toBe(true);
  });

  it("excludes unused replacements", () => {
    expect(
      isEligibleRecentAppearance({
        squadRole: "bench",
        jerseyNumber: 23,
        minutesPlayed: 0,
        rating: null,
      }),
    ).toBe(false);
    expect(
      isEligibleRecentAppearance({
        squadRole: "replacement",
        jerseyNumber: 22,
        minutesPlayed: null,
        rating: null,
      }),
    ).toBe(false);
  });
});

describe("buildRecentMatchLabel", () => {
  it("uses official home-away score order", () => {
    expect(
      buildRecentMatchLabel({
        homeTeamName: "Leinster",
        awayTeamName: "Toulouse",
        homeScore: 28,
        awayScore: 17,
      }),
    ).toBe("Leinster 28 - 17 Toulouse");
  });

  it("falls back without scores", () => {
    expect(
      buildRecentMatchLabel({
        homeTeamName: "Bulls",
        awayTeamName: "Sharks",
        homeScore: null,
        awayScore: null,
      }),
    ).toBe("Bulls vs Sharks");
  });
});
