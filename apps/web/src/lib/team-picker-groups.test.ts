import { describe, expect, it } from "vitest";
import {
  buildTeamPickerGroups,
  rugbyHemisphereForTeam,
  type TeamCompetitionLink,
} from "./team-picker-groups";

const competitions = [
  { id: "c-prem", name: "Premiership", slug: "premiership", competitionType: "domestic" },
  { id: "c-sn", name: "Six Nations", slug: "six-nations", competitionType: "international" },
  { id: "c-rc", name: "Rugby Championship", slug: "rugby-championship", competitionType: "domestic" },
];

const links: TeamCompetitionLink[] = [
  {
    teamId: "t-saracens",
    competitionId: "c-prem",
    competitionName: "Premiership",
    competitionType: "domestic",
    competitionSlug: "premiership",
  },
  {
    teamId: "t-england",
    competitionId: "c-sn",
    competitionName: "Six Nations",
    competitionType: "international",
    competitionSlug: "six-nations",
  },
  {
    teamId: "t-sa",
    competitionId: "c-rc",
    competitionName: "Rugby Championship",
    competitionType: "domestic",
    competitionSlug: "rugby-championship",
  },
];

describe("rugbyHemisphereForTeam", () => {
  it("classifies northern and southern sides", () => {
    expect(rugbyHemisphereForTeam("England")).toBe("northern");
    expect(rugbyHemisphereForTeam("South Africa")).toBe("southern");
  });
});

describe("buildTeamPickerGroups", () => {
  it("groups clubs by competition and splits internationals by hemisphere", () => {
    const groups = buildTeamPickerGroups(
      [
        { id: "t-saracens", name: "Saracens", slug: "saracens" },
        { id: "t-england", name: "England", slug: "england" },
        { id: "t-sa", name: "South Africa", slug: "south-africa" },
      ],
      links,
      competitions,
    );

    expect(groups.map((g) => g.label)).toEqual([
      "Premiership",
      "Internationals — Northern Hemisphere",
      "Internationals — Southern Hemisphere",
    ]);
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    expect(groups[0]?.teams.map((t) => t.name)).toEqual(["Saracens"]);
    expect(groups[1]?.teams.map((t) => t.name)).toEqual(["England"]);
    expect(groups[2]?.teams.map((t) => t.name)).toEqual(["South Africa"]);
  });

  it("keeps unique group ids when competitions share the same display name", () => {
    const duplicateNameComps = [
      { id: "c-a", name: "International Matches", slug: "international-matches-a", competitionType: "domestic" },
      { id: "c-b", name: "International Matches", slug: "international-matches-b", competitionType: "domestic" },
    ];
    const duplicateLinks: TeamCompetitionLink[] = [
      {
        teamId: "t-saracens",
        competitionId: "c-a",
        competitionName: "International Matches",
        competitionType: "domestic",
        competitionSlug: "international-matches-a",
      },
      {
        teamId: "t-leicester",
        competitionId: "c-b",
        competitionName: "International Matches",
        competitionType: "domestic",
        competitionSlug: "international-matches-b",
      },
    ];

    const groups = buildTeamPickerGroups(
      [
        { id: "t-saracens", name: "Saracens", slug: "saracens" },
        { id: "t-leicester", name: "Leicester", slug: "leicester" },
      ],
      duplicateLinks,
      duplicateNameComps,
    );

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.label === "International Matches")).toBe(true);
    expect(new Set(groups.map((g) => g.id)).size).toBe(2);
  });
});
