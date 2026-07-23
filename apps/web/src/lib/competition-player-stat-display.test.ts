import { describe, expect, it } from "vitest";
import {
  formatLeaderboardPlayerName,
  teamCodeForLeaderboard,
} from "./competition-player-stat-display";

describe("formatLeaderboardPlayerName", () => {
  it("formats as initial + surname", () => {
    expect(formatLeaderboardPlayerName("Will Jordan")).toBe("W. Jordan");
    expect(formatLeaderboardPlayerName("Jamison Gibson-Park")).toBe("J. Gibson-Park");
  });
});

describe("teamCodeForLeaderboard", () => {
  it("maps international sides to Sport365-style codes", () => {
    expect(teamCodeForLeaderboard({ teamName: "New Zealand", teamShortName: "NEW" })).toBe("NZL");
    expect(teamCodeForLeaderboard({ teamName: "South Africa", teamShortName: "SA" })).toBe("RSA");
    expect(teamCodeForLeaderboard({ teamName: "Ireland", teamShortName: "IRE" })).toBe("IRE");
  });
});
