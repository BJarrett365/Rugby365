import { describe, expect, it } from "vitest";
import {
  classifyPositionUsage,
  computePlayerPositionUsage,
  normalizeFieldPosition,
  resolvePositionUsageMode,
  type PositionAppearanceInput,
} from "./player-position-usage-service";

function row(
  partial: Partial<PositionAppearanceInput> & Pick<PositionAppearanceInput, "scope">,
): PositionAppearanceInput {
  return {
    positionName: null,
    jerseyNumber: null,
    squadRole: null,
    ...partial,
  };
}

describe("classifyPositionUsage", () => {
  it("uses central classification bands", () => {
    expect(classifyPositionUsage(60)).toBe("PRIMARY");
    expect(classifyPositionUsage(59)).toBe("SECONDARY");
    expect(classifyPositionUsage(15)).toBe("SECONDARY");
    expect(classifyPositionUsage(14)).toBe("UTILITY");
    expect(classifyPositionUsage(5)).toBe("UTILITY");
    expect(classifyPositionUsage(4)).toBe("RARE");
  });
});

describe("normalizeFieldPosition", () => {
  it("excludes replacement / bench as field positions", () => {
    expect(normalizeFieldPosition("Replacement", 16)).toBeNull();
    expect(normalizeFieldPosition("Reserve", 22)).toBeNull();
    expect(normalizeFieldPosition("Bench", 10)).toBeNull();
  });

  it("uses jersey only as fallback when name missing", () => {
    expect(normalizeFieldPosition(null, 10)).toBe("Fly-Half");
    expect(normalizeFieldPosition("Fly-Half", 12)).toBe("Fly-Half");
  });
});

describe("resolvePositionUsageMode", () => {
  it("requires career coverage + minutes for CAREER_TIME", () => {
    const result = resolvePositionUsageMode({
      linkedApps: 180,
      verifiedCareerApps: 200,
      positionKnownApps: 170,
      minutesKnownApps: 130,
      startPositionKnownApps: 140,
      benchPositionKnownApps: 30,
    });
    expect(result.mode).toBe("CAREER_TIME");
    expect(result.title).toBe("POSITION TIME (CAREER)");
  });

  it("uses CAREER_USAGE when appearances strong but minutes incomplete", () => {
    const result = resolvePositionUsageMode({
      linkedApps: 150,
      verifiedCareerApps: 200,
      positionKnownApps: 145,
      minutesKnownApps: 20,
      startPositionKnownApps: 120,
      benchPositionKnownApps: 25,
    });
    expect(result.mode).toBe("CAREER_USAGE");
    expect(result.title).toBe("POSITION USAGE (CAREER)");
  });

  it("falls back to START_POSITION_ONLY for thin start-only data", () => {
    const result = resolvePositionUsageMode({
      linkedApps: 33,
      verifiedCareerApps: 210,
      positionKnownApps: 22,
      minutesKnownApps: 0,
      startPositionKnownApps: 22,
      benchPositionKnownApps: 0,
    });
    expect(result.mode).toBe("START_POSITION_ONLY");
    expect(result.title).toBe("STARTING POSITION — LINKED MATCHES");
  });

  it("uses LINKED_USAGE when bench entry positions exist without career coverage", () => {
    const result = resolvePositionUsageMode({
      linkedApps: 40,
      verifiedCareerApps: 210,
      positionKnownApps: 30,
      minutesKnownApps: 5,
      startPositionKnownApps: 22,
      benchPositionKnownApps: 8,
    });
    expect(result.mode).toBe("LINKED_USAGE");
    expect(result.title).toBe("POSITION USAGE (LINKED MATCHES)");
  });

  it("keeps START_POSITION_ONLY even when start minutes exist", () => {
    const result = resolvePositionUsageMode({
      linkedApps: 33,
      verifiedCareerApps: 85,
      positionKnownApps: 22,
      minutesKnownApps: 18,
      startPositionKnownApps: 22,
      benchPositionKnownApps: 0,
    });
    expect(result.mode).toBe("START_POSITION_ONLY");
  });
});

