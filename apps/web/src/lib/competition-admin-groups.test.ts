import { describe, expect, it } from "vitest";
import {
  competitionAdminDisplayName,
  competitionAdminGroup,
  groupCompetitionsForAdmin,
} from "./competition-admin-groups";

describe("competition-admin-groups", () => {
  it("maps known slugs into the preferred hierarchy", () => {
    expect(competitionAdminGroup({ slug: "npc" })).toBe("provincial");
    expect(competitionAdminGroup({ slug: "npc-n0628z68" })).toBe("provincial");
    expect(competitionAdminGroup({ slug: "premiership" })).toBe("club");
    expect(competitionAdminGroup({ slug: "six-nations" })).toBe("international");
    expect(competitionAdminGroup({ slug: "rugby-europe-championship" })).toBe("regional");
    expect(competitionAdminGroup({ slug: "currie-cup-pd9ro98v" })).toBe("provincial");
  });

  it("uses preferred display names", () => {
    expect(competitionAdminDisplayName({ slug: "super-rugby", name: "Super Rugby" })).toBe(
      "Super Rugby Pacific",
    );
    expect(
      competitionAdminDisplayName({ slug: "nations-championship", name: "Nations Championship" }),
    ).toBe("World Rugby Nations Championship");
  });

  it("groups and orders competitions for admin UI", () => {
    const groups = groupCompetitionsForAdmin([
      { slug: "npc", name: "NPC", competitionType: "domestic" },
      { slug: "premiership", name: "Premiership", competitionType: "domestic" },
      { slug: "six-nations", name: "Six Nations", competitionType: "international" },
      { slug: "rugby-europe-championship", name: "REC", competitionType: "international" },
      { slug: "mystery-league", name: "Mystery", competitionType: "domestic" },
    ]);

    expect(groups.map((g) => g.id)).toEqual([
      "international",
      "club",
      "provincial",
      "regional",
      "other",
    ]);
    expect(groups[0].competitions.map((c) => c.slug)).toEqual(["six-nations"]);
    expect(groups[1].competitions.map((c) => c.slug)).toEqual(["premiership"]);
    expect(groups[2].competitions.map((c) => c.slug)).toEqual(["npc"]);
    expect(groups[3].competitions.map((c) => c.slug)).toEqual(["rugby-europe-championship"]);
    expect(groups[4].competitions.map((c) => c.slug)).toEqual(["mystery-league"]);
  });

  it("places historic and new club comps in the right groups", () => {
    expect(competitionAdminGroup({ slug: "heineken-cup" })).toBe("historic");
    expect(competitionAdminGroup({ slug: "pro-d2" })).toBe("club");
    expect(competitionAdminGroup({ slug: "farah-palmer-cup" })).toBe("provincial");
    expect(competitionAdminDisplayName({ slug: "british-irish-lions", name: "Lions" })).toBe(
      "British & Irish Lions Tours",
    );
  });
});
