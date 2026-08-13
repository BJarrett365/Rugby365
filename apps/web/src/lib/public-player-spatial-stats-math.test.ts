import { describe, expect, it } from "vitest";
import {
  bucketEventsToZones,
  buildPositionBasedPassingZones,
  coveragePct,
  normalizeToAttackingCoords,
  readCoordPair,
  readEndCoordPair,
  spatialEventKind,
  zoneIndexFromCoords,
} from "./public-player-spatial-stats-math";

describe("zoneIndexFromCoords", () => {
  it("maps attacking centre", () => {
    expect(zoneIndexFromCoords(75, 50)).toBe(1);
  });

  it("maps defensive right", () => {
    expect(zoneIndexFromCoords(10, 90)).toBe(8);
  });
});

describe("bucketEventsToZones", () => {
  it("computes integer percents that sum to ~100", () => {
    const { cells, total } = bucketEventsToZones([
      { x: 75, y: 50 },
      { x: 75, y: 50 },
      { x: 10, y: 10 },
    ]);
    expect(total).toBe(3);
    expect(cells[1]!.count).toBe(2);
    expect(cells[1]!.percent).toBe(67);
    expect(cells[6]!.percent).toBe(33);
  });
});

describe("normalizeToAttackingCoords", () => {
  it("flips x for away team", () => {
    const out = normalizeToAttackingCoords({
      x: 20,
      y: 50,
      playerTeamId: "away",
      homeTeamId: "home",
      awayTeamId: "away",
      half: 1,
    });
    expect(out.x).toBe(80);
  });

  it("flips again in second half", () => {
    const out = normalizeToAttackingCoords({
      x: 80,
      y: 50,
      playerTeamId: "home",
      homeTeamId: "home",
      awayTeamId: "away",
      half: 2,
    });
    expect(out.x).toBe(20);
  });
});

describe("readCoordPair", () => {
  it("reads x/y and origin aliases", () => {
    expect(readCoordPair({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    expect(readCoordPair({ origin_x: 5, origin_y: 95 })).toEqual({ x: 5, y: 95 });
  });

  it("returns null when missing", () => {
    expect(readCoordPair({ x: 1 })).toBeNull();
  });

  it("reads nested location objects and [x,y] arrays", () => {
    expect(readCoordPair({ location: { x: 40, y: 60 } })).toEqual({ x: 40, y: 60 });
    expect(readCoordPair({ start: [12, 88] })).toEqual({ x: 12, y: 88 });
  });
});

describe("readEndCoordPair", () => {
  it("reads destination coords", () => {
    expect(readEndCoordPair({ end_x: 70, end_y: 40 })).toEqual({ x: 70, y: 40 });
  });

  it("reads nested destination objects", () => {
    expect(readEndCoordPair({ end: { x: 70, y: 40 } })).toEqual({ x: 70, y: 40 });
  });
});

describe("spatialEventKind", () => {
  it("classifies passes and open-play kicks", () => {
    expect(spatialEventKind("pass")).toBe("pass");
    expect(spatialEventKind("kick_from_hand")).toBe("kick_from_hand");
  });

  it("excludes goal kicks", () => {
    expect(spatialEventKind("penalty_goal")).toBeNull();
    expect(spatialEventKind("conversion")).toBeNull();
  });
});

describe("coveragePct", () => {
  it("returns null for zero denominator", () => {
    expect(coveragePct(0, 0)).toBeNull();
  });
});

describe("buildPositionBasedPassingZones", () => {
  it("puts all fly-half passes in middle centre (not a mock spread)", () => {
    const out = buildPositionBasedPassingZones([
      { passCount: 200, positionName: "Fly-Half", jerseyNumber: 10 },
      { passCount: 114, positionName: "Fly Half", jerseyNumber: 10 },
    ]);
    expect(out.totalPasses).toBe(314);
    expect(out.passesWithPosition).toBe(314);
    expect(out.excludedMatches).toBe(0);
    const middle = out.cells.find((c) => c.key === "middle_centre");
    expect(middle?.count).toBe(314);
    expect(middle?.percent).toBe(100);
    expect(out.cells.filter((c) => c.key !== "middle_centre").every((c) => c.count === 0)).toBe(true);
    expect(out.cells.some((c) => c.percent === 25 || c.percent === 15 || c.percent === 11)).toBe(
      false,
    );
  });

  it("excludes unknown-position appearances from zone percent", () => {
    const out = buildPositionBasedPassingZones([
      { passCount: 80, positionName: "Fly-Half", jerseyNumber: 10 },
      { passCount: 20, positionName: null, jerseyNumber: 22 },
    ]);
    expect(out.totalPasses).toBe(100);
    expect(out.passesWithPosition).toBe(80);
    expect(out.excludedPasses).toBe(20);
    expect(out.cells.find((c) => c.key === "middle_centre")?.percent).toBe(100);
  });

  it("splits unknown-side wing passes across attacking left and right", () => {
    const out = buildPositionBasedPassingZones([
      { passCount: 10, positionName: "Wing", jerseyNumber: null },
    ]);
    expect(out.cells.find((c) => c.key === "attacking_left")?.count).toBe(5);
    expect(out.cells.find((c) => c.key === "attacking_right")?.count).toBe(5);
  });
});
