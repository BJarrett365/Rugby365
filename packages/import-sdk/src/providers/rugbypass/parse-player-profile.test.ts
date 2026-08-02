import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildRugbyPassMatchImportKey,
  cmsPlayerSlugToRugbyPassSlug,
  inferPlayerTeamFromMatch,
  parseMatchTitle,
  parseRugbyPassPlayerProfile,
  parseRugbyPassPlayerSlug,
  rugbyPassPlayerSlugCandidates,
} from "./parse-player-profile";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(fixtureDir, "fixtures/adam-brocklebank.html"), "utf8");

describe("parseRugbyPassPlayerSlug", () => {
  it("parses full RugbyPass player URLs", () => {
    expect(parseRugbyPassPlayerSlug("https://www.rugbypass.com/players/adam-brocklebank/")).toBe(
      "adam-brocklebank",
    );
    expect(parseRugbyPassPlayerSlug("https://www.rugbypass.com/players/pierre-schoeman/")).toBe(
      "pierre-schoeman",
    );
  });

  it("accepts bare slugs", () => {
    expect(parseRugbyPassPlayerSlug("adam-brocklebank")).toBe("adam-brocklebank");
  });
});

describe("cmsPlayerSlugToRugbyPassSlug", () => {
  it("strips Sport365 external id suffix from CMS slugs", () => {
    expect(cmsPlayerSlugToRugbyPassSlug("alapati-leiua-294ok068", "294ok068")).toBe(
      "alapati-leiua",
    );
    expect(cmsPlayerSlugToRugbyPassSlug("adam-brocklebank-016owj5k", "016owj5k")).toBe(
      "adam-brocklebank",
    );
  });

  it("leaves RugbyPass-native slugs unchanged", () => {
    expect(cmsPlayerSlugToRugbyPassSlug("pierre-schoeman")).toBe("pierre-schoeman");
    expect(cmsPlayerSlugToRugbyPassSlug("adam-brocklebank", "016owj5k")).toBe("adam-brocklebank");
  });
});

describe("rugbyPassPlayerSlugCandidates", () => {
  it("returns stripped slug after CMS slug with external id", () => {
    expect(
      rugbyPassPlayerSlugCandidates(
        "https://www.rugbypass.com/players/alapati-leiua-294ok068/",
        "294ok068",
      ),
    ).toEqual(["alapati-leiua-294ok068", "alapati-leiua"]);
  });
});

describe("parseRugbyPassPlayerProfile", () => {
  it("extracts profile details and embedded JSON stats from fixture HTML", () => {
    const profile = parseRugbyPassPlayerProfile(
      fixtureHtml,
      "https://www.rugbypass.com/players/adam-brocklebank/",
    );
    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe("Adam Brocklebank");
    expect(profile?.nationality).toBe("England");
    expect(profile?.age).toBe(30);
    expect(profile?.position).toBe("Prop");
    expect(profile?.heightCm).toBe(187);
    expect(profile?.weightKg).toBe(125);
    expect(profile?.currentTeam).toBe("Newcastle");
    expect(profile?.rugbypassPlayerId).toBe("24106");
    expect(profile?.seasonStats.length).toBeGreaterThan(0);
    expect(profile?.recentMatches.length).toBeGreaterThan(0);
    expect(profile?.recentMatches[0]?.matchTitle).toMatch(/vs/);
  });

  it("is idempotent for import keys", () => {
    const first = parseRugbyPassPlayerProfile(fixtureHtml, "https://www.rugbypass.com/players/adam-brocklebank/");
    const second = parseRugbyPassPlayerProfile(fixtureHtml, "https://www.rugbypass.com/players/adam-brocklebank/");
    expect(first?.recentMatches.map((m) => m.importKey)).toEqual(
      second?.recentMatches.map((m) => m.importKey),
    );
  });
});

describe("match helpers", () => {
  it("parses Bath vs Newcastle titles", () => {
    expect(parseMatchTitle("Bath vs Newcastle")).toEqual({
      home: "Bath",
      away: "Newcastle",
    });
  });

  it("infers the player team from opposition", () => {
    expect(inferPlayerTeamFromMatch("Bath vs Newcastle", "Bath", "Newcastle")).toBe("Newcastle");
  });

  it("builds stable import keys", () => {
    const key = buildRugbyPassMatchImportKey({
      rugbypassPlayerId: "24106",
      slug: "adam-brocklebank",
      kickoffUnix: 1778936400,
      matchTitle: "Bath vs Newcastle",
    });
    expect(key).toBe("rugbypass:match:24106:1778936400:bath-vs-newcastle");
  });

  it("parses og:image when player-image class is absent", () => {
    const html = `<html><head><meta property="og:image" content="https://cdn.example/players/maro-itoje.jpg" /></head><body><h1>Maro Itoje</h1></body></html>`;
    expect(parseRugbyPassPlayerProfile(html, "https://www.rugbypass.com/players/maro-itoje/")?.imageUrl).toBe(
      "https://cdn.example/players/maro-itoje.jpg",
    );
  });
});
