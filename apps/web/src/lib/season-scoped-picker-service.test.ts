import { describe, expect, it } from "vitest";
import { buildTeamPickerGroups, type TeamCompetitionLink } from "./team-picker-groups";
import {
  canonicalTeamDisplayName,
  canonicalTeamIdentityKey,
  dedupeSeasonTeamsByCanonicalIdentity,
  type SeasonScopedTeamRow,
} from "./season-scoped-picker-service";

const CURRENT_PREMIERSHIP_TEAMS = [
  "Bath",
  "Bristol Bears",
  "Exeter Chiefs",
  "Gloucester Rugby",
  "Harlequins",
  "Leicester Tigers",
  "Newcastle Red Bulls",
  "Northampton Saints",
  "Sale Sharks",
  "Saracens",
];

function premTeam(id: string, name: string, source: "standings" | "fixtures" = "standings"): SeasonScopedTeamRow {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    shortName: null,
    countryName: "England",
    canonicalName: name,
    source,
  };
}

describe("season-scoped team dedupe", () => {
  it("merges Bristol Rugby into Bristol Bears", () => {
    const rows = dedupeSeasonTeamsByCanonicalIdentity(
      [premTeam("bristol-old", "Bristol Rugby"), premTeam("bristol-new", "Bristol Bears")],
      "premiership",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Bristol Bears");
  });

  it("merges Newcastle Falcons into Newcastle Red Bulls", () => {
    const rows = dedupeSeasonTeamsByCanonicalIdentity(
      [
        premTeam("newcastle-falcons", "Newcastle Falcons"),
        premTeam("newcastle-red-bulls", "Newcastle Red Bulls"),
      ],
      "premiership",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Newcastle Red Bulls");
  });

  it("displays Gloucester as Gloucester Rugby", () => {
    expect(canonicalTeamDisplayName("premiership", "Gloucester")).toBe("Gloucester Rugby");
    const rows = dedupeSeasonTeamsByCanonicalIdentity([premTeam("glos", "Gloucester")], "premiership");
    expect(rows[0]?.name).toBe("Gloucester Rugby");
  });

  it("current Premiership season team list excludes historic clubs when scoped correctly", () => {
    const currentSeasonStandings = [
      ...CURRENT_PREMIERSHIP_TEAMS.map((name, index) => premTeam(`t-${index}`, name)),
      premTeam("wasps", "Wasps"),
      premTeam("irish", "London Irish"),
    ];
    const deduped = dedupeSeasonTeamsByCanonicalIdentity(currentSeasonStandings, "premiership");
    const names = deduped.map((row) => row.name);
    expect(names).toContain("Bristol Bears");
    expect(names).not.toContain("Bristol Rugby");
    expect(names.filter((name) => name === "Newcastle Red Bulls")).toHaveLength(1);
  });

  it("historic Premiership season can retain historic club names when present in scoped standings", () => {
    const historic = [
      premTeam("wasps", "Wasps"),
      premTeam("irish", "London Irish"),
      premTeam("worcester", "Worcester Warriors"),
    ];
    const deduped = dedupeSeasonTeamsByCanonicalIdentity(historic, "premiership");
    expect(deduped.map((row) => row.name).sort()).toEqual(
      ["London Irish", "Wasps", "Worcester Warriors"].sort(),
    );
  });

  it("only applies Premiership alias map for premiership slug", () => {
    expect(canonicalTeamIdentityKey("premiership", "Bristol Rugby")).toBe(
      canonicalTeamIdentityKey("premiership", "Bristol Bears"),
    );
    expect(canonicalTeamIdentityKey("top-14", "Bristol Rugby")).toBe("bristol rugby");
    expect(canonicalTeamIdentityKey("top-14", "Bristol Bears")).toBe("bristol bears");
  });
});

describe("expected current Premiership squad shape", () => {
  it("matches the 10-club current season set when standings are clean", () => {
    const cleanCurrent = CURRENT_PREMIERSHIP_TEAMS.map((name, index) => premTeam(`t-${index}`, name));
    const names = dedupeSeasonTeamsByCanonicalIdentity(cleanCurrent, "premiership")
      .map((row) => row.name)
      .sort();
    expect(names).toEqual([...CURRENT_PREMIERSHIP_TEAMS].sort());
    expect(names).not.toContain("London Irish");
    expect(names).not.toContain("Wasps");
  });
});

describe("competition-scoped team groups", () => {
  it("does not leak teams from other competitions when links are season-scoped", () => {
    const premTeams = CURRENT_PREMIERSHIP_TEAMS.slice(0, 2).map((name, index) =>
      premTeam(`prem-${index}`, name),
    );
    const links: TeamCompetitionLink[] = premTeams.map((team) => ({
      teamId: team.id,
      competitionId: "c-prem",
      competitionName: "Premiership",
      competitionType: "domestic",
      competitionSlug: "premiership",
    }));
    const groups = buildTeamPickerGroups(premTeams, links, [
      { id: "c-prem", name: "Premiership", slug: "premiership", competitionType: "domestic" },
      { id: "c-top14", name: "Top 14", slug: "top-14", competitionType: "domestic" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Premiership");
    expect(groups[0]?.teams).toHaveLength(2);
  });
});
