import { describe, expect, it } from "vitest";
import {
  buildPreviousMeetingHref,
  groupByCompetition,
  isSdmsShapedMatchId,
  matchDetailHref,
  type ScheduleCompetition,
  type ScheduleFixture,
} from "./match-schedule-utils";

describe("buildPreviousMeetingHref", () => {
  it("builds a match centre path and replaces numeric competition ids", () => {
    const href = buildPreviousMeetingHref(
      {
        match_id: "ej5vom19",
        date: "2025-09-13",
        competition_id: 2,
        competition_name: "Currie Cup",
        competition_slug: "currie-cup",
        home_team_slug: "griquas",
        away_team_slug: "cheetahs",
      },
      { competitionId: "pd9ro98v", competitionName: "Currie Cup" },
    );
    expect(href).toBe(
      "/matches/ej5vom19/currie-cup/pd9ro98v/griquas-v-cheetahs/2025-09-13",
    );
  });

  it("returns null without a match id", () => {
    expect(buildPreviousMeetingHref({ date: "2025-09-13" })).toBeNull();
  });
});

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

describe("isSdmsShapedMatchId", () => {
  it("accepts Planet Rugby / SDMS alphanumeric ids", () => {
    expect(isSdmsShapedMatchId("294zg8oj")).toBe(true);
    expect(isSdmsShapedMatchId("o6gd7xg6")).toBe(true);
  });

  it("rejects rugby-data integers, CMS uuids, and prefixed ids", () => {
    expect(isSdmsShapedMatchId("9635")).toBe(false);
    expect(isSdmsShapedMatchId("352b6ba0-311c-4e2d-af78-72aa52edf241")).toBe(false);
    expect(isSdmsShapedMatchId("sdms:294zg8oj")).toBe(false);
  });
});

describe("matchDetailHref", () => {
  const base: ScheduleFixture = {
    id: "cms-fixture-id",
    slug: "biarritz-v-nissa",
    competitionId: "352b6ba0-311c-4e2d-af78-72aa52edf241",
    competitionName: "France Pro D2",
    matchDate: "2026-08-27",
    seasonLabel: "2026",
    kickoffAt: "2026-08-27T18:00:00.000Z",
    status: "full_time",
    round: null,
    venue: null,
    homeScore: 10,
    awayScore: 12,
    homeTeam: { name: "Biarritz", slug: "biarritz-olympique" },
    awayTeam: { name: "Nissa", slug: "nissa-rugby" },
    source: "db",
  };

  it("uses the CMS fixture id when externalMatchId is rugby-data numeric", () => {
    const href = matchDetailHref({ ...base, externalMatchId: "9635" });
    expect(href).toBe(
      "/matches/cms-fixture-id/france-pro-d2/352b6ba0-311c-4e2d-af78-72aa52edf241/biarritz-olympique-v-nissa-rugby/2026-08-27",
    );
  });

  it("keeps SDMS ids in the match centre path", () => {
    const href = matchDetailHref({ ...base, externalMatchId: "294zg8oj" });
    expect(href?.startsWith("/matches/294zg8oj/")).toBe(true);
  });
});
