import { describe, expect, it } from "vitest";
import {
  COMPARE_PICKER_UNASSIGNED,
  filterComparePickerGroups,
  groupComparePickerPlayers,
  mergeComparePickerPlayers,
  resolveComparePickerClubName,
  resolveComparePickerCountryName,
  squadOptionsForNationGroup,
} from "./compare-player-picker-groups";

describe("resolveComparePickerClubName", () => {
  it("prefers a linked club team over a nation name", () => {
    expect(
      resolveComparePickerClubName({
        clubName: "England",
        clubTeamName: "Saracens",
        clubTeamType: "club",
      }),
    ).toBe("Saracens");
  });

  it("strips Wikipedia markup and drops placeholder clubs", () => {
    expect(
      resolveComparePickerClubName({
        clubName: '<span class="anchor" id="Newcastle Falcons"></span>Newcastle Falcons',
      }),
    ).toBe("Newcastle Falcons");
    expect(
      resolveComparePickerClubName({
        clubName: "Unknown team d98cbf2996f2",
      }),
    ).toBeNull();
  });

  it("drops national sides stored as the club", () => {
    expect(
      resolveComparePickerClubName({
        clubName: "France",
        clubTeamName: "France",
        clubTeamType: "international",
      }),
    ).toBeNull();
  });
});

describe("resolveComparePickerCountryName", () => {
  it("uses the player country, then nation code, then international team", () => {
    expect(
      resolveComparePickerCountryName({
        countryName: "England",
        clubName: "Saracens",
      }),
    ).toBe("England");
    expect(
      resolveComparePickerCountryName({
        countryName: null,
        nationCode: "NZ",
        clubName: "Crusaders",
      }),
    ).toBe("New Zealand");
    expect(
      resolveComparePickerCountryName({
        countryName: null,
        internationalTeamName: "Italy",
        internationalTeamType: "international",
        clubName: "Benetton",
      }),
    ).toBe("Italy");
  });

  it("falls back to the roster nation or the club's country", () => {
    expect(
      resolveComparePickerCountryName({
        countryName: null,
        rosterTeamName: "Wales",
        rosterTeamType: "international",
        clubName: "Cardiff",
      }),
    ).toBe("Wales");
    expect(
      resolveComparePickerCountryName({
        countryName: null,
        rosterTeamName: "Bath",
        rosterTeamType: "club",
        clubCountryName: "England",
        clubName: "Bath",
      }),
    ).toBe("England");
    expect(
      resolveComparePickerCountryName({
        countryName: "Barbarians",
        rosterTeamName: "New Zealand",
        rosterTeamType: "international",
        clubName: "Waikato",
      }),
    ).toBe("New Zealand");
  });
});

describe("groupComparePickerPlayers", () => {
  it("nests clubs under nations and lists players without a club as Unassigned", () => {
    const groups = groupComparePickerPlayers([
      { slug: "itoje", name: "Maro Itoje", position: "Lock", clubName: "Saracens", countryName: "England" },
      { slug: "farrell", name: "Owen Farrell", position: "Fly-half", clubName: "Saracens", countryName: "England" },
      { slug: "dupont", name: "Antoine Dupont", position: "Scrum-half", clubName: "Toulouse", countryName: "France" },
      {
        slug: "unattached-eng",
        name: "England Unattached",
        position: "Centre",
        clubName: null,
        countryName: "England",
      },
      {
        slug: "healy",
        name: "Ben Healy",
        position: "replacement",
        clubName: '<span class="anchor" id="Newcastle Falcons"></span>Newcastle Falcons',
        countryName: "Scotland",
      },
      {
        slug: "orphan",
        name: "No Club Nation",
        position: "replacement",
        clubName: "Unknown team d98cbf2996f2",
        countryName: null,
      },
    ]);

    expect(groups.map((g) => g.nation)).toEqual(["England", "France", "Scotland", COMPARE_PICKER_UNASSIGNED]);
    expect(groups[0]?.clubs.map((c) => `${c.kind}:${c.name}`)).toEqual([
      "international:England",
      "club:Saracens",
      "unassigned:Unassigned",
    ]);
    expect(groups[0]?.clubs[0]?.players.map((p) => p.slug)).toEqual(["unattached-eng", "itoje", "farrell"]);
    expect(groups[0]?.clubs[1]?.players.map((p) => p.name)).toEqual(["Maro Itoje", "Owen Farrell"]);
    expect(groups[0]?.clubs[2]?.players.map((p) => p.slug)).toEqual(["unattached-eng"]);
    expect(groups[1]?.clubs.map((c) => c.name)).toEqual(["France", "Toulouse"]);
    expect(groups[2]?.clubs.map((c) => c.name)).toEqual(["Scotland", "Newcastle Falcons"]);
    expect(groups[3]?.clubs.map((c) => `${c.kind}:${c.name}`)).toEqual(["unassigned:Unassigned"]);
  });

  it("exposes international squad first, then clubs, then unassigned", () => {
    const groups = groupComparePickerPlayers([
      { slug: "itoje", name: "Maro Itoje", position: "Lock", clubName: "Saracens", countryName: "England" },
      { slug: "unattached-eng", name: "Unattached", position: null, clubName: null, countryName: "England" },
    ]);
    const options = squadOptionsForNationGroup(groups[0]!);
    expect(options.map((option) => `${option.kind}:${option.label}`)).toEqual([
      "international:England (international)",
      "club:Saracens",
      "unassigned:Unassigned",
    ]);
    expect(options[0]?.players.map((p) => p.slug)).toEqual(["itoje", "unattached-eng"]);
  });
});

describe("filterComparePickerGroups", () => {
  const grouped = groupComparePickerPlayers([
    { slug: "itoje", name: "Maro Itoje", position: "Lock", clubName: "Saracens", countryName: "England" },
    { slug: "dupont", name: "Antoine Dupont", position: "Scrum-half", clubName: "Toulouse", countryName: "France" },
  ]);

  it("keeps a whole nation when the country name matches", () => {
    const filtered = filterComparePickerGroups(grouped, "england");
    expect(filtered.map((g) => g.nation)).toEqual(["England"]);
    expect(filtered[0]?.clubs[0]?.players.map((p) => p.slug)).toEqual(["itoje"]);
  });

  it("keeps a whole club when the club name matches", () => {
    const filtered = filterComparePickerGroups(grouped, "toulouse");
    expect(filtered.map((g) => g.nation)).toEqual(["France"]);
    expect(filtered[0]?.clubs[0]?.players.map((p) => p.slug)).toEqual(["dupont"]);
  });

  it("filters to a matching player and drops the other side", () => {
    const filtered = filterComparePickerGroups(grouped, "itoje", "dupont");
    expect(filtered.map((g) => g.nation)).toEqual(["England"]);
  });
});

describe("mergeComparePickerPlayers", () => {
  it("appends extras without duplicating slugs", () => {
    const merged = mergeComparePickerPlayers(
      [{ slug: "itoje", name: "Maro Itoje", position: "Lock", clubName: "Saracens", countryName: "England" }],
      [
        { slug: "itoje", name: "Duplicate", position: null, clubName: null, countryName: null },
        { slug: "dupont", name: "Antoine Dupont", position: null, clubName: "Toulouse", countryName: "France" },
      ],
    );
    expect(merged.map((p) => p.slug)).toEqual(["itoje", "dupont"]);
    expect(merged[0]?.name).toBe("Maro Itoje");
  });
});
