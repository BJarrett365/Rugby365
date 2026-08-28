import { describe, expect, it } from "vitest";
import {
  formatLeaderboardPlayerName,
  nationalTeamNickname,
  teamCodeForLeaderboard,
} from "./competition-player-stat-display";

describe("formatLeaderboardPlayerName", () => {
  it("formats as initial + surname", () => {
    expect(formatLeaderboardPlayerName("Will Jordan")).toBe("W. Jordan");
    expect(formatLeaderboardPlayerName("Jamison Gibson-Park")).toBe("J. Gibson-Park");
  });
});

describe("nationalTeamNickname", () => {
  it("returns famous international nicknames in uppercase", () => {
    expect(nationalTeamNickname("New Zealand")).toBe("ALL BLACKS");
    expect(nationalTeamNickname("South Africa")).toBe("SPRINGBOKS");
    expect(nationalTeamNickname("Australia")).toBe("WALLABIES");
  });

  it("skips a nickname that is just the country name", () => {
    expect(nationalTeamNickname("England")).toBeNull();
  });
});

describe("teamCodeForLeaderboard", () => {
  it("maps international sides to Sport365-style codes", () => {
    expect(teamCodeForLeaderboard({ teamName: "New Zealand", teamShortName: "NEW" })).toBe("NZL");
    expect(teamCodeForLeaderboard({ teamName: "South Africa", teamShortName: "SA" })).toBe("RSA");
    expect(teamCodeForLeaderboard({ teamName: "Ireland", teamShortName: "IRE" })).toBe("IRE");
  });

  it("rejects Wikipedia template debris in short names", () => {
    expect(teamCodeForLeaderboard({ teamName: "Griquas", teamShortName: "{{FS}}" })).toBe("GRI");
    expect(teamCodeForLeaderboard({ teamName: "Pumas", teamShortName: "{{F" })).toBe("PUM");
  });

  it("maps Currie Cup clubs from name when short name is junk", () => {
    expect(teamCodeForLeaderboard({ teamName: "Cheetahs", teamShortName: null })).toBe("CHE");
    expect(teamCodeForLeaderboard({ teamName: "Boland Cavaliers", teamShortName: "BOL" })).toBe(
      "BOL",
    );
  });
});
