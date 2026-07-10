import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseWorldRugbyRankings, worldRugbyRankingsUrl } from "./parse-rankings";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

describe("parseWorldRugbyRankings", () => {
  it("parses men's rankings sample", () => {
    const raw = JSON.parse(
      readFileSync(join(fixtureDir, "fixtures/mru-rankings-sample.json"), "utf8"),
    );
    const parsed = parseWorldRugbyRankings("mru", raw);

    expect(parsed.label).toBe("Mens Rugby Union");
    expect(parsed.effectiveDate).toBe("2026-07-06");
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0]).toMatchObject({
      position: 1,
      team: { name: "South Africa", abbreviation: "RSA" },
    });
    expect(parsed.entries[2].previousPosition).toBe(7);
  });

  it("builds the public API URL", () => {
    expect(worldRugbyRankingsUrl("wru")).toBe(
      "https://api.wr-rims-prod.pulselive.com/rugby/v3/rankings/wru?language=en",
    );
  });
});
