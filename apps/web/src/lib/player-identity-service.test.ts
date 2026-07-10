import { describe, expect, it } from "vitest";
import {
  areLikelySamePlayer,
  findPlayerDuplicateGroups,
  findReversedNameRows,
  isReversedNameImport,
  playerTokenSortKey,
  suggestedCanonicalName,
} from "./player-identity-service";

describe("player identity — Bath audit examples", () => {
  it("matches Will Stuart and William Stuart", () => {
    expect(areLikelySamePlayer("Will Stuart", "William Stuart")).toBe(true);
  });

  it("matches Ewan Richards and Richards Ewan via token sort", () => {
    expect(playerTokenSortKey("Ewan Richards")).toBe(playerTokenSortKey("Richards Ewan"));
    expect(areLikelySamePlayer("Ewan Richards", "Richards Ewan")).toBe(true);
  });

  it("matches Thompson Cowan and Cowan Tom", () => {
    expect(suggestedCanonicalName("Cowan Tom")).toBe("Thompson Cowan");
    expect(areLikelySamePlayer("Thompson Cowan", "Cowan Tom")).toBe(true);
  });

  it("matches Neil le Roux and Le Roux Neil", () => {
    expect(suggestedCanonicalName("Le Roux Neil")).toBe("Neil le Roux");
    expect(areLikelySamePlayer("Neil le Roux", "Le Roux Neil")).toBe(true);
  });

  it("matches Sam Harris and Harris Sam", () => {
    expect(suggestedCanonicalName("Harris Sam")).toBe("Sam Harris");
    expect(areLikelySamePlayer("Sam Harris", "Harris Sam")).toBe(true);
  });

  it("flags reversed SDMS imports", () => {
    expect(isReversedNameImport("Cowan Tom")).toBe(true);
    expect(isReversedNameImport("Will Stuart")).toBe(false);
  });

  it("groups duplicate identities on a squad list", () => {
    const groups = findPlayerDuplicateGroups([
      { id: "a", name: "Will Stuart" },
      { id: "b", name: "William Stuart" },
      { id: "c", name: "Sam Harris" },
      { id: "d", name: "Harris Sam" },
    ]);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.some((group) => group.canonicalName === "Will Stuart")).toBe(true);
    expect(groups.some((group) => group.canonicalName === "Sam Harris")).toBe(true);
  });

  it("lists reversed name corrections", () => {
    const reversed = findReversedNameRows([
      { id: "1", name: "Richards Ewan" },
      { id: "2", name: "Bath Player" },
    ]);
    expect(reversed).toHaveLength(1);
    expect(reversed[0]?.suggestedName).toBe("Ewan Richards");
  });
});
