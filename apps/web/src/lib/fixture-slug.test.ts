import { describe, expect, it } from "vitest";
import { buildFixtureSlug } from "./fixture-slug";

describe("buildFixtureSlug", () => {
  it("builds teams + date slug", () => {
    expect(
      buildFixtureSlug({
        homeSlug: "new-zealand",
        awaySlug: "italy",
        kickoffAt: "2026-07-11T05:10:00.000Z",
        format: "teams-date",
      }),
    ).toBe("new-zealand-v-italy-2026-07-11");
  });

  it("builds competition + teams + date slug", () => {
    expect(
      buildFixtureSlug({
        homeSlug: "new-zealand",
        awaySlug: "italy",
        competitionName: "International Matches",
        kickoffAt: "2026-07-11T05:10:00.000Z",
        format: "competition-teams-date",
      }),
    ).toBe("international-matches-new-zealand-v-italy-2026-07-11");
  });

  it("builds nations championship style slug", () => {
    expect(
      buildFixtureSlug({
        homeSlug: "new-zealand",
        awaySlug: "italy",
        competitionName: "World Rugby Nations Championship",
        kickoffAt: "2026-07-11",
        format: "competition-teams-date",
      }),
    ).toBe("world-rugby-nations-championship-new-zealand-v-italy-2026-07-11");
  });
});
