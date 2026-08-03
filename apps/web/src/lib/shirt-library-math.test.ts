import { describe, expect, it } from "vitest";
import {
  checkNumberContrast,
  checkShirtColourClash,
  colourDistance,
  contrastRatio,
  parseHexColour,
  teamSetStatus,
} from "./shirt-library-math";

describe("shirt-library-math", () => {
  it("parses hex colours", () => {
    expect(parseHexColour("#006B3C")).toEqual([0, 107, 60]);
    expect(parseHexColour("#fff")).toEqual([255, 255, 255]);
  });

  it("measures contrast for readable numbers", () => {
    const whiteOnGreen = checkNumberContrast({
      numberColour: "#FFFFFF",
      bodyColour: "#006B3C",
    });
    expect(whiteOnGreen.ok).toBe(true);
    expect((whiteOnGreen.ratio ?? 0) > 3).toBe(true);

    const darkOnDark = checkNumberContrast({
      numberColour: "#111111",
      bodyColour: "#00205B",
    });
    expect(darkOnDark.ok).toBe(false);
    expect(darkOnDark.suggestedNumberColour).toBe("#FFFFFF");
  });

  it("flags colour clash between similar shirts", () => {
    const clash = checkShirtColourClash({
      shirtAName: "England home",
      shirtABody: "#FFFFFF",
      shirtBName: "Fiji home",
      shirtBBody: "#FAFAFA",
    });
    expect(clash.clash).toBe(true);
    expect(clash.warning).toMatch(/Colour clash/);

    const ok = checkShirtColourClash({
      shirtAName: "South Africa home",
      shirtABody: "#006B3C",
      shirtBName: "Wales home",
      shirtBBody: "#C8102E",
    });
    expect(ok.clash).toBe(false);
  });

  it("computes team set status", () => {
    expect(
      teamSetStatus({ homeStatus: null, awayStatus: null }),
    ).toBe("Not Started");
    expect(
      teamSetStatus({ homeStatus: "APPROVED", awayStatus: "APPROVED" }),
    ).toBe("Fully Approved");
    expect(
      teamSetStatus({ homeStatus: "APPROVED", awayStatus: "DRAFT" }),
    ).toBe("Partly Approved");
    expect(
      teamSetStatus({ homeStatus: "CHANGES_REQUIRED", awayStatus: "APPROVED" }),
    ).toBe("Needs Changes");
  });

  it("contrast ratio is symmetric-ish", () => {
    const a = contrastRatio("#000000", "#FFFFFF");
    expect(a).toBeGreaterThan(20);
    expect(colourDistance("#000000", "#FFFFFF")).toBeGreaterThan(400);
  });
});
