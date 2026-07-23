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
    expect(venue?.href("abc")).toBe("/admin/matches/abc/edit#issues");
    expect(referee?.href("abc")).toBe("/admin/matches/abc/edit#issues");
  });
});
