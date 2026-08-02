import { describe, expect, it } from "vitest";
import {
  RUGBY_DATA_API_ENDPOINTS,
  buildRugbyDataApiProxyUrl,
  buildRugbyUnionPath,
  isValidRugbyUnionPath,
} from "./rugby-data-api-endpoints";

describe("rugby union route paths", () => {
  it("builds paths from segments", () => {
    expect(buildRugbyUnionPath(["teams"])).toBe("/api/v1/rugby-union/teams");
    expect(buildRugbyUnionPath(["match", "7581", "info"])).toBe(
      "/api/v1/rugby-union/match/7581/info",
    );
  });

  it("rejects traversal paths", () => {
    expect(isValidRugbyUnionPath("/api/v1/rugby-union/../admin")).toBe(false);
    expect(isValidRugbyUnionPath("/api/v1/rugby-union/teams")).toBe(true);
    expect(isValidRugbyUnionPath("/api/admin/teams")).toBe(false);
  });
});

describe("RUGBY_DATA_API_ENDPOINTS", () => {
  it("includes all Postman collection groups", () => {
    const groups = new Set(RUGBY_DATA_API_ENDPOINTS.map((endpoint) => endpoint.group));
    expect(groups).toEqual(
      new Set([
        "Match Detail",
        "Match Listing",
        "League Detail",
        "Team Detail",
        "Discovery",
      ]),
    );
  });

  it("covers core match, league and discovery paths", () => {
    const samplePaths = RUGBY_DATA_API_ENDPOINTS.map((endpoint) => endpoint.samplePath);
    expect(samplePaths).toContain("/api/v1/rugby-union/match/7581/info");
    expect(samplePaths).toContain("/api/v1/rugby-union/matches");
    expect(samplePaths).toContain("/api/v1/rugby-union/league/193/table");
    expect(samplePaths).toContain("/api/v1/rugby-union/team/243/header");
    expect(samplePaths).toContain("/api/v1/rugby-union/search");
  });
});

describe("buildRugbyDataApiProxyUrl", () => {
  it("builds local rugby union API links with path and query", () => {
    expect(
      buildRugbyDataApiProxyUrl("/api/v1/rugby-union/matches", {
        type: "all",
        date: "2026-07-08",
      }),
    ).toBe("/api/v1/rugby-union/matches?type=all&date=2026-07-08");
  });
});
