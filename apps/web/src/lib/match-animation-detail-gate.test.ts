import { describe, expect, it } from "vitest";
import { hasDetailedMatchPlayerData } from "./match-animation-detail-gate";

describe("hasDetailedMatchPlayerData", () => {
  it("accepts published events", () => {
    expect(hasDetailedMatchPlayerData({ eventCount: 3 })).toBe(true);
  });

  it("accepts full squads", () => {
    expect(hasDetailedMatchPlayerData({ squadCount: 23 })).toBe(true);
    expect(hasDetailedMatchPlayerData({ squadCount: 10 })).toBe(false);
  });

  it("accepts performance stats", () => {
    expect(hasDetailedMatchPlayerData({ performanceStatCount: 30 })).toBe(true);
  });

  it("accepts SDMS lineups", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => ({
      name: `P${i}`,
      providerId: `p${i}`,
      jerseyNumber: i + 1,
    }));
    expect(
      hasDetailedMatchPlayerData({
        lineups: {
          home: { starting: fifteen, substitutes: [] },
          away: { starting: fifteen, substitutes: [] },
        } as never,
      }),
    ).toBe(true);
  });
});
