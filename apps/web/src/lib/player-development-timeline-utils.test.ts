import { describe, expect, it } from "vitest";
import {
  buildDevelopmentWrittenSummary,
  buildGappedLinePath,
  buildSeasonDevelopmentRows,
  detectMixedModelVersions,
  filterTimelinePoints,
  ratingDisplayLabel,
  rollingAverage,
  summarizeRatedPoints,
  type DevelopmentTimelinePoint,
} from "./player-development-timeline-utils";

function point(
  partial: Partial<DevelopmentTimelinePoint> & { fixtureId: string; teamName: string },
): DevelopmentTimelinePoint {
  return {
    fixtureSlug: null,
    date: "2025-01-01",
    seasonSlug: "2024-25",
    seasonLabel: "2024–25",
    competitionSlug: "premiership",
    competitionName: "Premiership",
    opponentName: "Bath",
    homeAway: "home",
    result: "W",
    resultLabel: "Win 20–10",
    scoreLine: "20–10",
    positionName: "Lock",
    jerseyNumber: 4,
    started: true,
    minutes: 80,
    rating: null,
    ratingChange: null,
    tries: 0,
    points: 0,
    carries: null,
    metresCarried: null,
    tacklesMade: null,
    isInternational: false,
    isPotm: false,
    modelVersion: "match-v1",
    annotations: [],
    ...partial,
  };
}

describe("player-development-timeline-utils", () => {
  it("rolling average ignores nulls and uses trailing window", () => {
    expect(rollingAverage([7, null, 8, 9, 10], 3)).toEqual([
      7,
      7,
      (7 + 8) / 2,
      (8 + 9) / 2,
      (8 + 9 + 10) / 3,
    ]);
  });

  it("never treats missing ratings as zero in summary", () => {
    const s = summarizeRatedPoints([
      point({ fixtureId: "1", teamName: "A", rating: 7 }),
      point({ fixtureId: "2", teamName: "A", rating: null }),
      point({ fixtureId: "3", teamName: "A", rating: 9 }),
    ]);
    expect(s.ratedAppearances).toBe(2);
    expect(s.average).toBe(8);
    expect(s.lowest).toBe(7);
  });

  it("builds gapped line path skipping unrated points", () => {
    const d = buildGappedLinePath([
      { x: 0, y: 10, rated: true },
      { x: 10, y: 0, rated: false },
      { x: 20, y: 5, rated: true },
    ]);
    expect(d).toBe("M0.0,10.0 M20.0,5.0");
  });

  it("filters domestic/international and role", () => {
    const points = [
      point({ fixtureId: "1", teamName: "Saracens", rating: 7, isInternational: false, started: true }),
      point({
        fixtureId: "2",
        teamName: "Samoa",
        rating: 8,
        isInternational: true,
        started: false,
        seasonSlug: "2023",
      }),
    ];
    expect(
      filterTimelinePoints(
        points,
        {
          season: "all",
          competition: "all",
          scope: "international",
          role: "all",
          venue: "all",
          result: "all",
          position: "all",
          team: "all",
        },
        "2024-25",
      ),
    ).toHaveLength(1);
    expect(
      filterTimelinePoints(
        points,
        {
          season: "all",
          competition: "all",
          scope: "domestic",
          role: "bench",
          venue: "all",
          result: "all",
          position: "all",
          team: "all",
        },
        "2024-25",
      ),
    ).toHaveLength(0);
  });

  it("builds season rows with previous-season change and DNP counts", () => {
    const rows = buildSeasonDevelopmentRows([
      point({ fixtureId: "1", teamName: "A", seasonSlug: "2023-24", rating: 6 }),
      point({
        fixtureId: "2",
        teamName: "A",
        seasonSlug: "2024-25",
        rating: 8,
      }),
      point({
        fixtureId: "3",
        teamName: "A",
        seasonSlug: "2024-25",
        rating: null,
        minutes: 0,
        started: false,
        appearanceStatus: "unused_bench",
      }),
    ]);
    expect(rows[0]!.seasonSlug).toBe("2024-25");
    expect(rows[0]!.changeFromPrevious).toBe(2);
    expect(rows[0]!.dnpCount).toBe(1);
    expect(rows[0]!.appearances).toBe(2);
  });

  it("labels DNP distinctly from unrated", () => {
    expect(ratingDisplayLabel(null, "unused_bench")).toBe("DNP");
    expect(ratingDisplayLabel(null, "not_selected")).toBe("DNP");
    expect(ratingDisplayLabel(null, "unrated")).toBe("Unrated");
    expect(ratingDisplayLabel(7.4, "played")).toBe("7.4");
  });

  it("detects mixed model versions and builds factual summary", () => {
    expect(
      detectMixedModelVersions([
        point({ fixtureId: "1", teamName: "A", rating: 7, modelVersion: "match-v1" }),
        point({ fixtureId: "2", teamName: "A", rating: 8, modelVersion: "match-v2" }),
      ]),
    ).toBe(true);
    const text = buildDevelopmentWrittenSummary({
      playerName: "Theo McFarland",
      points: [
        point({
          fixtureId: "1",
          teamName: "A",
          rating: 7,
          date: "2025-02-01",
          opponentName: "Leicester",
        }),
        point({ fixtureId: "2", teamName: "A", rating: 9, date: "2025-03-01", opponentName: "Bath" }),
      ],
    });
    expect(text).toContain("Theo McFarland");
    expect(text).toContain("Bath");
  });
});
