import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseRugbyPassPlayerProfile,
} from "@rugby365/import-sdk";
import { namesLikelyMatch } from "./player-profile-enrichment-service";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  fixtureDir,
  "../../../../packages/import-sdk/src/providers/rugbypass/fixtures/adam-brocklebank.html",
);

describe("rugbypass player matching", () => {
  const html = readFileSync(fixturePath, "utf8");
  const profile = parseRugbyPassPlayerProfile(
    html,
    "https://www.rugbypass.com/players/adam-brocklebank/",
  )!;

  it("matches player names from RugbyPass profile", () => {
    expect(namesLikelyMatch("Adam Brocklebank", profile.displayName)).toBe(true);
    expect(namesLikelyMatch("Totally Different", profile.displayName)).toBe(false);
  });

  it("keeps stable match import keys across parses", () => {
    const again = parseRugbyPassPlayerProfile(
      html,
      "https://www.rugbypass.com/players/adam-brocklebank/",
    )!;
    expect(profile.recentMatches[0]?.importKey).toBe(again.recentMatches[0]?.importKey);
    expect(profile.recentMatches[0]?.importKey).toMatch(/^rugbypass:match:24106:/);
  });
});
