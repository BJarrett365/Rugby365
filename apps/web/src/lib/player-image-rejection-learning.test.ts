import { describe, expect, it } from "vitest";
import {
  applyLearningRulesToScore,
  builtinNegativeMatch,
  extractLearningDraftsFromRejection,
} from "./player-image-rejection-learning";
import { scorePlanetRugbyImageMatch } from "./planet-rugby-image-match";

describe("learn from rejected images", () => {
  it("flags promo banner builtins", () => {
    const hit = builtinNegativeMatch({
      imageUrl:
        "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2026/05/12131719/Barbarians-v-Wales-Banner.jpg",
      altText: "Barbarians v Wales 50% off ticket offer",
    });
    expect(hit.matched).toBe(true);
  });

  it("scores promo banner as zero low", () => {
    const result = scorePlanetRugbyImageMatch(
      {
        imageUrl:
          "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2026/05/12131719/Barbarians-v-Wales-Banner.jpg",
        altText: "Barbarians v Wales 50% off ticket offer",
        articleTitle: "Rugby Transfers: All Black linked with shock URC switch",
        articleBodySnippet: "Theo McFarland has been linked",
      },
      { playerName: "Theo McFarland", clubName: "Saracens" },
    );
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
  });

  it("extracts proposals from a rejection", () => {
    const drafts = extractLearningDraftsFromRejection({
      playerId: "p1",
      playerName: "Theo McFarland",
      imageId: "img1",
      imageUrl:
        "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/12/28151412/Player-Ratings-key1.jpg",
      status: "rejected",
    });
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.some((d) => d.kind === "block_url_substring")).toBe(true);
  });

  it("applies approved learning penalties", () => {
    const out = applyLearningRulesToScore({
      imageUrl: "https://cdn.example/Player-Ratings-key1.jpg",
      baseScore: 50,
      rules: [
        {
          kind: "penalty_filename_pattern",
          pattern: "ratings-key",
          penalty: 40,
          scope: "global",
        },
      ],
    });
    expect(out.score).toBe(10);
  });
});
