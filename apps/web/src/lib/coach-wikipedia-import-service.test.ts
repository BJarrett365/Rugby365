import { describe, expect, it } from "vitest";
import { filterCoachingCareerForTeam } from "./coach-wikipedia-import-service";

describe("filterCoachingCareerForTeam", () => {
  it("matches England national team naming variants", () => {
    const career = [
      { yearsLabel: "2022–", teamName: "England national rugby union team", sortOrder: 1 },
      { yearsLabel: "2010–2015", teamName: "Leicester Tigers", sortOrder: 2 },
    ];

    const england = filterCoachingCareerForTeam(career, "England");
    expect(england).toHaveLength(1);
    expect(england[0].teamName).toContain("England");
  });
});
