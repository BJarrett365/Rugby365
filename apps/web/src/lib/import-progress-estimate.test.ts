import { describe, expect, it } from "vitest";
import { estimateImportDurationSeconds, formatImportDuration } from "./import-progress-estimate";

describe("estimateImportDurationSeconds", () => {
  it("estimates longer for all-season full imports", () => {
    const single = estimateImportDurationSeconds({
      seasonCount: 1,
      resultCount: 100,
      importMatchDetails: true,
      mode: "full",
    });
    const all = estimateImportDurationSeconds({
      seasonCount: 5,
      resultCount: 100,
      importAllSeasons: true,
      importMatchDetails: true,
      mode: "full",
    });
    expect(all).toBeGreaterThan(single);
  });

  it("formats mm:ss durations", () => {
    expect(formatImportDuration(125)).toBe("2:05");
  });
});
