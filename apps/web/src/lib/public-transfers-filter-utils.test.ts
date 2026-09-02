import { describe, expect, it } from "vitest";
import {
  competitionFilterKey,
  dedupeCompetitionsByName,
  expandTransferSearchTerms,
  filterNamedOptionsByQuery,
  filterTransferClubGroups,
  groupSeasonsByCompetition,
  sortSeasonsGroupedByCompetition,
  dedupeSeasonsByCompetitionAndYear,
} from "./public-transfers-filter-utils";

describe("expandTransferSearchTerms", () => {
  it("adds South Africa nation aliases for south african queries", () => {
    const terms = expandTransferSearchTerms("south african");
    expect(terms.phrases).toEqual(expect.arrayContaining(["south african", "South Africa"]));
    expect(terms.codes).toEqual(expect.arrayContaining(["RSA", "ZA", "ZAF"]));
  });

  it("keeps a plain player name as a single phrase", () => {
    expect(expandTransferSearchTerms("Kolbe")).toEqual({ phrases: ["Kolbe"], codes: [] });
  });
});

describe("dedupeCompetitionsByName", () => {
  it("keeps one Challenge Cup and prefers the row with more transfers", () => {
    const rows = dedupeCompetitionsByName([
      { id: "a", name: "Challenge Cup", slug: "challenge-cup-clone", transferCount: 4 },
      { id: "b", name: "Challenge Cup", slug: "challenge-cup", transferCount: 40 },
      { id: "c", name: "Premiership", slug: "premiership", transferCount: 90 },
    ]);
    expect(rows.filter((row) => competitionFilterKey(row.name) === "challenge cup")).toHaveLength(1);
    expect(rows.find((row) => row.name === "Challenge Cup")?.id).toBe("b");
  });
});

describe("season grouping", () => {
  const seasons = [
    { id: "cc-21", label: "2021–22", year: 2021, competitionId: "cc", competitionName: "Challenge Cup" },
    { id: "pr-25", label: "2025–26", year: 2025, competitionId: "pr", competitionName: "Premiership" },
    { id: "cc-25", label: "2025–26", year: 2025, competitionId: "cc", competitionName: "Challenge Cup" },
    { id: "cc-24", label: "2024–25", year: 2024, competitionId: "cc", competitionName: "Challenge Cup" },
    { id: "pr-24", label: "2024–25", year: 2024, competitionId: "pr", competitionName: "Premiership" },
  ];

  it("groups by competition then newest season first", () => {
    const grouped = groupSeasonsByCompetition(seasons);
    expect(grouped.map(([name]) => name)).toEqual(["Challenge Cup", "Premiership"]);
    expect(grouped[0][1].map((row) => row.label)).toEqual(["2025–26", "2024–25", "2021–22"]);
    expect(grouped[1][1].map((row) => row.label)).toEqual(["2025–26", "2024–25"]);
  });

  it("does not interleave competitions when sorting", () => {
    expect(sortSeasonsGroupedByCompetition(seasons).map((row) => `${row.competitionName} ${row.label}`)).toEqual(
      [
        "Challenge Cup 2025–26",
        "Challenge Cup 2024–25",
        "Challenge Cup 2021–22",
        "Premiership 2025–26",
        "Premiership 2024–25",
      ],
    );
  });

  it("collapses legacy clone seasons for the same competition year", () => {
    const collapsed = dedupeSeasonsByCompetitionAndYear([
      {
        id: "legacy",
        label: "2025–26",
        year: 2025,
        competitionId: "cc-legacy",
        competitionName: "Challenge Cup",
        competitionSlug: "challenge-cup__legacy__aa",
      },
      {
        id: "live",
        label: "2025–26",
        year: 2025,
        competitionId: "cc",
        competitionName: "Challenge Cup",
        competitionSlug: "challenge-cup",
      },
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe("live");
  });
});

describe("team name filtering", () => {
  const teams = [
    { id: "1", name: "Vodacom Bulls" },
    { id: "2", name: "Stormers" },
    { id: "3", name: "Blue Bulls" },
    { id: "4", name: "Leinster" },
  ];

  it("keeps only teams whose names contain the typed letters", () => {
    expect(filterNamedOptionsByQuery(teams, "Bulls").map((row) => row.name)).toEqual([
      "Vodacom Bulls",
      "Blue Bulls",
    ]);
  });

  it("filters by-club groups to matching team names", () => {
    const groups = [
      { teamId: "1", teamName: "Vodacom Bulls" },
      { teamId: "2", teamName: "Stormers" },
      { teamId: "3", teamName: "Leinster" },
    ];
    expect(filterTransferClubGroups(groups, { search: "Bulls" }).map((row) => row.teamName)).toEqual([
      "Vodacom Bulls",
    ]);
    expect(filterTransferClubGroups(groups, { teamQuery: "stor" }).map((row) => row.teamName)).toEqual([
      "Stormers",
    ]);
  });
});
