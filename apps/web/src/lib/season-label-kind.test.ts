import { describe, expect, it } from "vitest";
import {
  formatSeasonLabelForKind,
  seasonSlugForKind,
} from "./season-label-utils";

describe("formatSeasonLabelForKind", () => {
  it("formats club vs calendar kinds", () => {
    expect(formatSeasonLabelForKind(2025, "club")).toBe("2025–26");
    expect(formatSeasonLabelForKind(2026, "international")).toBe("2026");
    expect(formatSeasonLabelForKind(2027, "tournament")).toBe("2027");
  });

  it("uses matching slugs", () => {
    expect(seasonSlugForKind(2025, "club")).toBe("2025-26");
    expect(seasonSlugForKind(2026, "international")).toBe("2026");
  });
});
