import { describe, expect, it } from "vitest";
import {
  PLAYER_BADGE_METALS,
  playerBadgeRarityFromRating,
} from "./player-badge-tier";

describe("playerBadgeRarityFromRating", () => {
  it("maps rating bands to rarity metals", () => {
    expect(playerBadgeRarityFromRating(null)).toBe("bronze");
    expect(playerBadgeRarityFromRating(55)).toBe("bronze");
    expect(playerBadgeRarityFromRating(80)).toBe("silver");
    expect(playerBadgeRarityFromRating(90)).toBe("elite");
    expect(playerBadgeRarityFromRating(93)).toBe("elite");
    expect(playerBadgeRarityFromRating(94)).toBe("world_class");
    expect(playerBadgeRarityFromRating(96)).toBe("world_class");
    expect(playerBadgeRarityFromRating(98)).toBe("gold");
    expect(playerBadgeRarityFromRating(99)).toBe("legend");
  });

  it("defines design-system metal bases", () => {
    expect(PLAYER_BADGE_METALS.bronze.base).toBe("#8A5A2B");
    expect(PLAYER_BADGE_METALS.silver.base).toBe("#BFC5CC");
    expect(PLAYER_BADGE_METALS.gold.base).toBe("#D8B04A");
    expect(PLAYER_BADGE_METALS.elite.base).toBe("#2E6DB5");
    expect(PLAYER_BADGE_METALS.world_class.base).toBe("#7A3FE5");
    expect(PLAYER_BADGE_METALS.legend.base).toBe("#121212");
  });
});
