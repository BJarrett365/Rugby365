import { describe, expect, it } from "vitest";
import type { SdmsMatchPlayerStats } from "@rugby365/import-sdk";
import {
  animationStatCategoryForEvent,
  buildMatchAnimationPlayerStats,
  resolveAnimationPlayerStatChips,
} from "./match-animation-player-stats";

function emptySide() {
  return {
    attack: null,
    defend: null,
    kicking: null,
    errors: null,
    carries: null,
  };
}

describe("buildMatchAnimationPlayerStats", () => {
  it("builds profiles and category leaders from SDMS tabs", () => {
    const stats: SdmsMatchPlayerStats = {
      home: {
        ...emptySide(),
        attack: {
          match_id: "m1",
          detail_list: [
            {
              player_id: "p1",
              player_name: "Mitchell Xavier",
              metres: 42,
              defenders_beaten: 3,
              clean_breaks: 1,
            },
          ],
        },
        defend: {
          match_id: "m1",
          detail_list: [{ player_id: "p2", player_name: "Home Lock", tackles: 12 }],
        },
        carries: {
          match_id: "m1",
          detail_list: [{ player_id: "p1", player_name: "Mitchell Xavier", runs: 8, carries_metres: 40 }],
        },
      },
      away: {
        ...emptySide(),
        kicking: {
          match_id: "m1",
          detail_list: [
            { player_id: "p3", player_name: "Away Flyhalf", kick_from_hand_metres: 180, kicks_from_hand: 6 },
          ],
        },
        errors: {
          match_id: "m1",
          detail_list: [{ player_id: "p4", player_name: "Away Centre", handling_error: 2 }],
        },
      },
    };

    const bundle = buildMatchAnimationPlayerStats(stats);
    expect(bundle).not.toBeNull();
    expect(bundle!.players.length).toBeGreaterThanOrEqual(3);
    expect(bundle!.leaders.map((l) => l.category)).toEqual(
      expect.arrayContaining(["attack", "defend", "kicking", "errors", "carries"]),
    );

    const chips = resolveAnimationPlayerStatChips({
      bundle,
      playerId: "p1",
      eventType: "try",
      limit: 4,
    });
    expect(chips.some((c) => c.category === "attack" && c.metric === "metres")).toBe(true);
    expect(chips[0]?.categoryLabel).toBe("Attack");
  });

  it("maps event types to categories", () => {
    expect(animationStatCategoryForEvent("try")).toBe("attack");
    expect(animationStatCategoryForEvent("yellow_card")).toBe("attack");
    expect(animationStatCategoryForEvent("tackle")).toBe("defend");
    expect(animationStatCategoryForEvent("conversion")).toBe("kicking");
    expect(animationStatCategoryForEvent("knock_on")).toBe("errors");
    expect(animationStatCategoryForEvent("carry")).toBe("carries");
  });
});
