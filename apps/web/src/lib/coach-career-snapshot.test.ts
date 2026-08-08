import { describe, expect, it } from "vitest";

// Mirror label helper behaviour used by public coach snapshot builder.
function internationalCapsLabel(
  nationality: string | null | undefined,
  stintCountry: string | null | undefined,
): string {
  const raw = (stintCountry || nationality || "INTL").trim();
  const lower = raw.toLowerCase();
  const known: Record<string, string> = {
    "south africa": "SA",
    "new zealand": "NZ",
  };
  if (known[lower]) return `${known[lower]} CAPS`;
  return `${raw.slice(0, 3).toUpperCase()} CAPS`;
}

describe("career snapshot labels", () => {
  it("maps South Africa to SA CAPS", () => {
    expect(internationalCapsLabel("South Africa", null)).toBe("SA CAPS");
    expect(internationalCapsLabel(null, "South Africa")).toBe("SA CAPS");
  });
});
