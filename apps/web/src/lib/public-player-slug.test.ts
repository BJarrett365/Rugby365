import { describe, expect, it } from "vitest";
import { publicPlayerSlugCandidates } from "./public-player-slug";

describe("publicPlayerSlugCandidates", () => {
  it("keeps an exact ranking slug first", () => {
    expect(publicPlayerSlugCandidates("ruan-pienaar-10574")[0]).toBe("ruan-pienaar-10574");
  });

  it("maps duplicate Hougaard slugs onto the rankings URL", () => {
    expect(publicPlayerSlugCandidates("francois-hougaard")).toContain(
      "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
    );
    expect(publicPlayerSlugCandidates("francois-hougaard-x91ng0jw__legacy__2f59ab8f")[0]).toBe(
      "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
    );
  });

  it("maps Tendai Mtawarira legacy slug onto the public rankings slug", () => {
    expect(publicPlayerSlugCandidates("tendai-mtawarira-10521__legacy__dfbea838")).toContain(
      "tendai-mtawarira-10521",
    );
  });

  it("maps retired Jaco Taute junk slugs onto jaco-taute", () => {
    expect(publicPlayerSlugCandidates("jaco-taute-retired")).toContain("jaco-taute");
  });
});
