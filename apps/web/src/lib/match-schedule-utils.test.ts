import { describe, expect, it } from "vitest";
import { groupByCompetition, type ScheduleCompetition } from "./match-schedule-utils";

describe("groupByCompetition", () => {
  const competitionById: Record<string, ScheduleCompetition> = {
    "cms-a": { id: "cms-a", name: "International Matches", slug: "international-matches-5" },
    "cms-b": { id: "cms-b", name: "International Matches", slug: "international-matches-n062z68w" },
  };

  it("merges fixtures that share a competition display name", () => {
    const groups = groupByCompetition(
      [
        {
          id: "1",
          slug: "nz-v-france",
          competitionId: "cms-a",
          competitionName: "International Matches",
          matchDate: "2026-07-04",
          seasonLabel: "2026",
          kickoffAt: "2026-07-04T14:00:00.000Z",
          status: "full_time",
          round: null,
          venue: null,
          homeScore: 34,
          awayScore: 32,
          homeTeam: { name: "New Zealand" },
          awayTeam: { name: "France" },
        },
        {
          id: "2",
          slug: "aus-v-ireland",
          competitionId: "cms-b",
          competitionName: "International Matches",
          matchDate: "2026-07-04",
          seasonLabel: "2026",
          kickoffAt: "2026-07-04T16:00:00.000Z",
          status: "full_time",
          round: null,
          venue: null,
          homeScore: 31,
          awayScore: 33,
          homeTeam: { name: "Australia" },
          awayTeam: { name: "Ireland" },
        },
      ],
      competitionById,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("INTERNATIONAL");
    expect(groups[0]?.fixtures).toHaveLength(2);
  });
});
