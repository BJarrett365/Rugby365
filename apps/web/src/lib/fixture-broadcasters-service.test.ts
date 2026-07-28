import { describe, expect, it } from "vitest";
import { formatBroadcasterLabel } from "./fixture-broadcasters-service";
import {
  PRIMARY_BROADCASTER_REGIONS,
  defaultRegionPackRows,
  isBroadcasterPlatform,
  presetsForRegion,
} from "./rugby-broadcaster-presets";

describe("formatBroadcasterLabel", () => {
  it("includes channel and region when distinct", () => {
    expect(
      formatBroadcasterLabel({
        broadcasterName: "TNT Sports",
        channelName: "TNT Sports 1",
        region: "UK",
      }),
    ).toBe("TNT Sports · TNT Sports 1 (UK)");
  });

  it("omits duplicate channel name", () => {
    expect(
      formatBroadcasterLabel({
        broadcasterName: "BBC",
        channelName: "BBC",
        region: "UK",
      }),
    ).toBe("BBC (UK)");
  });
});

describe("isBroadcasterPlatform", () => {
  it("accepts known platforms", () => {
    expect(isBroadcasterPlatform("tv")).toBe(true);
    expect(isBroadcasterPlatform("streaming")).toBe(true);
    expect(isBroadcasterPlatform("cable")).toBe(false);
  });
});

describe("rugby broadcaster regions", () => {
  it("covers UK SA Aus NZ France as primary territories", () => {
    expect(PRIMARY_BROADCASTER_REGIONS).toEqual(["UK", "ZA", "AU", "NZ", "FR"]);
    for (const code of PRIMARY_BROADCASTER_REGIONS) {
      expect(presetsForRegion(code).length).toBeGreaterThan(0);
    }
  });

  it("builds a one-per-territory starter pack", () => {
    const pack = defaultRegionPackRows();
    expect(pack.map((p) => p.region)).toEqual(["UK", "ZA", "AU", "NZ", "FR"]);
  });
});
