import { describe, expect, it } from "vitest";
import {
  buildCoachTeamResolver,
  coachStintTeamMatchesCmsTeam,
  extractCountryFromCoachStintTeamName,
  parseCoachedCountryFromCoachNotes,
} from "./coach-team-resolve-service";

const CMS_TEAMS = [
  { id: "england-id", name: "England", slug: "england", shortName: "ENG" },
  { id: "wales-id", name: "Wales", slug: "wales", shortName: "WAL" },
  { id: "lions-id", name: "British & Irish Lions", slug: "british-and-irish-lions", shortName: "LIO" },
  { id: "long-england-id", name: "England national rugby union team", slug: "england-national", shortName: null },
];

describe("coach-team-resolve-service", () => {
  it("matches Wikipedia stint labels to CMS team names", () => {
    expect(coachStintTeamMatchesCmsTeam("England national rugby union team", "England")).toBe(true);
    expect(coachStintTeamMatchesCmsTeam("Leicester Tigers", "England")).toBe(false);
  });

  it("extracts country names from stint labels", () => {
    expect(extractCountryFromCoachStintTeamName("Wales national rugby union team")).toBe("Wales");
  });

  it("resolves Wikipedia labels to canonical CMS teams", () => {
    const resolver = buildCoachTeamResolver(CMS_TEAMS);
    expect(resolver.resolveWikipediaTeamLabel("England national rugby union team")?.id).toBe("england-id");
    expect(resolver.resolveWikipediaTeamLabel("British & Irish Lions")?.id).toBe("lions-id");
  });

  it("finds canonical CMS team for duplicate long national names", () => {
    const resolver = buildCoachTeamResolver(CMS_TEAMS);
    const duplicate = CMS_TEAMS.find((team) => team.id === "long-england-id")!;
    expect(resolver.findCanonicalTeamForExisting(duplicate)?.id).toBe("england-id");
  });

  it("parses coached country from coach notes", () => {
    expect(parseCoachedCountryFromCoachNotes("Coached country: Wales · Nationality: Welsh")).toBe("Wales");
  });
});
