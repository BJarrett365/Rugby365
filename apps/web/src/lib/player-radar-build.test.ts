import { describe, expect, it } from "vitest";
import { buildPlayerRadarBundle, peerMatchesPosition } from "./player-radar-build";
import {
  buildRadarWrittenSummary,
  computeMetricRates,
  percentileRank,
} from "./player-radar-metrics";
import { normalizePositionFamily } from "./player-radar-positions";

describe("player radar positions", () => {
  it("maps lock aliases", () => {
    expect(normalizePositionFamily("Lock")).toBe("lock");
    expect(normalizePositionFamily("Second Row")).toBe("lock");
    expect(normalizePositionFamily("4")).toBe("lock");
  });

  it("maps open/blind flankers", () => {
    expect(normalizePositionFamily("Openside Flanker")).toBe("openside_flanker");
    expect(normalizePositionFamily("Blindside Flanker")).toBe("blindside_flanker");
  });

  it("matches flanker cohort flexibly", () => {
    expect(peerMatchesPosition("Flanker", "openside_flanker")).toBe(true);
    expect(peerMatchesPosition("Lock", "openside_flanker")).toBe(false);
  });
});

describe("percentileRank", () => {
  it("ranks higher values toward 99", () => {
    const cohort = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentileRank(10, cohort).percentile).toBeGreaterThanOrEqual(90);
    expect(percentileRank(1, cohort).percentile).toBeLessThanOrEqual(20);
  });
});

describe("computeMetricRates", () => {
  it("computes per-80 rates", () => {
    const rates = computeMetricRates({
      minutesPlayed: 800,
      appearances: 10,
      tries: 2,
      points: 10,
      carries: 40,
      metresCarried: 200,
      tacklesMade: 80,
      tacklesCompleted: 72,
      dominantTackles: 8,
      turnoversWon: 10,
      tryAssists: 1,
      lineBreaks: 4,
      defendersBeaten: 12,
      touches: 100,
      postContactMetres: 80,
      ruckArrivalEffectiveness: 70,
    });
    expect(rates.tries_per80).toBeCloseTo(0.2);
    expect(rates.metres_per_carry).toBeCloseTo(5);
    expect(rates.tackle_success).toBeCloseTo(90);
  });
});

describe("buildPlayerRadarBundle", () => {
  it("builds overall DNA spokes from position peers only", () => {
    const makePeer = (id: string, tackles: number, position: string) => ({
      playerId: id,
      positionName: position,
      competitionId: "c1",
      minutesPlayed: 500,
      appearances: 8,
      tries: 0,
      points: 0,
      carries: 20,
      metresCarried: 80,
      tacklesMade: tackles,
      tacklesCompleted: Math.round(tackles * 0.9),
      dominantTackles: 2,
      turnoversWon: 4,
      tryAssists: 0,
      lineBreaks: 1,
      defendersBeaten: 2,
      touches: 40,
      postContactMetres: 30,
      ruckArrivalEffectiveness: 60,
    });

    const bundle = buildPlayerRadarBundle({
      playerId: "p1",
      playerName: "Theo McFarland",
      positionName: "Lock",
      competitionLabel: "Premiership",
      seasonLabel: "2024-25",
      minMinutes: 400,
      defaultType: "overall",
      enabled: true,
      summaryOverride: null,
      summaryApproved: false,
      playerRows: [makePeer("p1", 100, "Lock")],
      peers: [
        makePeer("p1", 100, "Lock"),
        makePeer("p2", 40, "Lock"),
        makePeer("p3", 50, "Lock"),
        makePeer("p4", 60, "Lock"),
        makePeer("wing", 200, "Wing"),
      ],
    });

    expect(bundle.title).toContain("Premiership");
    expect(bundle.title).toContain("Locks");
    expect(bundle.cohortSize).toBe(4);
    expect(bundle.radars.defence?.spokes.length).toBeGreaterThan(0);
    expect(bundle.summary.toLowerCase()).toContain("theo mcfarland");
    expect(bundle.seoSpokes.length).toBeGreaterThan(0);
    expect(bundle.future.playerVsPlayer).toBe(false);
  });

  it("never invents strength summary without strong percentiles", () => {
    const thin = buildPlayerRadarBundle({
      playerId: "p1",
      playerName: "Sample Player",
      positionName: "Lock",
      competitionLabel: null,
      seasonLabel: null,
      minMinutes: 400,
      defaultType: "overall",
      enabled: true,
      summaryOverride: null,
      summaryApproved: false,
      playerRows: [
        {
          minutesPlayed: 50,
          appearances: 1,
          tries: 0,
          points: 0,
          carries: 0,
          metresCarried: 0,
          tacklesMade: 0,
          tacklesCompleted: 0,
          dominantTackles: 0,
          turnoversWon: 0,
          tryAssists: 0,
          lineBreaks: 0,
          defendersBeaten: 0,
          touches: 0,
          postContactMetres: 0,
          ruckArrivalEffectiveness: 0,
        },
      ],
      peers: [],
    });
    expect(thin.summary.toLowerCase()).not.toMatch(/top 10%/);
  });
});

describe("written summary override", () => {
  it("uses override when provided", () => {
    expect(
      buildRadarWrittenSummary({
        playerName: "A",
        positionLabel: "Locks",
        competitionLabel: "Premiership",
        spokes: [{ label: "Tackles", percentile: 95 }],
        override: "Custom lock summary.",
      }),
    ).toBe("Custom lock summary.");
  });
});