describe("computePlayerPositionUsage", () => {
  it("does not treat Replacement as a position and keeps appearance role separate", () => {
    const rows: PositionAppearanceInput[] = [
      ...Array.from({ length: 22 }, () =>
        row({
          scope: "international",
          positionName: "Fly-Half",
          jerseyNumber: 10,
          squadRole: "starter",
        }),
      ),
      ...Array.from({ length: 11 }, () =>
        row({
          scope: "international",
          positionName: "Replacement",
          jerseyNumber: 22,
          squadRole: "bench",
        }),
      ),
    ];

    const usage = computePlayerPositionUsage({
      displayName: "Handré Pollard",
      slug: "handre-pollard-og9nmd6l",
      rows,
      verifiedCareerApps: 210,
    });

    expect(usage.mode).toBe("START_POSITION_ONLY");
    expect(usage.title).toBe("STARTING POSITION — LINKED MATCHES");
    expect(usage.calculationMethod).toBe("START_POSITION_ONLY");
    expect(usage.linkedApps).toBe(33);
    expect(usage.starts).toBe(22);
    expect(usage.benchApps).toBe(11);
    expect(usage.positions).toHaveLength(1);
    expect(usage.positions[0]!.positionName).toBe("Fly-Half");
    expect(usage.positions[0]!.usagePercent).toBe(100);
    expect(usage.positions.some((p) => /replac/i.test(p.positionName))).toBe(false);
    expect(usage.insight).toMatch(/All 22 known starts/i);
    expect(usage.title).not.toMatch(/CAREER/i);
  });

  it("does not claim career 100% from start-only linked data", () => {
    const rows: PositionAppearanceInput[] = Array.from({ length: 22 }, () =>
      row({
        scope: "international",
        positionName: "Fly-Half",
        jerseyNumber: 10,
        squadRole: "starter",
      }),
    );
    const usage = computePlayerPositionUsage({
      rows,
      verifiedCareerApps: 100,
    });
    expect(usage.mode).toBe("START_POSITION_ONLY");
    expect(usage.positions[0]!.usagePercent).toBe(100);
    expect(usage.coverage.careerCoveragePct).toBeLessThan(70);
  });

  it("renormalises minute-based percentages to 100", () => {
    const rows: PositionAppearanceInput[] = [
      ...Array.from({ length: 140 }, () =>
        row({
          scope: "international",
          positionName: "Fly-Half",
          jerseyNumber: 10,
          squadRole: "starter",
          minutesPlayed: 80,
        }),
      ),
      ...Array.from({ length: 20 }, () =>
        row({
          scope: "international",
          positionName: "Inside Centre",
          jerseyNumber: 12,
          squadRole: "starter",
          minutesPlayed: 80,
        }),
      ),
      ...Array.from({ length: 12 }, () =>
        row({
          scope: "club",
          positionName: "Fullback",
          jerseyNumber: 15,
          squadRole: "starter",
          minutesPlayed: 80,
        }),
      ),
    ];
    // 172 apps with minutes vs verified 200 → career ready + minute coverage
    const usage = computePlayerPositionUsage({
      rows,
      verifiedCareerApps: 200,
    });
    expect(usage.mode).toBe("CAREER_TIME");
    const sum = usage.positions.reduce((s, p) => s + p.usagePercent, 0);
    expect(sum).toBe(100);
    expect(usage.positions[0]!.classification).toBe("PRIMARY");
    expect(usage.positions.some((p) => p.classification === "SECONDARY" || p.classification === "UTILITY")).toBe(
      true,
    );
  });

  it("allocates mid-match position changes by segment minutes", () => {
    const rows: PositionAppearanceInput[] = [
      row({
        scope: "international",
        positionName: "Fly-Half",
        jerseyNumber: 10,
        squadRole: "starter",
        startMinute: 0,
        endMinute: 62,
      }),
      row({
        scope: "international",
        positionName: "Inside Centre",
        jerseyNumber: 12,
        squadRole: "starter",
        startMinute: 62,
        endMinute: 80,
      }),
      // pad with enough career coverage + minutes
      ...Array.from({ length: 140 }, () =>
        row({
          scope: "international",
          positionName: "Fly-Half",
          jerseyNumber: 10,
          squadRole: "starter",
          minutesPlayed: 80,
        }),
      ),
    ];
    const usage = computePlayerPositionUsage({
      rows,
      verifiedCareerApps: 150,
    });
    const fh = usage.positions.find((p) => p.positionName === "Fly-Half");
    const ic = usage.positions.find((p) => p.positionName === "Inside Centre");
    expect(fh?.minutes).toBeGreaterThan(ic?.minutes ?? 0);
    expect(ic?.minutes).toBe(18);
  });
});
