import { describe, expect, it } from "vitest";
import { collectMatchWarnings } from "./match-cms-warnings";

describe("match issues warning hrefs", () => {
  it("routes venue and referee gaps to the issues template", () => {
    const warnings = collectMatchWarnings({
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: null,
      refereeId: null,
      hasLineups: true,
      hasTeamStats: true,
      hasPlayerStats: true,
      primaryApiMatchId: "1",
      status: "full_time",
    });
    const venue = warnings.find((w) => w.code === "venue");
    const referee = warnings.find((w) => w.code === "referee");
    expect(venue?.href("abc")).toBe("/admin/matches/abc/edit");
    expect(referee?.href("abc")).toBe("/admin/matches/abc/edit");
  });

  it("routes finished-match gaps to focused CMS pages", () => {
    const warnings = collectMatchWarnings({
      competitionId: "c",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
      venueId: "v",
      refereeId: "r",
      hasLineups: false,
      hasTeamStats: false,
      hasPlayerStats: false,
      primaryApiMatchId: null,
      status: "full_time",
    });
    expect(warnings.find((w) => w.code === "lineups")?.href("abc")).toBe(
      "/admin/matches/abc/lineups",
    );
    expect(warnings.find((w) => w.code === "team_stats")?.href("abc")).toBe(
      "/admin/matches/abc/stats",
    );
    expect(warnings.find((w) => w.code === "player_stats")?.href("abc")).toBe(
      "/admin/matches/abc/player-stats",
    );
    expect(warnings.find((w) => w.code === "primary_mapping")?.href("abc")).toBe(
      "/admin/matches/abc/sources",
    );
  });
});
