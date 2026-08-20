import { describe, expect, it } from "vitest";
import {
  extractProviderScorerMinutes,
  formatProviderScorerMinutes,
  lookupPlayerLink,
  normalizeProviderPlayerName,
  playerNameLookupKeys,
  type MatchEntityContext,
} from "./match-entity-context";

describe("provider scorer minutes", () => {
  it("strips multi-minute suffixes from player names for linking", () => {
    expect(normalizeProviderPlayerName("Moyo Simphiwe Vusi (5', 14', 41')")).toBe(
      "Moyo Simphiwe Vusi",
    );
  });

  it("keeps all conversion minutes from SDMS scoring detail names", () => {
    expect(
      extractProviderScorerMinutes({
        player_name: "Moyo Simphiwe Vusi (5', 14', 41')",
        minute: 5,
      }),
    ).toEqual([5, 14, 41]);
    expect(formatProviderScorerMinutes([5, 14, 41])).toBe(" (5', 14', 41')");
  });

  it("falls back to the single minute field when name has no minutes", () => {
    expect(
      extractProviderScorerMinutes({
        player_name: "Manie Libbok",
        minute: 79,
      }),
    ).toEqual([79]);
  });
});

describe("player name lookup keys", () => {
  it("includes reversed given/family order", () => {
    expect(playerNameLookupKeys("Sam Clarke")).toEqual(
      expect.arrayContaining(["sam clarke", "clarke sam"]),
    );
  });
});

describe("lookupPlayerLink", () => {
  it("matches reversed provider names against CMS profiles", () => {
    const link = {
      id: "1",
      slug: "sam-clarke",
      name: "Sam Clarke",
      externalProviderId: "abc",
    };
    const context: MatchEntityContext = {
      playersByExternalId: { abc: link },
      playersByName: Object.fromEntries(playerNameLookupKeys(link.name).map((k) => [k, link])),
      teamsByExternalId: {},
      homeTeam: null,
      awayTeam: null,
      squadPlayerIds: [],
    };
    expect(lookupPlayerLink(context, { name: "Clarke Sam" })?.slug).toBe("sam-clarke");
    expect(lookupPlayerLink(context, { externalId: "abc" })?.slug).toBe("sam-clarke");
  });
});
