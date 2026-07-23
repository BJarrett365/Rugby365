import { describe, expect, it } from "vitest";
import {
  extractProviderScorerMinutes,
  formatProviderScorerMinutes,
  normalizeProviderPlayerName,
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
