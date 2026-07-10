import { describe, expect, it } from "vitest";
import {
  competitionsForPicker,
  defaultCompetitionId,
  dedupeCompetitionsByName,
} from "./competition-list-utils";

describe("competition-list-utils", () => {
  it("dedupes competitions with the same display name", () => {
    const rows = [
      { id: "a", name: "International Matches", slug: "international-matches-5", activeSeason: { id: "s1", isActive: true } },
      { id: "b", name: "International Matches", slug: "international-matches-n062z68w", activeSeason: { id: "s2", isActive: true } },
      { id: "c", name: "Premiership", slug: "premiership", activeSeason: { id: "s3", isActive: true } },
    ];

    const deduped = dedupeCompetitionsByName(rows);
    expect(deduped).toHaveLength(2);
    expect(deduped.filter((row) => row.name === "International")).toHaveLength(1);
  });

  it("canonicalizes International Matches to International", () => {
    const rows = competitionsForPicker([
      { id: "intl", name: "International", slug: "international-d4d130ba", activeSeason: null },
      { id: "matches", name: "International Matches", slug: "international-matches-5", activeSeason: { id: "s1", isActive: true } },
      { id: "prem", name: "Premiership", slug: "premiership", activeSeason: { id: "s2", isActive: true } },
    ]);

    expect(rows.map((row) => row.name)).toEqual(["International", "Premiership"]);
  });

  it("defaults to Premiership when no URL override is present", () => {
    const rows = [
      { id: "prem", name: "Premiership", slug: "premiership", activeSeason: { id: "s1", isActive: true } },
      { id: "six", name: "Six Nations", slug: "six-nations", activeSeason: { id: "s2", isActive: true } },
    ];

    expect(defaultCompetitionId(rows)).toBe("prem");
  });
});
