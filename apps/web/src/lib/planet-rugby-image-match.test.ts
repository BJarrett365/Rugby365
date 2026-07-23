import { describe, expect, it } from "vitest";
import {
  canonicalizePlanetRugbyImageUrl,
  isAllowedPlanetRugbyImageUrl,
  unwrapPlanetRugbyImageUrl,
} from "./planet-rugby-image-utils";
import {
  canAutoApproveImageConfidence,
  scorePlanetRugbyImageMatch,
} from "./planet-rugby-image-match";

describe("planet rugby image utils", () => {
  it("unwraps ps-aws proxy URLs", () => {
    const wrapped =
      "https://images.ps-aws.com/c?url=https%3A%2F%2Fd3gbf3ykm8gp5c.cloudfront.net%2Fcontent%2Fuploads%2F2025%2F02%2F20102843%2FHarry-Wilson-on-the-charge-Australia-v-NZ-2024-Alamy-1320x742.jpg";
    const unwrapped = unwrapPlanetRugbyImageUrl(wrapped);
    expect(unwrapped).toContain("d3gbf3ykm8gp5c.cloudfront.net");
    expect(isAllowedPlanetRugbyImageUrl(wrapped)).toBe(true);
    expect(isAllowedPlanetRugbyImageUrl("https://example.com/photo.jpg")).toBe(false);
  });

  it("canonicalises size suffixes", () => {
    const sized =
      "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/07/25140642/Harry-Wilson-Wallabies-1320x742.jpg";
    expect(canonicalizePlanetRugbyImageUrl(sized)).toBe(
      "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/07/25140642/Harry-Wilson-Wallabies.jpg",
    );
  });
});

describe("planet rugby image confidence", () => {
  const ctx = {
    playerName: "Harry Wilson",
    clubName: "Queensland Reds",
    internationalTeamName: "Wallabies",
  };

  it("scores high when alt name and team match", () => {
    const result = scorePlanetRugbyImageMatch(
      {
        imageUrl:
          "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/07/25140642/Harry-Wilson-Wallabies.jpg",
        altText: "Harry Wilson carrying the ball into contact v the British and Irish Lions",
        articleTitle: "Wallabies: Harry Wilson lays down challenge",
      },
      ctx,
    );
    expect(result.level).toBe("high");
    expect(canAutoApproveImageConfidence(result.level)).toBe(true);
  });

  it("scores low without strong name attribution", () => {
    const result = scorePlanetRugbyImageMatch(
      {
        imageUrl:
          "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2026/07/13134617/Fin-Smith-and-Ronan-OGara-1.jpg",
        altText: "England fly-half Fin Smith and Ireland legend Ronan O'Gara",
        articleTitle: "Ronan O'Gara England fly-half theory",
      },
      ctx,
    );
    expect(result.level).toBe("low");
    expect(canAutoApproveImageConfidence(result.level)).toBe(false);
  });
});
