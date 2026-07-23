import { describe, expect, it } from "vitest";
import {
  canOptimizeMediaUrl,
  defaultAltText,
  objectPositionFromFocal,
  MEDIA_ASPECT,
} from "./media-tokens";

describe("media-tokens", () => {
  it("detects Planet Rugby / Wikimedia hosts for next/image", () => {
    expect(canOptimizeMediaUrl("https://images.ps-aws.com/foo.jpg")).toBe(true);
    expect(canOptimizeMediaUrl("https://upload.wikimedia.org/wikipedia/commons/a.jpg")).toBe(true);
    expect(canOptimizeMediaUrl("https://evil.example/x.jpg")).toBe(false);
    expect(canOptimizeMediaUrl(null)).toBe(false);
  });

  it("builds default alt text", () => {
    expect(defaultAltText("Finn Russell", "headshot")).toBe("Finn Russell headshot");
  });

  it("maps focal points to object-position", () => {
    expect(objectPositionFromFocal(50, 28)).toBe("50% 28%");
    expect(objectPositionFromFocal(null, 10)).toBeUndefined();
  });

  it("exposes portrait aspect for player heroes", () => {
    expect(MEDIA_ASPECT.portrait).toBe("3 / 4");
    expect(MEDIA_ASPECT.og).toBe("1.91 / 1");
  });
});
